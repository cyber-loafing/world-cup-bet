import type { FunQuestionKey } from "@/lib/types";

export const funQuestions: Record<FunQuestionKey, string> = {
  total_goals_2_plus: "全场总进球数大于等于 2 吗？",
  total_goals_3_plus: "总进球数大于等于 3 吗？",
  total_goals_4_plus: "全场总进球数大于等于 4 吗？",
  both_teams_score: "双方都会进球吗？",
  clean_sheet: "会有一方零封对手吗？",
  home_team_score: "左边球队会进球吗？",
  away_team_score: "右边球队会进球吗？",
  first_half_goal: "上半场会有进球吗？",
  first_half_2_plus: "上半场总进球数大于等于 2 吗？",
  second_half_goal: "下半场会有进球吗？",
  draw_at_half_time: "半场会打平吗？",
  one_goal_margin: "最终分差会是 1 球吗？",
  home_wins_first_half: "左边球队半场会领先吗？",
  away_wins_first_half: "右边球队半场会领先吗？",
  comeback_win: "会出现逆转取胜吗？",
  red_card: "是否会出现红牌？",
  penalty_goal: "是否会有点球进球？",
  late_goal_after_75: "75 分钟后会有进球吗？",
  own_goal: "会出现乌龙球吗？",
  yellow_cards_4_plus: "黄牌总数大于等于 4 吗？",
};

export const funQuestionOptions = Object.entries(funQuestions).map(([value, label]) => ({
  value: value as FunQuestionKey,
  label,
}));
