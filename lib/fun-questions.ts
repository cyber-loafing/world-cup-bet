import type { FunQuestionKey } from "@/lib/types";

export const funQuestions: Record<FunQuestionKey, string> = {
  total_goals_3_plus: "总进球数大于等于 3 吗？",
  both_teams_score: "双方都会进球吗？",
  first_half_goal: "上半场会有进球吗？",
  red_card: "是否会出现红牌？",
  penalty_goal: "是否会有点球进球？",
};

export const funQuestionOptions = Object.entries(funQuestions).map(([value, label]) => ({
  value: value as FunQuestionKey,
  label,
}));
