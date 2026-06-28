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

export type AdvanceMethod = "regular" | "extra_time" | "penalties";

export type FunQuestionKey =
  | "total_goals_2_plus"
  | "total_goals_3_plus"
  | "total_goals_4_plus"
  | "both_teams_score"
  | "clean_sheet"
  | "home_team_score"
  | "away_team_score"
  | "first_half_goal"
  | "first_half_2_plus"
  | "second_half_goal"
  | "draw_at_half_time"
  | "one_goal_margin"
  | "home_wins_first_half"
  | "away_wins_first_half"
  | "comeback_win"
  | "red_card"
  | "penalty_goal"
  | "late_goal_after_75"
  | "own_goal"
  | "yellow_cards_4_plus";

export type KnockoutScriptQuestionKey =
  | "reaches_extra_time"
  | "reaches_penalties"
  | "decided_in_90"
  | "winner_clean_sheet"
  | "both_teams_score_90"
  | "late_goal_after_75"
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
  knockoutScriptQuestionKey: KnockoutScriptQuestionKey | null;
  knockoutScriptAnswer: boolean | null;
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
  predictedAdvanceMethod: AdvanceMethod | null;
  knockoutScriptAnswer: boolean | null;
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
  advanceMethodPoints: number;
  knockoutScriptPoints: number;
  exactScoreBonus: number;
  netAmount: number;
  streakBadge: boolean;
  settledAt: string;
};

export type ChampionPick = {
  id?: string;
  playerId: string;
  championTeam: string;
  lockedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
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
