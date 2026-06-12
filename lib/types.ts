export type PlayerCode = "player_a" | "player_b";

export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

export type PickResult = "home" | "draw" | "away";

export type FunQuestionKey =
  | "total_goals_3_plus"
  | "both_teams_score"
  | "first_half_goal"
  | "red_card"
  | "penalty_goal";

export type Match = {
  id: string;
  apiFootballFixtureId: number | null;
  matchNumber: number;
  stage: MatchStage;
  groupName: string | null;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  venue: string | null;
  status: MatchStatus;
  homeScore90: number | null;
  awayScore90: number | null;
  homeScoreExtra: number | null;
  awayScoreExtra: number | null;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
  winnerTeam: string | null;
  funQuestionKey: FunQuestionKey;
  funQuestionAnswer: boolean | null;
  redCards: number | null;
  penaltyGoals: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Player = {
  id: string;
  userId: string;
  code: PlayerCode;
  displayName: string;
  avatarColor: string;
};

export type Prediction = {
  id?: string;
  matchId: string;
  playerId: string;
  pickResult: PickResult;
  predictedHomeScore: number;
  predictedAwayScore: number;
  funAnswer: boolean;
  predictedWinnerTeam: string | null;
  lockedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Settlement = {
  id?: string;
  matchId: string;
  playerId: string;
  points: number;
  resultPoints: number;
  scorePoints: number;
  funPoints: number;
  advancePoints: number;
  exactScoreBonus: number;
  netAmount: number;
  streakBadge: boolean;
  settledAt: string;
};

export type LedgerRow = {
  match: Match;
  settlements: Settlement[];
};

export type DashboardStats = {
  playerId: string;
  code: PlayerCode;
  displayName: string;
  avatarColor: string;
  points: number;
  netAmount: number;
  exactScores: number;
  funHits: number;
  streakBadges: number;
};
