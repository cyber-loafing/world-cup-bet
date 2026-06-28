import type { AdvanceMethod, Match, PickResult, Prediction, Settlement } from "@/lib/types";

const amountByPointDiff: Record<number, number> = {
  0: 0,
  1: 3,
  2: 5,
  3: 7,
};

type ScoreBreakdown = Omit<
  Settlement,
  "id" | "matchId" | "playerId" | "netAmount" | "streakBadge" | "settledAt"
>;

export function getActualResult(match: Pick<Match, "homeScore90" | "awayScore90">): PickResult | null {
  if (match.homeScore90 === null || match.awayScore90 === null) {
    return null;
  }
  if (match.homeScore90 > match.awayScore90) {
    return "home";
  }
  if (match.homeScore90 < match.awayScore90) {
    return "away";
  }
  return "draw";
}

export function getPredictedResult(prediction: Pick<Prediction, "predictedHomeScore" | "predictedAwayScore">): PickResult {
  if (prediction.predictedHomeScore > prediction.predictedAwayScore) {
    return "home";
  }
  if (prediction.predictedHomeScore < prediction.predictedAwayScore) {
    return "away";
  }
  return "draw";
}

export function isKnockout(stage: Match["stage"]) {
  return stage !== "group";
}

export function getActualAdvanceMethod(match: Pick<Match, "stage" | "homePenaltyScore" | "awayPenaltyScore" | "homeScoreExtra" | "awayScoreExtra">): AdvanceMethod | null {
  if (!isKnockout(match.stage)) {
    return null;
  }
  if (match.homePenaltyScore !== null || match.awayPenaltyScore !== null) {
    return "penalties";
  }
  if (match.homeScoreExtra !== null || match.awayScoreExtra !== null) {
    return "extra_time";
  }
  return "regular";
}

export function isPredictionLocked(match: Pick<Match, "kickoffAt">, lockedAt: string | null, now = new Date()) {
  return Boolean(lockedAt) || now >= new Date(match.kickoffAt);
}

export function scorePrediction(match: Match, prediction: Prediction): ScoreBreakdown {
  const actualResult = getActualResult(match);
  if (actualResult === null || match.funQuestionAnswer === null) {
    return {
      points: 0,
      resultPoints: 0,
      scorePoints: 0,
      funPoints: 0,
      advancePoints: 0,
      advanceMethodPoints: 0,
      knockoutScriptPoints: 0,
      exactScoreBonus: 0,
    };
  }

  const homeScore90 = match.homeScore90;
  const awayScore90 = match.awayScore90;
  if (homeScore90 === null || awayScore90 === null) {
    throw new Error("Finished matches must include 90-minute scores.");
  }

  const predictedResult = getPredictedResult(prediction);
  const resultPoints = predictedResult === actualResult ? 2 : 0;
  const exactScore =
    prediction.predictedHomeScore === homeScore90 &&
    prediction.predictedAwayScore === awayScore90;
  const predictedGoalDiff = prediction.predictedHomeScore - prediction.predictedAwayScore;
  const actualGoalDiff = homeScore90 - awayScore90;
  const scorePoints = exactScore
    ? 3
    : predictedResult === actualResult && predictedGoalDiff === actualGoalDiff
      ? 1
      : 0;
  const funPoints = prediction.funAnswer === match.funQuestionAnswer ? 2 : 0;
  const advancePoints =
    isKnockout(match.stage) &&
    prediction.predictedWinnerTeam !== null &&
    match.winnerTeam !== null &&
    prediction.predictedWinnerTeam === match.winnerTeam
      ? 2
      : 0;
  const actualAdvanceMethod = getActualAdvanceMethod(match);
  const advanceMethodPoints =
    isKnockout(match.stage) &&
    prediction.predictedAdvanceMethod !== null &&
    actualAdvanceMethod !== null &&
    prediction.predictedAdvanceMethod === actualAdvanceMethod
      ? 2
      : 0;
  const knockoutScriptPoints =
    isKnockout(match.stage) &&
    prediction.knockoutScriptAnswer !== null &&
    match.knockoutScriptAnswer !== null &&
    prediction.knockoutScriptAnswer === match.knockoutScriptAnswer
      ? 2
      : 0;

  return {
    points: resultPoints + scorePoints + funPoints + advancePoints + advanceMethodPoints + knockoutScriptPoints,
    resultPoints,
    scorePoints,
    funPoints,
    advancePoints,
    advanceMethodPoints,
    knockoutScriptPoints,
    exactScoreBonus: exactScore ? 2 : 0,
  };
}

export function calculateBaseTransfer(pointDiff: number, loserCurrentNetAmount = 0) {
  const absoluteDiff = Math.abs(pointDiff);
  const base = absoluteDiff >= 4 ? 10 : amountByPointDiff[absoluteDiff];
  if (loserCurrentNetAmount <= -100) {
    return Math.min(base, 5);
  }
  return base;
}

export function settleMatch(
  match: Match,
  predictions: Prediction[],
  playerCurrentNetAmounts: Record<string, number> = {},
  settledAt = new Date().toISOString(),
): Settlement[] {
  if (match.status !== "finished" || predictions.length < 2) {
    return [];
  }

  const scored = predictions.map((prediction) => ({
    prediction,
    score: scorePrediction(match, prediction),
  }));
  const [first, second] = scored;
  const pointDiff = first.score.points - second.score.points;

  let firstNetAmount = 0;
  let secondNetAmount = 0;
  if (pointDiff !== 0) {
    const winner = pointDiff > 0 ? first : second;
    const loser = pointDiff > 0 ? second : first;
    const loserCurrentNetAmount = playerCurrentNetAmounts[loser.prediction.playerId] ?? 0;
    const baseTransfer = calculateBaseTransfer(pointDiff, loserCurrentNetAmount);
    if (winner === first) {
      firstNetAmount += baseTransfer;
      secondNetAmount -= baseTransfer;
    } else {
      firstNetAmount -= baseTransfer;
      secondNetAmount += baseTransfer;
    }
  }

  firstNetAmount += first.score.exactScoreBonus - second.score.exactScoreBonus;
  secondNetAmount += second.score.exactScoreBonus - first.score.exactScoreBonus;

  const firstLoserAfterBonus = firstNetAmount < 0 && (playerCurrentNetAmounts[first.prediction.playerId] ?? 0) <= -100;
  const secondLoserAfterBonus = secondNetAmount < 0 && (playerCurrentNetAmounts[second.prediction.playerId] ?? 0) <= -100;
  if (firstLoserAfterBonus) {
    firstNetAmount = Math.max(firstNetAmount, -7);
    secondNetAmount = -firstNetAmount;
  }
  if (secondLoserAfterBonus) {
    secondNetAmount = Math.max(secondNetAmount, -7);
    firstNetAmount = -secondNetAmount;
  }

  return [
    toSettlement(match.id, first.prediction.playerId, first.score, firstNetAmount, settledAt),
    toSettlement(match.id, second.prediction.playerId, second.score, secondNetAmount, settledAt),
  ];
}

function toSettlement(
  matchId: string,
  playerId: string,
  score: ScoreBreakdown,
  netAmount: number,
  settledAt: string,
): Settlement {
  return {
    matchId,
    playerId,
    ...score,
    netAmount,
    streakBadge: false,
    settledAt,
  };
}
