import { insforge } from "@/lib/insforge";
import { clearRememberedSession, rememberSession, restoreRememberedSession } from "@/lib/auth-session";
import { mockMatches, mockPlayers, mockPredictions, mockSettlements } from "@/lib/mock-data";
import type { Match, Player, Prediction, Settlement } from "@/lib/types";

type DbMatch = {
  id: string;
  api_football_fixture_id: number | null;
  match_number: number;
  stage: Match["stage"];
  group_name: string | null;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  venue: string | null;
  status: Match["status"];
  home_score_90: number | null;
  away_score_90: number | null;
  home_score_extra: number | null;
  away_score_extra: number | null;
  home_penalty_score: number | null;
  away_penalty_score: number | null;
  winner_team: string | null;
  fun_question_key: Match["funQuestionKey"];
  fun_question_answer: boolean | null;
  red_cards: number | null;
  penalty_goals: number | null;
  created_at?: string;
  updated_at?: string;
};

type DbPlayer = {
  id: string;
  user_id: string;
  code: Player["code"];
  display_name: string;
  avatar_color: string;
};

type DbPrediction = {
  id?: string;
  match_id: string;
  player_id: string;
  pick_result: Prediction["pickResult"];
  predicted_home_score: number;
  predicted_away_score: number;
  fun_answer: boolean;
  predicted_winner_team: string | null;
  locked_at: string | null;
  created_at?: string;
  updated_at?: string;
};

type DbSettlement = {
  id?: string;
  match_id: string;
  player_id: string;
  points: number;
  result_points: number;
  score_points: number;
  fun_points: number;
  advance_points: number;
  exact_score_bonus: number;
  net_amount: number;
  streak_badge: boolean;
  settled_at: string;
};

export async function getSessionUser() {
  if (!insforge) {
    return null;
  }

  const { data, error } = await insforge.auth.getCurrentUser();
  if (!error && data?.user) {
    return data.user;
  }

  return restoreRememberedSession();
}

export async function signIn(email: string, password: string) {
  if (!insforge) {
    throw new Error("InsForge is not configured.");
  }
  const { data, error } = await insforge.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  rememberSession(data?.accessToken, data?.user);
}

export async function signOut() {
  clearRememberedSession();
  if (!insforge) {
    return;
  }
  await insforge.auth.signOut();
  insforge.setAccessToken(null);
}

export async function loadPlayers(): Promise<Player[]> {
  if (!insforge) {
    return mockPlayers;
  }
  const { data, error } = await insforge.database.from("players").select("*").order("code");
  if (error) {
    throw error;
  }
  return (data as DbPlayer[]).map(mapPlayer);
}

export async function loadMatches(): Promise<Match[]> {
  if (!insforge) {
    return mockMatches;
  }
  const { data, error } = await insforge.database.from("matches").select("*").order("kickoff_at");
  if (error) {
    throw error;
  }
  return (data as DbMatch[]).map(mapMatch);
}

export async function loadPredictions(): Promise<Prediction[]> {
  if (!insforge) {
    return mockPredictions;
  }
  const { data, error } = await insforge.database.from("predictions").select("*");
  if (error) {
    throw error;
  }
  return (data as DbPrediction[]).map(mapPrediction);
}

export async function loadSettlements(): Promise<Settlement[]> {
  if (!insforge) {
    return mockSettlements;
  }
  const { data, error } = await insforge.database.from("settlements").select("*");
  if (error) {
    throw error;
  }
  return (data as DbSettlement[]).map(mapSettlement);
}

export async function savePrediction(input: Omit<Prediction, "id" | "lockedAt"> & { id?: string }) {
  if (!insforge) {
    throw new Error("InsForge is not configured. Set NEXT_PUBLIC_INSFORGE_URL and NEXT_PUBLIC_INSFORGE_ANON_KEY.");
  }
  const row = {
    id: input.id,
    match_id: input.matchId,
    player_id: input.playerId,
    pick_result: input.pickResult,
    predicted_home_score: input.predictedHomeScore,
    predicted_away_score: input.predictedAwayScore,
    fun_answer: input.funAnswer,
    predicted_winner_team: input.predictedWinnerTeam,
  };
  const { error } = await insforge.database.from("predictions").upsert(row, {
    onConflict: "match_id,player_id",
  });
  if (error) {
    throw error;
  }
}

export async function lockPrediction(predictionId: string) {
  if (!insforge) {
    throw new Error("InsForge is not configured.");
  }
  const { error } = await insforge.database
    .from("predictions")
    .update({ locked_at: new Date().toISOString() })
    .eq("id", predictionId);
  if (error) {
    throw error;
  }
}

function mapMatch(row: DbMatch): Match {
  return {
    id: row.id,
    apiFootballFixtureId: row.api_football_fixture_id,
    matchNumber: row.match_number,
    stage: row.stage,
    groupName: row.group_name,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoffAt: row.kickoff_at,
    venue: row.venue,
    status: row.status,
    homeScore90: row.home_score_90,
    awayScore90: row.away_score_90,
    homeScoreExtra: row.home_score_extra,
    awayScoreExtra: row.away_score_extra,
    homePenaltyScore: row.home_penalty_score,
    awayPenaltyScore: row.away_penalty_score,
    winnerTeam: row.winner_team,
    funQuestionKey: row.fun_question_key,
    funQuestionAnswer: row.fun_question_answer,
    redCards: row.red_cards,
    penaltyGoals: row.penalty_goals,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlayer(row: DbPlayer): Player {
  return {
    id: row.id,
    userId: row.user_id,
    code: row.code,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSettlement(row: DbSettlement): Settlement {
  return {
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id,
    points: row.points,
    resultPoints: row.result_points,
    scorePoints: row.score_points,
    funPoints: row.fun_points,
    advancePoints: row.advance_points,
    exactScoreBonus: row.exact_score_bonus,
    netAmount: row.net_amount,
    streakBadge: row.streak_badge,
    settledAt: row.settled_at,
  };
}
