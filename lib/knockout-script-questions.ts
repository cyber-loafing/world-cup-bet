import type { KnockoutScriptQuestionKey } from "@/lib/types";

export const knockoutScriptQuestions: Record<KnockoutScriptQuestionKey, string> = {
  reaches_extra_time: "这场会进入加时赛吗？",
  reaches_penalties: "这场会进入点球大战吗？",
  decided_in_90: "晋级球队会在 90 分钟内解决比赛吗？",
  winner_clean_sheet: "晋级球队会零封对手吗？",
  both_teams_score_90: "90 分钟内双方都会进球吗？",
  late_goal_after_75: "75 分钟后会有改写剧情的进球吗？",
  red_card: "这场会出现红牌吗？",
  penalty_goal: "这场会有点球进球吗？",
};

export const knockoutScriptQuestionOptions = Object.entries(knockoutScriptQuestions).map(([value, label]) => ({
  value: value as KnockoutScriptQuestionKey,
  label,
}));

export function chooseKnockoutScriptQuestion(matchNumber: number): KnockoutScriptQuestionKey {
  return knockoutScriptQuestionOptions[(Math.max(matchNumber, 1) - 1) % knockoutScriptQuestionOptions.length].value;
}
