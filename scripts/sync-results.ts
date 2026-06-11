import { createAdminClient } from "@insforge/sdk";
import { funQuestionOptions } from "../lib/fun-questions";
import { settleMatch } from "../lib/settlement";
import type { FunQuestionKey, Match, MatchStage, MatchStatus, Prediction, Settlement } from "../lib/types";

const insforgeUrl = requiredEnv("NEXT_PUBLIC_INSFORGE_URL");
const insforgeApiKey = requiredEnv("INSFORGE_API_KEY");
const apiFootballKey = requiredEnv("API_FOOTBALL_KEY");
const apiBaseUrl = "https://v3.football.api-sports.io";

const insforge = createAdminClient({
  baseUrl: insforgeUrl,
  apiKey: insforgeApiKey,
});

type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string };
    venue?: { name?: string; city?: string };
  };
  league: {
    round?: string;
  };
  teams: {
    home: { name: string; winner: boolean | null };
    away: { name: string; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
};

type ApiEvent = {
  type: string;
  detail: string;
};

type DbPrediction = {
  id: string;
  match_id: string;
  player_id: string;
  pick_result: Prediction["pickResult"];
  predicted_home_score: number;
  predicted_away_score: number;
  fun_answer: boolean;
  predicted_winner_team: string | null;
  locked_at: string | null;
};

async function main() {
  const runId = await createSyncRun();
  try {
    const fixtures = await fetchFixtures();
    const sortedFixtures = fixtures.sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
    const upsertedMatches: Match[] = [];

    for (const [index, fixture] of sortedFixtures.entries()) {
      const events = isFinished(fixture) ? await fetchEvents(fixture.fixture.id) : [];
      const match = await upsertMatch(fixture, index + 1, events);
      upsertedMatches.push(match);
    }

    await settleFinishedMatches(upsertedMatches.filter((match) => match.status === "finished"));
    await finishSyncRun(runId, "success", `Synced ${upsertedMatches.length} fixtures.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await finishSyncRun(runId, "error", message);
    throw error;
  }
}

async function fetchFixtures(): Promise<ApiFixture[]> {
  const payload = await apiGet<{ response: ApiFixture[] }>("/fixtures?league=1&season=2026");
  return payload.response;
}

async function fetchEvents(fixtureId: number): Promise<ApiEvent[]> {
  const payload = await apiGet<{ response: ApiEvent[] }>(`/fixtures/events?fixture=${fixtureId}`);
  return payload.response;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "x-apisports-key": apiFootballKey,
    },
  });
  if (!response.ok) {
    throw new Error(`API-Football request failed ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function upsertMatch(fixture: ApiFixture, matchNumber: number, events: ApiEvent[]): Promise<Match> {
  const funQuestionKey = chooseFunQuestion(fixture.fixture.id);
  const eventFacts = summarizeEvents(events);
  const row = {
    api_football_fixture_id: fixture.fixture.id,
    match_number: matchNumber,
    stage: mapStage(fixture.league.round),
    group_name: parseGroupName(fixture.league.round),
    home_team: fixture.teams.home.name,
    away_team: fixture.teams.away.name,
    kickoff_at: fixture.fixture.date,
    venue: [fixture.fixture.venue?.name, fixture.fixture.venue?.city].filter(Boolean).join(", ") || null,
    status: mapStatus(fixture.fixture.status.short),
    home_score_90: fixture.score.fulltime.home ?? fixture.goals.home,
    away_score_90: fixture.score.fulltime.away ?? fixture.goals.away,
    home_score_extra: fixture.score.extratime.home,
    away_score_extra: fixture.score.extratime.away,
    home_penalty_score: fixture.score.penalty.home,
    away_penalty_score: fixture.score.penalty.away,
    winner_team: fixture.teams.home.winner ? fixture.teams.home.name : fixture.teams.away.winner ? fixture.teams.away.name : null,
    fun_question_key: funQuestionKey,
    fun_question_answer: isFinished(fixture) ? answerFunQuestion(funQuestionKey, fixture, eventFacts) : null,
    red_cards: eventFacts.redCards,
    penalty_goals: eventFacts.penaltyGoals,
    raw_payload: fixture,
  };

  const { data, error } = await insforge.database
    .from("matches")
    .upsert(row, { onConflict: "api_football_fixture_id" })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return mapMatch(data);
}

async function settleFinishedMatches(matches: Match[]) {
  const { data: predictionsData, error: predictionsError } = await insforge.database.from("predictions").select("*");
  if (predictionsError) {
    throw predictionsError;
  }
  const predictions = (predictionsData as DbPrediction[]).map(mapPrediction);

  const { data: settlementData, error: settlementError } = await insforge.database.from("settlements").select("*");
  if (settlementError) {
    throw settlementError;
  }
  const existingSettlements = settlementData as Array<{ match_id: string; player_id: string; net_amount: number }>;

  for (const match of matches) {
    const matchPredictions = predictions.filter((prediction) => prediction.matchId === match.id);
    if (matchPredictions.length < 2 || match.funQuestionAnswer === null) {
      continue;
    }
    const currentNetAmounts = Object.fromEntries(
      matchPredictions.map((prediction) => [
        prediction.playerId,
        existingSettlements
          .filter((settlement) => settlement.player_id === prediction.playerId && settlement.match_id !== match.id)
          .reduce((sum, settlement) => sum + Number(settlement.net_amount), 0),
      ]),
    );
    const settlements = settleMatch(match, matchPredictions, currentNetAmounts);
    await upsertSettlements(settlements);
  }
}

async function upsertSettlements(settlements: Settlement[]) {
  if (settlements.length === 0) {
    return;
  }
  const rows = settlements.map((settlement) => ({
    match_id: settlement.matchId,
    player_id: settlement.playerId,
    points: settlement.points,
    result_points: settlement.resultPoints,
    score_points: settlement.scorePoints,
    fun_points: settlement.funPoints,
    advance_points: settlement.advancePoints,
    exact_score_bonus: settlement.exactScoreBonus,
    net_amount: settlement.netAmount,
    streak_badge: settlement.streakBadge,
    settled_at: settlement.settledAt,
  }));
  const { error } = await insforge.database.from("settlements").upsert(rows, { onConflict: "match_id,player_id" });
  if (error) {
    throw error;
  }
}

function mapStage(round: string | undefined): MatchStage {
  const value = (round ?? "").toLowerCase();
  if (value.includes("round of 32")) return "round_of_32";
  if (value.includes("round of 16")) return "round_of_16";
  if (value.includes("quarter")) return "quarter_final";
  if (value.includes("semi")) return "semi_final";
  if (value.includes("3rd") || value.includes("third")) return "third_place";
  if (value.includes("final")) return "final";
  return "group";
}

function parseGroupName(round: string | undefined) {
  const match = (round ?? "").match(/Group\s+([A-L])/i);
  return match?.[1] ?? null;
}

function mapStatus(short: string): MatchStatus {
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (["1H", "HT", "2H", "ET", "P"].includes(short)) return "live";
  if (["PST", "CANC", "ABD"].includes(short)) return short === "PST" ? "postponed" : "cancelled";
  return "scheduled";
}

function isFinished(fixture: ApiFixture) {
  return ["FT", "AET", "PEN"].includes(fixture.fixture.status.short);
}

function chooseFunQuestion(fixtureId: number): FunQuestionKey {
  return funQuestionOptions[fixtureId % funQuestionOptions.length].value;
}

function summarizeEvents(events: ApiEvent[]) {
  return {
    redCards: events.filter((event) => event.type === "Card" && /red/i.test(event.detail)).length,
    penaltyGoals: events.filter((event) => event.type === "Goal" && /penalty/i.test(event.detail)).length,
  };
}

function answerFunQuestion(
  key: FunQuestionKey,
  fixture: ApiFixture,
  facts: ReturnType<typeof summarizeEvents>,
) {
  const home = fixture.score.fulltime.home ?? fixture.goals.home ?? 0;
  const away = fixture.score.fulltime.away ?? fixture.goals.away ?? 0;
  const halfHome = fixture.score.halftime.home ?? 0;
  const halfAway = fixture.score.halftime.away ?? 0;
  if (key === "total_goals_3_plus") return home + away >= 3;
  if (key === "both_teams_score") return home > 0 && away > 0;
  if (key === "first_half_goal") return halfHome + halfAway > 0;
  if (key === "red_card") return facts.redCards > 0;
  return facts.penaltyGoals > 0;
}

async function createSyncRun() {
  const { data, error } = await insforge.database
    .from("sync_runs")
    .insert({ source: "api-football", status: "running" })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id as string;
}

async function finishSyncRun(id: string, status: "success" | "error", message: string) {
  await insforge.database
    .from("sync_runs")
    .update({ status, message, finished_at: new Date().toISOString() })
    .eq("id", id);
}

function mapMatch(row: Record<string, unknown>): Match {
  return {
    id: String(row.id),
    apiFootballFixtureId: Number(row.api_football_fixture_id),
    matchNumber: Number(row.match_number),
    stage: row.stage as MatchStage,
    groupName: row.group_name as string | null,
    homeTeam: String(row.home_team),
    awayTeam: String(row.away_team),
    kickoffAt: String(row.kickoff_at),
    venue: row.venue as string | null,
    status: row.status as MatchStatus,
    homeScore90: nullableNumber(row.home_score_90),
    awayScore90: nullableNumber(row.away_score_90),
    homeScoreExtra: nullableNumber(row.home_score_extra),
    awayScoreExtra: nullableNumber(row.away_score_extra),
    homePenaltyScore: nullableNumber(row.home_penalty_score),
    awayPenaltyScore: nullableNumber(row.away_penalty_score),
    winnerTeam: row.winner_team as string | null,
    funQuestionKey: row.fun_question_key as FunQuestionKey,
    funQuestionAnswer: row.fun_question_answer as boolean | null,
    redCards: nullableNumber(row.red_cards),
    penaltyGoals: nullableNumber(row.penalty_goals),
  };
}

function mapPrediction(row: DbPrediction): Prediction {
  return {
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id,
    pickResult: row.pick_result,
    predictedHomeScore: row.predicted_home_score,
    predictedAwayScore: row.predicted_away_score,
    funAnswer: row.fun_answer,
    predictedWinnerTeam: row.predicted_winner_team,
    lockedAt: row.locked_at,
  };
}

function nullableNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
