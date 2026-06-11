import { describe, expect, it } from "vitest";
import { isPredictionLocked, settleMatch } from "@/lib/settlement";
import type { Match, Prediction } from "@/lib/types";

const baseMatch: Match = {
  id: "match-1",
  apiFootballFixtureId: null,
  matchNumber: 1,
  stage: "group",
  groupName: "A",
  homeTeam: "巴西",
  awayTeam: "摩洛哥",
  kickoffAt: "2026-06-15T03:00:00+08:00",
  venue: "Miami",
  status: "finished",
  homeScore90: 2,
  awayScore90: 1,
  homeScoreExtra: null,
  awayScoreExtra: null,
  homePenaltyScore: null,
  awayPenaltyScore: null,
  winnerTeam: "巴西",
  funQuestionKey: "both_teams_score",
  funQuestionAnswer: true,
  redCards: 0,
  penaltyGoals: 0,
};

const aPrediction: Prediction = {
  matchId: "match-1",
  playerId: "a",
  pickResult: "home",
  predictedHomeScore: 2,
  predictedAwayScore: 1,
  funAnswer: true,
  predictedWinnerTeam: null,
  lockedAt: null,
};

const bPrediction: Prediction = {
  matchId: "match-1",
  playerId: "b",
  pickResult: "home",
  predictedHomeScore: 3,
  predictedAwayScore: 1,
  funAnswer: false,
  predictedWinnerTeam: null,
  lockedAt: null,
};

describe("settleMatch", () => {
  it("scores group matches and applies exact-score bonus", () => {
    const settlements = settleMatch(baseMatch, [aPrediction, bPrediction]);

    expect(settlements).toHaveLength(2);
    expect(settlements[0]).toMatchObject({
      playerId: "a",
      points: 7,
      exactScoreBonus: 2,
      netAmount: 12,
    });
    expect(settlements[1]).toMatchObject({
      playerId: "b",
      points: 2,
      netAmount: -12,
    });
  });

  it("adds knockout advance points based on final winner", () => {
    const knockoutMatch: Match = {
      ...baseMatch,
      stage: "round_of_16",
      homeTeam: "法国",
      awayTeam: "英格兰",
      homeScore90: 1,
      awayScore90: 1,
      winnerTeam: "法国",
    };
    const settlements = settleMatch(knockoutMatch, [
      {
        ...aPrediction,
        pickResult: "draw",
        predictedHomeScore: 1,
        predictedAwayScore: 1,
        predictedWinnerTeam: "法国",
      },
      {
        ...bPrediction,
        pickResult: "home",
        predictedHomeScore: 2,
        predictedAwayScore: 1,
        predictedWinnerTeam: "法国",
      },
    ]);

    expect(settlements[0].points).toBe(9);
    expect(settlements[1].points).toBe(2);
  });

  it("caps base loss when a player is under loser protection", () => {
    const settlements = settleMatch(baseMatch, [aPrediction, bPrediction], {
      b: -100,
    });

    expect(settlements[0].netAmount).toBe(7);
    expect(settlements[1].netAmount).toBe(-7);
  });
});

describe("isPredictionLocked", () => {
  it("locks after kickoff", () => {
    expect(isPredictionLocked(baseMatch, null, new Date("2026-06-15T04:00:00+08:00"))).toBe(true);
  });

  it("stays editable before kickoff without lockedAt", () => {
    expect(isPredictionLocked(baseMatch, null, new Date("2026-06-15T02:00:00+08:00"))).toBe(false);
  });
});
