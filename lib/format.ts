export function formatBeijingTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatFullBeijingTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatMoney(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(0)}r`;
}

export function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    group: "小组赛",
    round_of_32: "32 强",
    round_of_16: "16 强",
    quarter_final: "1/4 决赛",
    semi_final: "半决赛",
    third_place: "三四名",
    final: "决赛",
  };
  return labels[stage] ?? stage;
}
