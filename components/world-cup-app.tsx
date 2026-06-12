"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Crown,
  Flag,
  Loader2,
  Lock,
  LogOut,
  Map,
  Medal,
  Save,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import clsx from "clsx";
import {
  getSessionUser,
  loadMatches,
  loadPlayers,
  loadPredictions,
  loadSettlements,
  lockPrediction,
  savePrediction,
  signIn,
  signOut,
} from "@/lib/data";
import { funQuestions } from "@/lib/fun-questions";
import { formatBeijingTime, formatFullBeijingTime, formatMoney, stageLabel } from "@/lib/format";
import { isPredictionLocked } from "@/lib/settlement";
import { isInsForgeConfigured } from "@/lib/insforge";
import type { DashboardStats, Match, Player, Prediction, Settlement } from "@/lib/types";

type View = "dashboard" | "matches" | "ledger" | "leaderboard";

type AppState = {
  matches: Match[];
  players: Player[];
  predictions: Prediction[];
  settlements: Settlement[];
};

type DramaMode = "empty" | "tie" | "close" | "breakaway";

type DramaState = {
  line: string;
  mode: DramaMode;
  leaderId: string | null;
  trailerId: string | null;
};

const emptyState: AppState = {
  matches: [],
  players: [],
  predictions: [],
  settlements: [],
};

const goalOptions = Array.from({ length: 11 }, (_, index) => index);

export function WorldCupApp({ initialView }: { initialView: View }) {
  const [view, setView] = useState<View>(initialView);
  const [state, setState] = useState<AppState>(emptyState);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const user = await getSessionUser();
      const [players, matches, predictions, settlements] = await Promise.all([
        loadPlayers(),
        loadMatches(),
        loadPredictions(),
        loadSettlements(),
      ]);
      setCurrentUserId(user?.id ?? null);
      setState({ players, matches, predictions, settlements });
      setSelectedMatchId((current) => current ?? matches[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const currentPlayer = useMemo(() => {
    if (!isInsForgeConfigured) {
      return state.players[0] ?? null;
    }
    return state.players.find((player) => player.userId === currentUserId) ?? null;
  }, [currentUserId, state.players]);

  const stats = useMemo(() => buildStats(state.players, state.settlements), [state.players, state.settlements]);
  const selectedMatch = state.matches.find((match) => match.id === selectedMatchId) ?? state.matches[0] ?? null;
  const nextMatch = useMemo(() => {
    const now = Date.now();
    return state.matches.find((match) => new Date(match.kickoffAt).getTime() >= now) ?? state.matches[0] ?? null;
  }, [state.matches]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (isInsForgeConfigured && !currentPlayer) {
    return <LoginScreen onSignedIn={refresh} error={error} />;
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-col gap-4 rounded-lg bg-white/88 p-4 shadow-soft ring-1 ring-ink/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-grass">2026 FIFA World Cup</p>
          <h1 className="text-2xl font-black text-ink sm:text-3xl">情侣竞猜账本</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NavButton active={view === "dashboard"} icon={<Trophy size={17} />} label="首页" onClick={() => setView("dashboard")} />
          <NavButton active={view === "matches"} icon={<CalendarDays size={17} />} label="赛程" onClick={() => setView("matches")} />
          <NavButton active={view === "ledger"} icon={<ClipboardList size={17} />} label="账本" onClick={() => setView("ledger")} />
          <NavButton active={view === "leaderboard"} icon={<Crown size={17} />} label="榜单" onClick={() => setView("leaderboard")} />
          <Link className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white" href="/rules">
            规则
          </Link>
          {isInsForgeConfigured ? (
            <button
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-ink ring-1 ring-ink/10"
              onClick={() => void signOut().then(refresh)}
              type="button"
            >
              <LogOut size={16} />
              退出
            </button>
          ) : null}
        </div>
      </header>

      {error ? <div className="mb-4 rounded-lg bg-coral/15 p-3 text-sm font-semibold text-ink">{error}</div> : null}
      {!isInsForgeConfigured ? (
        <div className="mb-4 rounded-lg bg-gold/20 p-3 text-sm font-semibold text-ink">
          当前使用示例数据。配置 `.env.local` 后会连接 InsForge 真实账本。
        </div>
      ) : null}

      {view === "dashboard" ? <Dashboard stats={stats} nextMatch={nextMatch} matches={state.matches} settlements={state.settlements} /> : null}
      {view === "matches" ? (
        <MatchesView
          currentPlayer={currentPlayer}
          matches={state.matches}
          players={state.players}
          predictions={state.predictions}
          selectedMatch={selectedMatch}
          settlements={state.settlements}
          onSelect={setSelectedMatchId}
          onSaved={refresh}
        />
      ) : null}
      {view === "ledger" ? <LedgerView matches={state.matches} players={state.players} predictions={state.predictions} settlements={state.settlements} /> : null}
      {view === "leaderboard" ? <LeaderboardView stats={stats} /> : null}
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 font-bold text-ink shadow-soft">
        <Loader2 className="animate-spin" size={18} />
        正在加载账本
      </div>
    </main>
  );
}

function LoginScreen({ onSignedIn, error }: { onSignedIn: () => void; error: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(error);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await signIn(email, password);
      onSignedIn();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form className="w-full max-w-md rounded-lg bg-white/90 p-6 shadow-soft ring-1 ring-ink/10" onSubmit={submit}>
        <div className="mb-6">
          <p className="text-sm font-semibold text-grass">Private Ledger</p>
          <h1 className="text-3xl font-black text-ink">登录竞猜账本</h1>
        </div>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold">邮箱</span>
          <input
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 outline-none focus:border-grass"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-bold">密码</span>
          <input
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 outline-none focus:border-grass"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        {message ? <p className="mb-3 rounded-md bg-coral/15 p-2 text-sm font-semibold">{message}</p> : null}
        <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-grass px-4 py-3 font-black text-white" disabled={busy} type="submit">
          {busy ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
          登录
        </button>
      </form>
    </main>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition",
        active ? "bg-grass text-white" : "bg-white text-ink ring-1 ring-ink/10",
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function Dashboard({
  stats,
  nextMatch,
  matches,
  settlements,
}: {
  stats: DashboardStats[];
  nextMatch: Match | null;
  matches: Match[];
  settlements: Settlement[];
}) {
  const finished = matches.filter((match) => match.status === "finished").length;
  const totalNet = settlements.reduce((sum, row) => sum + Math.max(row.netAmount, 0), 0);
  const leader = stats[0] ?? null;
  const drama = buildDramaState(stats);
  const runnerStats = normalizeRunnerStats(stats, drama.mode);
  const gap = stats.length > 1 ? Math.abs(stats[0].netAmount - stats[1].netAmount) : 0;
  const headline = leader && gap > 0 ? `${leader.displayName} 暂时领先 ${gap}r` : "现在打成平手";
  const todayMatches = matches.filter((match) => getBeijingDateKey(match.kickoffAt) === getBeijingDateKey(new Date()));

  return (
    <section className="grid gap-4">
      <div className="pixel-hero overflow-hidden rounded-lg p-5 shadow-soft ring-1 ring-ink/10 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md bg-white/75 px-3 py-2 text-xs font-black uppercase text-ink/70 ring-1 ring-ink/10">
              Pixel Derby
            </div>
            <h2 className="mt-4 text-3xl font-black text-ink sm:text-5xl">{headline}</h2>
            <p className="mt-3 max-w-2xl text-base font-bold leading-7 text-ink/70">
              今日战况亮起来了，下一场继续押上 10r。
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="已完赛" value={`${finished}/${matches.length}`} />
              <Metric label="已结算流动" value={formatMoney(totalNet)} />
              <Metric label="当前模式" value="标准 10r" />
            </div>
          </div>

          <PixelRace drama={drama} stats={runnerStats} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <DramaCard line={drama.line} />
        <TodayCalendar matches={todayMatches} />
      </div>

      <TournamentMap matches={matches} />

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg bg-white/88 p-5 shadow-soft ring-1 ring-ink/10">
          <p className="text-sm font-bold text-grass">下一场</p>
          <h2 className="mt-2 text-3xl font-black">{nextMatch ? `${nextMatch.homeTeam} vs ${nextMatch.awayTeam}` : "等待赛程导入"}</h2>
          {nextMatch ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="北京时间" value={formatFullBeijingTime(nextMatch.kickoffAt)} />
              <Metric label="阶段" value={stageLabel(nextMatch.stage)} />
              <Metric label="趣味题" value={funQuestions[nextMatch.funQuestionKey]} />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map((row) => (
            <PlayerStat key={row.playerId} row={row} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DramaCard({ line }: { line: string }) {
  return (
    <div className="rounded-lg bg-white/88 p-5 shadow-soft ring-1 ring-ink/10">
      <p className="text-sm font-bold text-coral">今日小剧场</p>
      <p className="mt-3 text-2xl font-black leading-snug text-ink">{line}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-mint">
        <div className="h-full w-2/3 rounded-full bg-coral/80" />
      </div>
    </div>
  );
}

function TodayCalendar({ matches }: { matches: Match[] }) {
  const sortedMatches = [...matches].sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

  return (
    <div className="pixel-calendar rounded-lg bg-white/88 p-5 shadow-soft ring-1 ring-ink/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-grass">今日赛程</p>
          <h3 className="text-2xl font-black text-ink">世界杯像素日历</h3>
        </div>
        <div className={clsx("pixel-calendar-icon", sortedMatches.length > 0 ? "has-match" : "is-rest")} aria-hidden="true" />
      </div>
      {sortedMatches.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {sortedMatches.slice(0, 5).map((match) => (
            <div className="pixel-calendar-row" key={match.id}>
              <span className="pixel-flag" aria-hidden="true" />
              <div>
                <p className="font-black">{match.homeTeam} vs {match.awayTeam}</p>
                <p className="text-sm font-bold text-ink/55">{formatBeijingClock(match.kickoffAt)} · {stageLabel(match.stage)}</p>
              </div>
              <StatusPill match={match} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-md bg-gold/20 p-4 ring-1 ring-gold/30">
          <p className="font-black">今天没有比赛，适合养精蓄锐。</p>
          <p className="mt-1 text-sm font-bold text-ink/60">下一次开球前，先攒一点玄学能量。</p>
        </div>
      )}
    </div>
  );
}

function TournamentMap({ matches }: { matches: Match[] }) {
  const groupMap = buildGroupMap(matches);
  const knockoutMap = buildKnockoutMap(matches);
  const totalFinished = matches.filter((match) => match.status === "finished").length;

  return (
    <div className="tournament-map rounded-lg bg-white/88 p-5 shadow-soft ring-1 ring-ink/10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-grass">世界杯地图</p>
          <h3 className="text-2xl font-black text-ink">小组赛与淘汰赛路线</h3>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-sm font-black text-white">
          <Map size={15} />
          {totalFinished}/{matches.length || 104}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-black text-ink">小组赛大陆</p>
            <span className="text-sm font-bold text-ink/55">A-L 组</span>
          </div>
          <div className="group-map-grid">
            {groupMap.map((group) => (
              <div className={clsx("group-map-cell", group.finished === group.total && group.total > 0 ? "is-complete" : null)} key={group.name}>
                <div className="pixel-map-flag" aria-hidden="true" />
                <div>
                  <p className="font-black">Group {group.name}</p>
                  <p className="text-xs font-bold text-ink/55">{group.finished}/{group.total || 6} 已完赛</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-black text-ink">淘汰赛航线</p>
            <span className="text-sm font-bold text-ink/55">一路到决赛</span>
          </div>
          <div className="knockout-route">
            {knockoutMap.map((stage, index) => (
              <div className="knockout-node" key={stage.key}>
                <div className={clsx("knockout-dot", stage.finished > 0 ? "has-progress" : null)}>{index + 1}</div>
                <div>
                  <p className="font-black">{stage.label}</p>
                  <p className="text-xs font-bold text-ink/55">{stage.finished}/{stage.totalDisplay} 已完赛</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildGroupMap(matches: Match[]) {
  const groupNames = "ABCDEFGHIJKL".split("");
  return groupNames.map((name) => {
    const groupMatches = matches.filter((match) => match.stage === "group" && match.groupName === name);
    return {
      name,
      total: groupMatches.length,
      finished: groupMatches.filter((match) => match.status === "finished").length,
    };
  });
}

function buildKnockoutMap(matches: Match[]) {
  const stages: Array<{ key: Match["stage"]; label: string; fallbackTotal: number }> = [
    { key: "round_of_32", label: "32 强", fallbackTotal: 16 },
    { key: "round_of_16", label: "16 强", fallbackTotal: 8 },
    { key: "quarter_final", label: "1/4 决赛", fallbackTotal: 4 },
    { key: "semi_final", label: "半决赛", fallbackTotal: 2 },
    { key: "third_place", label: "季军赛", fallbackTotal: 1 },
    { key: "final", label: "决赛", fallbackTotal: 1 },
  ];
  return stages.map((stage) => {
    const stageMatches = matches.filter((match) => match.stage === stage.key);
    return {
      ...stage,
      total: stageMatches.length,
      totalDisplay: stageMatches.length || stage.fallbackTotal,
      finished: stageMatches.filter((match) => match.status === "finished").length,
    };
  });
}

function normalizeRunnerStats(stats: DashboardStats[], mode: DramaMode) {
  const sorted = [...stats].sort((a, b) => b.netAmount - a.netAmount || b.points - a.points);
  if (sorted.length < 2) {
    return sorted.map((row) => ({ ...row, lane: 0, left: 48 }));
  }
  if (mode === "tie") {
    return sorted.map((row, index) => ({ ...row, lane: index, left: index === 0 ? 46 : 54 }));
  }
  if (mode === "close") {
    return sorted.map((row, index) => ({ ...row, lane: index, left: index === 0 ? 62 : 43 }));
  }
  if (mode === "breakaway") {
    return sorted.map((row, index) => ({ ...row, lane: index, left: index === 0 ? 74 : 24 }));
  }
  return sorted.map((row, index) => ({
    ...row,
    lane: index,
    left: 40 + index * 14,
  }));
}

function PixelRace({ stats, drama }: { stats: Array<DashboardStats & { lane: number; left: number }>; drama: DramaState }) {
  const ballStyle = getBallStyle(stats, drama);

  return (
    <div className="pixel-race" aria-label="情侣竞猜像素追逐动画">
      <div className="pixel-scoreboard">
        {stats.map((row) => (
          <div className="pixel-score" key={row.playerId}>
            <PixelAvatar row={row} size="small" />
            <span>{row.displayName}</span>
            <strong>{formatMoney(row.netAmount)}</strong>
          </div>
        ))}
      </div>
      <div className={clsx("pixel-track", `drama-${drama.mode}`)} aria-hidden="true">
        <div className="pixel-sun" />
        <div className="pixel-cloud pixel-cloud-one" />
        <div className="pixel-cloud pixel-cloud-two" />
        <div className="pixel-stand pixel-stand-left" />
        <div className="pixel-stand pixel-stand-right" />
        <div className="pixel-goal pixel-goal-left" />
        <div className="pixel-goal pixel-goal-right" />
        <div className="pixel-field-line pixel-half-line" />
        <div className="pixel-field-line pixel-box-left" />
        <div className="pixel-field-line pixel-box-right" />
        <div className="pixel-center-circle" />
        <div className="pixel-ball" style={ballStyle} />
        {stats.map((row) => (
          <div
            className={clsx("pixel-runner", row.playerId === drama.leaderId ? "is-leading" : "is-chasing", row.playerId === drama.trailerId ? "is-trailing" : null)}
            key={row.playerId}
            style={{ "--runner-left": `${row.left}%`, "--runner-top": `${42 + row.lane * 34}%` } as CSSProperties}
          >
            <div className="pixel-name-tag">{row.displayName}</div>
            {drama.mode === "close" && row.playerId === drama.trailerId ? <div className="pixel-var-board">VAR</div> : null}
            <PixelAvatar row={row} size="large" />
          </div>
        ))}
      </div>
    </div>
  );
}

function getBallStyle(stats: Array<DashboardStats & { lane: number; left: number }>, drama: DramaState) {
  if (drama.mode === "tie") {
    return { "--ball-left": "50%", "--ball-top": "67%" } as CSSProperties;
  }
  if (drama.mode === "close") {
    return { "--ball-left": "68%", "--ball-top": "58%" } as CSSProperties;
  }
  const leader = stats.find((row) => row.playerId === drama.leaderId);
  if (leader) {
    return { "--ball-left": `${Math.max(12, leader.left - 5)}%`, "--ball-top": `${50 + leader.lane * 28}%` } as CSSProperties;
  }
  return { "--ball-left": "50%", "--ball-top": "67%" } as CSSProperties;
}

function PixelAvatar({ row, size }: { row: DashboardStats; size: "small" | "large" }) {
  return (
    <div
      className={clsx("pixel-avatar", `pixel-avatar-${size}`, row.code === "player_a" ? "pixel-avatar-bb" : "pixel-avatar-jm")}
      style={{ "--avatar-color": row.avatarColor } as CSSProperties}
      title={row.displayName}
    >
      <span className="pixel-hair" />
      <span className="pixel-face" />
      <span className="pixel-eye pixel-eye-left" />
      <span className="pixel-eye pixel-eye-right" />
      <span className="pixel-cheek pixel-cheek-left" />
      <span className="pixel-cheek pixel-cheek-right" />
      <span className="pixel-shirt" />
      <span className="pixel-leg pixel-leg-left" />
      <span className="pixel-leg pixel-leg-right" />
    </div>
  );
}

function buildDramaState(stats: DashboardStats[]): DramaState {
  if (stats.length < 2) {
    return {
      line: "小剧场还在搭台，等第一场结算后开演。",
      mode: "empty",
      leaderId: null,
      trailerId: null,
    };
  }

  const [leader, trailer] = [...stats].sort((a, b) => b.netAmount - a.netAmount || b.points - a.points);
  const gap = leader.netAmount - trailer.netAmount;
  if (gap === 0) {
    return {
      line: "两人还在中场拉扯，下一场决定谁先破门。",
      mode: "tie",
      leaderId: null,
      trailerId: null,
    };
  }
  if (gap >= 20) {
    return {
      line: `${leader.displayName}正在带球狂奔，${trailer.displayName}准备在补时阶段抢回一球。`,
      mode: "breakaway",
      leaderId: leader.playerId,
      trailerId: trailer.playerId,
    };
  }
  return {
    line: `${leader.displayName}已经冲到禁区，${trailer.displayName}正在申请 VAR。`,
    mode: "close",
    leaderId: leader.playerId,
    trailerId: trailer.playerId,
  };
}

function getBeijingDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

function formatBeijingClock(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function MatchesView({
  currentPlayer,
  matches,
  players,
  predictions,
  selectedMatch,
  settlements,
  onSelect,
  onSaved,
}: {
  currentPlayer: Player | null;
  matches: Match[];
  players: Player[];
  predictions: Prediction[];
  selectedMatch: Match | null;
  settlements: Settlement[];
  onSelect: (matchId: string) => void;
  onSaved: () => void;
}) {
  const [stage, setStage] = useState("all");
  const visibleMatches = matches.filter((match) => stage === "all" || match.stage === stage);
  const matchPredictions = predictions.filter((prediction) => prediction.matchId === selectedMatch?.id);
  const matchSettlements = settlements.filter((settlement) => settlement.matchId === selectedMatch?.id);

  return (
    <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-lg bg-white/88 p-4 shadow-soft ring-1 ring-ink/10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">赛程</h2>
          <select className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-bold" onChange={(event) => setStage(event.target.value)} value={stage}>
            <option value="all">全部阶段</option>
            <option value="group">小组赛</option>
            <option value="round_of_32">32 强</option>
            <option value="round_of_16">16 强</option>
            <option value="quarter_final">1/4 决赛</option>
            <option value="semi_final">半决赛</option>
            <option value="final">决赛</option>
          </select>
        </div>
        <div className="grid max-h-[70vh] gap-2 overflow-auto pr-1">
          {visibleMatches.map((match) => (
            <button
              className={clsx(
                "rounded-md p-3 text-left ring-1 transition",
                selectedMatch?.id === match.id ? "bg-mint ring-grass" : "bg-white ring-ink/10 hover:bg-mint/50",
              )}
              key={match.id}
              onClick={() => onSelect(match.id)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3 text-xs font-bold text-ink/60">
                <span>#{match.matchNumber} {stageLabel(match.stage)}</span>
                <span>{formatBeijingTime(match.kickoffAt)}</span>
              </div>
              <p className="mt-1 text-base font-black">{match.homeTeam} vs {match.awayTeam}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg bg-white/88 p-4 shadow-soft ring-1 ring-ink/10">
        {selectedMatch ? (
          <MatchDetail
            currentPlayer={currentPlayer}
            match={selectedMatch}
            players={players}
            predictions={matchPredictions}
            settlements={matchSettlements}
            onSaved={onSaved}
          />
        ) : (
          <p className="font-bold">等待赛程导入</p>
        )}
      </div>
    </section>
  );
}

function MatchDetail({
  currentPlayer,
  match,
  players,
  predictions,
  settlements,
  onSaved,
}: {
  currentPlayer: Player | null;
  match: Match;
  players: Player[];
  predictions: Prediction[];
  settlements: Settlement[];
  onSaved: () => void;
}) {
  const ownPrediction = predictions.find((prediction) => prediction.playerId === currentPlayer?.id);
  const locked = isPredictionLocked(match, ownPrediction?.lockedAt ?? null);
  const roomState = buildMatchRoomState(match, predictions, players.length);
  const homeScore = match.homeScore90 === null ? "-" : `${match.homeScore90}`;
  const awayScore = match.awayScore90 === null ? "-" : `${match.awayScore90}`;

  return (
    <div className="grid gap-4">
      <div className="match-room overflow-hidden rounded-lg ring-1 ring-ink/10">
        <div className="match-room-sky">
          <div className="match-room-cloud match-room-cloud-one" />
          <div className="match-room-cloud match-room-cloud-two" />
          <div className="match-room-sun" />
        </div>
        <div className="match-room-board">
          <div>
            <p className="text-sm font-black text-grass">#{match.matchNumber} {stageLabel(match.stage)} · 赛前小房间</p>
            <h2 className="mt-1 text-2xl font-black text-ink sm:text-3xl">{match.homeTeam} vs {match.awayTeam}</h2>
            <p className="mt-1 text-sm font-bold text-ink/60">{match.venue ?? "待定场馆"} · 北京时间 {formatFullBeijingTime(match.kickoffAt)}</p>
          </div>
          <StatusPill match={match} />
        </div>
        <div className="match-room-field">
          <div className="match-room-score">
            <span>{match.homeTeam}</span>
            <strong>{homeScore} : {awayScore}</strong>
            <span>{match.awayTeam}</span>
          </div>
          <div className="match-room-center" />
          <div className="match-room-goal match-room-goal-left" />
          <div className="match-room-goal match-room-goal-right" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <RoomMetric icon={<Timer size={17} />} label="开球倒计时" value={roomState.countdown} />
        <RoomMetric icon={<CircleDollarSign size={17} />} label="本场赌注" value="双方各 10r" />
        <RoomMetric icon={<Users size={17} />} label="房间状态" value={roomState.status} />
      </div>
      <div className="rounded-lg bg-white/82 p-4 ring-1 ring-ink/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-coral">本场隐藏任务</p>
            <h3 className="mt-1 text-xl font-black text-ink">{funQuestions[match.funQuestionKey]}</h3>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-gold/25 px-3 py-1 text-sm font-black text-ink ring-1 ring-gold/35">
            <Sparkles size={15} />
            趣味题 +2 分
          </span>
        </div>
        <p className="mt-3 text-sm font-bold leading-6 text-ink/60">{roomState.line}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((player) => {
          const prediction = predictions.find((item) => item.playerId === player.id);
          const settlement = settlements.find((item) => item.playerId === player.id);
          return <PlayerRoomSeat key={player.id} match={match} player={player} prediction={prediction} settlement={settlement} />;
        })}
      </div>
      <PredictionForm currentPlayer={currentPlayer} locked={locked} match={match} prediction={ownPrediction} onSaved={onSaved} />
    </div>
  );
}

function RoomMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/82 p-3 ring-1 ring-ink/10">
      <div className="flex items-center gap-2 text-sm font-black text-ink/55">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-black text-ink">{value}</p>
    </div>
  );
}

function PlayerRoomSeat({
  match,
  player,
  prediction,
  settlement,
}: {
  match: Match;
  player: Player;
  prediction: Prediction | undefined;
  settlement: Settlement | undefined;
}) {
  const status = prediction ? (prediction.lockedAt || new Date(match.kickoffAt).getTime() <= Date.now() ? "已入座锁定" : "已保存草稿") : "等待下注";
  return (
    <div className="room-seat">
      <div className="flex items-center gap-3">
        <PixelAvatar row={playerAvatarRow(player)} size="small" />
        <div>
          <p className="text-sm font-black text-ink/55">观赛席</p>
          <h3 className="text-xl font-black" style={{ color: player.avatarColor }}>{player.displayName}</h3>
        </div>
        <span className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-black text-ink/65 ring-1 ring-ink/10">{status}</span>
      </div>
      <p className="mt-3 text-sm font-bold leading-6 text-ink/65">
        {prediction
          ? `押 ${pickResultLabel(prediction.pickResult, match)}，比分 ${match.homeTeam} ${prediction.predictedHomeScore}-${prediction.predictedAwayScore} ${match.awayTeam}，趣味题选${prediction.funAnswer ? "是" : "否"}。`
          : "还没交卷，房间里留着一张空白小纸条。"}
      </p>
      {settlement ? (
        <p className="mt-2 text-sm font-black text-ink">{settlement.points} 分 · {formatMoney(settlement.netAmount)}</p>
      ) : null}
    </div>
  );
}

function PredictionForm({
  currentPlayer,
  locked,
  match,
  prediction,
  onSaved,
}: {
  currentPlayer: Player | null;
  locked: boolean;
  match: Match;
  prediction: Prediction | undefined;
  onSaved: () => void;
}) {
  const [pickResult, setPickResult] = useState(prediction?.pickResult ?? "home");
  const [homeScore, setHomeScore] = useState(prediction?.predictedHomeScore ?? 1);
  const [awayScore, setAwayScore] = useState(prediction?.predictedAwayScore ?? 1);
  const [funAnswer, setFunAnswer] = useState(prediction?.funAnswer ?? true);
  const [winner, setWinner] = useState(prediction?.predictedWinnerTeam ?? match.homeTeam);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPickResult(prediction?.pickResult ?? "home");
    setHomeScore(prediction?.predictedHomeScore ?? 1);
    setAwayScore(prediction?.predictedAwayScore ?? 1);
    setFunAnswer(prediction?.funAnswer ?? true);
    setWinner(prediction?.predictedWinnerTeam ?? match.homeTeam);
  }, [match.id, match.homeTeam, prediction]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPlayer) {
      setMessage("当前用户未绑定玩家。");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await savePrediction({
        id: prediction?.id,
        matchId: match.id,
        playerId: currentPlayer.id,
        pickResult,
        predictedHomeScore: homeScore,
        predictedAwayScore: awayScore,
        funAnswer,
        predictedWinnerTeam: match.stage === "group" ? null : winner,
      });
      onSaved();
      setMessage("已保存");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    if (!prediction?.id) {
      setMessage("请先保存下注。");
      return;
    }
    setBusy(true);
    try {
      await lockPrediction(prediction.id);
      onSaved();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "锁定失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-4 rounded-md bg-mint/55 p-4 ring-1 ring-grass/20" onSubmit={submit}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black">我的下注</h3>
        {locked ? <span className="inline-flex items-center gap-1 text-sm font-bold text-ink/65"><Lock size={15} /> 已锁定</span> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">胜平负</span>
          <select className="w-full rounded-md border border-ink/15 bg-white px-3 py-2" disabled={locked} onChange={(event) => setPickResult(event.target.value as Prediction["pickResult"])} value={pickResult}>
            <option value="home">{match.homeTeam} 胜</option>
            <option value="draw">平局</option>
            <option value="away">{match.awayTeam} 胜</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">{match.homeTeam} 进球</span>
          <select className="w-full rounded-md border border-ink/15 bg-white px-3 py-2" disabled={locked} onChange={(event) => setHomeScore(Number(event.target.value))} value={homeScore}>
            {goalOptions.map((goal) => (
              <option key={goal} value={goal}>
                {goal}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">{match.awayTeam} 进球</span>
          <select className="w-full rounded-md border border-ink/15 bg-white px-3 py-2" disabled={locked} onChange={(event) => setAwayScore(Number(event.target.value))} value={awayScore}>
            {goalOptions.map((goal) => (
              <option key={goal} value={goal}>
                {goal}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">趣味题</span>
          <select className="w-full rounded-md border border-ink/15 bg-white px-3 py-2" disabled={locked} onChange={(event) => setFunAnswer(event.target.value === "yes")} value={funAnswer ? "yes" : "no"}>
            <option value="yes">是</option>
            <option value="no">否</option>
          </select>
        </label>
        {match.stage !== "group" ? (
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-bold">晋级球队</span>
            <select className="w-full rounded-md border border-ink/15 bg-white px-3 py-2" disabled={locked} onChange={(event) => setWinner(event.target.value)} value={winner}>
              <option value={match.homeTeam}>{match.homeTeam}</option>
              <option value={match.awayTeam}>{match.awayTeam}</option>
            </select>
          </label>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-sm font-bold text-ink/70">{message}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="inline-flex items-center gap-2 rounded-md bg-grass px-4 py-2 font-black text-white disabled:opacity-50" disabled={busy || locked} type="submit">
          {busy ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
          保存
        </button>
        <button className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 font-black text-white disabled:opacity-50" disabled={busy || locked || !prediction?.id} onClick={() => void lock()} type="button">
          <Lock size={17} />
          锁定
        </button>
      </div>
    </form>
  );
}

function pickResultLabel(pickResult: Prediction["pickResult"], match: Match) {
  if (pickResult === "home") return `${match.homeTeam} 胜`;
  if (pickResult === "away") return `${match.awayTeam} 胜`;
  return "平局";
}

function playerAvatarRow(player: Player): DashboardStats {
  return {
    playerId: player.id,
    code: player.code,
    displayName: player.displayName,
    avatarColor: player.avatarColor,
    points: 0,
    netAmount: 0,
    exactScores: 0,
    funHits: 0,
    streakBadges: 0,
  };
}

function buildMatchRoomState(match: Match, predictions: Prediction[], playerCount: number) {
  const kickoffTime = new Date(match.kickoffAt).getTime();
  const now = Date.now();
  const savedCount = predictions.length;
  const lockedCount = predictions.filter((prediction) => prediction.lockedAt !== null || now >= kickoffTime).length;
  const allSaved = playerCount > 0 && savedCount >= playerCount;
  const allLocked = playerCount > 0 && lockedCount >= playerCount;

  if (match.status === "finished") {
    return {
      countdown: "比赛已完赛",
      status: "故事已结算",
      line: "这间小房间已经熄灯，比分和趣味题都写进账本里了。",
    };
  }
  if (match.status === "live") {
    return {
      countdown: "比赛进行中",
      status: "房门已锁",
      line: "比赛已经开踢，现在只能等终场哨声和自动结算。",
    };
  }
  if (now >= kickoffTime) {
    return {
      countdown: "等待赛果",
      status: "房门已锁",
      line: "开球时间已过，下注入口关闭，接下来等同步赛果。",
    };
  }

  const countdown = formatCountdown(kickoffTime - now);
  if (allLocked) {
    return {
      countdown,
      status: "双方已锁定",
      line: "两张小纸条都已经封进信封，等开球后一起拆剧情。",
    };
  }
  if (allSaved) {
    return {
      countdown,
      status: "双方已保存",
      line: "双方都已经交卷，想更有仪式感的话可以开球前手动锁定。",
    };
  }
  return {
    countdown,
    status: `${savedCount}/${Math.max(playerCount, 1)} 已下注`,
    line: "房间里还留着空座位，开球前记得把胜平负、比分和趣味题都填好。",
  };
}

function formatCountdown(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${minutes} 分钟`;
}

function buildLedgerStory(match: Match, players: Player[], predictions: Prediction[], settlements: Settlement[]) {
  const sortedSettlements = [...settlements].sort((a, b) => b.netAmount - a.netAmount || b.points - a.points);
  const winnerSettlement = sortedSettlements[0];
  const loserSettlement = sortedSettlements[sortedSettlements.length - 1];
  const winner = players.find((player) => player.id === winnerSettlement?.playerId);
  const loser = players.find((player) => player.id === loserSettlement?.playerId);
  const exactPlayers = settlements
    .filter((settlement) => settlement.exactScoreBonus > 0)
    .map((settlement) => players.find((player) => player.id === settlement.playerId)?.displayName)
    .filter(Boolean);
  const funPlayers = settlements
    .filter((settlement) => settlement.funPoints > 0)
    .map((settlement) => players.find((player) => player.id === settlement.playerId)?.displayName)
    .filter(Boolean);
  const pointGap = sortedSettlements.length >= 2 ? sortedSettlements[0].points - sortedSettlements[1].points : 0;
  const bothPredicted = players.length > 0 && predictions.length >= players.length;

  if (!winnerSettlement || !winner || winnerSettlement.netAmount === 0 || pointGap === 0) {
    return {
      title: `${match.homeTeam} vs ${match.awayTeam}`,
      badge: "握手言和",
      line: bothPredicted
        ? "这一场没有人真正拉开差距，两张赛前纸条在账本里打成平手。"
        : "这一场留下了结算记录，但赛前纸条不完整，剧情暂时温柔收场。",
    };
  }

  const highlight = exactPlayers.length > 0
    ? `${exactPlayers.join("、")} 抓到了精确比分，直接把奖励写进账本。`
    : funPlayers.length > 0
      ? `${funPlayers.join("、")} 在趣味题上偷到关键分。`
      : "胜平负和比分走势决定了这一场的走向。";

  return {
    title: `${winner.displayName} 小赢一幕`,
    badge: formatMoney(winnerSettlement.netAmount),
    line: `${winner.displayName} 从这场带走 ${formatMoney(winnerSettlement.netAmount)}，${loser?.displayName ?? "对手"} 暂时把账记下。${highlight}`,
  };
}

function LedgerView({
  matches,
  players,
  predictions,
  settlements,
}: {
  matches: Match[];
  players: Player[];
  predictions: Prediction[];
  settlements: Settlement[];
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const rows = matches
    .map((match) => ({
      match,
      predictions: predictions.filter((item) => item.matchId === match.id),
      settlements: settlements.filter((item) => item.matchId === match.id),
    }))
    .filter((row) => row.settlements.length > 0);
  const badgeSummaries = buildBadgeSummaries(players, matches, settlements);
  const badgeCatalogs = buildBadgeCatalogs(players, matches, settlements);

  return (
    <section className="grid gap-4">
      <div className="rounded-lg bg-white/88 p-5 shadow-soft ring-1 ring-ink/10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-coral">情侣称号</p>
            <h2 className="text-2xl font-black text-ink">本届世界杯身份牌</h2>
          </div>
          <span className="rounded-full bg-mint px-3 py-1 text-sm font-black text-ink ring-1 ring-grass/20">动态生成</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {badgeSummaries.map((summary) => (
            <div className="ledger-title-card" key={summary.player.id}>
              <div className="flex items-center gap-3">
                <PixelAvatar row={summary.stat} size="small" />
                <div>
                  <p className="text-sm font-bold text-ink/55">{summary.player.displayName}</p>
                  <h3 className="text-2xl font-black text-ink">{summary.primaryTitle}</h3>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {summary.badges.map((badge) => (
                  <span className="ledger-badge" key={badge.name}>
                    <span className="ledger-badge-mark" aria-hidden="true" />
                    {badge.name}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm font-bold leading-6 text-ink/60">{summary.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-white/88 p-5 shadow-soft ring-1 ring-ink/10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-grass">徽章图鉴</p>
            <h2 className="text-2xl font-black text-ink">情侣称号收藏册</h2>
          </div>
          <button
            aria-expanded={catalogOpen}
            className="inline-flex items-center gap-2 rounded-full bg-gold/25 px-3 py-1 text-sm font-black text-ink ring-1 ring-gold/35 transition hover:bg-gold/35"
            onClick={() => setCatalogOpen((open) => !open)}
            type="button"
          >
            <Medal size={15} />
            {catalogOpen ? "收起图鉴" : "展开图鉴"}
            <ChevronDown className={clsx("transition-transform", catalogOpen ? "rotate-180" : null)} size={15} />
          </button>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {badgeCatalogs.map((catalog) => (
            <div className="badge-catalog-summary" key={catalog.player.id}>
              <div>
                <p className="text-sm font-black" style={{ color: catalog.player.avatarColor }}>{catalog.player.displayName}</p>
                <p className="text-xs font-bold text-ink/55">已解锁 {catalog.unlockedCount}/{catalog.items.length}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-ink/10">
                <div className="h-full rounded-full bg-grass" style={{ width: `${catalog.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className={clsx("grid gap-4 lg:grid-cols-2", catalogOpen ? null : "hidden")}>
          {badgeCatalogs.map((catalog) => (
            <div className="badge-catalog-panel" key={catalog.player.id}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <PixelAvatar row={catalog.stat} size="small" />
                  <div>
                    <p className="text-sm font-bold text-ink/55">{catalog.player.displayName}</p>
                    <h3 className="text-xl font-black text-ink">{catalog.unlockedCount}/{catalog.items.length} 已解锁</h3>
                  </div>
                </div>
                <div className="badge-progress-ring" style={{ "--badge-progress": `${catalog.progress}%` } as CSSProperties}>
                  {catalog.progress}%
                </div>
              </div>
              <div className="badge-catalog-grid">
                {catalog.items.map((badge) => (
                  <div className={clsx("badge-card", badge.unlocked ? "is-unlocked" : "is-locked")} key={badge.name}>
                    <div className="badge-pixel-icon" aria-hidden="true" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-ink">{badge.name}</p>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[0.68rem] font-black text-ink/55 ring-1 ring-ink/10">{badge.rarity}</span>
                      </div>
                      <p className="mt-1 text-xs font-bold leading-5 text-ink/55">{badge.note}</p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-ink/10">
                        <div className="h-full rounded-full bg-grass" style={{ width: `${badge.progress}%` }} />
                      </div>
                      <p className="mt-1 text-xs font-black text-ink/50">{badge.progressText}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-white/88 p-5 shadow-soft ring-1 ring-ink/10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-grass">故事账本</p>
            <h2 className="text-2xl font-black text-ink">每场比赛的小剧本</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-sm font-black text-white">
            <Flag size={15} />
            {rows.length} 场已写入
          </span>
        </div>
        <div className="ledger-storyline">
          {rows.map(({ match, predictions: matchPredictions, settlements: matchSettlements }) => {
            const story = buildLedgerStory(match, players, matchPredictions, matchSettlements);
            return (
              <article className="ledger-story-card" key={match.id}>
                <div className="ledger-story-dot" aria-hidden="true" />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-coral">第 {match.matchNumber} 幕 · {stageLabel(match.stage)}</p>
                    <h3 className="mt-1 text-2xl font-black text-ink">{story.title}</h3>
                    <p className="mt-2 text-sm font-bold text-ink/55">{formatFullBeijingTime(match.kickoffAt)} · {match.venue ?? "待定场馆"}</p>
                  </div>
                  <span className="rounded-full bg-mint px-3 py-1 text-sm font-black text-ink ring-1 ring-grass/20">{story.badge}</span>
                </div>
                <div className="mt-4 rounded-lg bg-white/72 p-4 ring-1 ring-ink/10">
                  <p className="text-lg font-black text-ink">{match.homeTeam} {match.homeScore90}-{match.awayScore90} {match.awayTeam}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-ink/65">{story.line}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-ink/55">隐藏任务：{funQuestions[match.funQuestionKey]} 答案是 {match.funQuestionAnswer === null ? "待确认" : match.funQuestionAnswer ? "是" : "否"}。</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {players.map((player) => {
                    const settlement = matchSettlements.find((item) => item.playerId === player.id);
                    const prediction = matchPredictions.find((item) => item.playerId === player.id);
                    return <SettlementDetail key={player.id} match={match} player={player} prediction={prediction} settlement={settlement} />;
                  })}
                </div>
              </article>
            );
          })}
          {rows.length === 0 ? <p className="font-bold text-ink/60">暂无已结算比赛。</p> : null}
        </div>
      </div>
    </section>
  );
}

function SettlementDetail({
  match,
  player,
  prediction,
  settlement,
}: {
  match: Match;
  player: Player;
  prediction: Prediction | undefined;
  settlement: Settlement | undefined;
}) {
  if (!settlement) {
    return (
      <div className="rounded-md bg-mint/35 p-3 ring-1 ring-ink/10">
        <p className="font-black" style={{ color: player.avatarColor }}>{player.displayName}</p>
        <p className="mt-2 text-sm font-bold text-ink/55">未结算</p>
      </div>
    );
  }

  const detailRows = [
    { label: "胜平负", value: settlement.resultPoints, suffix: "分" },
    { label: "比分", value: settlement.scorePoints, suffix: "分" },
    { label: "趣味题", value: settlement.funPoints, suffix: "分" },
    { label: "晋级", value: settlement.advancePoints, suffix: "分" },
    { label: "精确比分奖励", value: settlement.exactScoreBonus, suffix: "r" },
  ];

  return (
    <div className="rounded-md bg-mint/35 p-3 ring-1 ring-ink/10">
      <div className="flex items-center justify-between gap-3">
        <p className="font-black" style={{ color: player.avatarColor }}>{player.displayName}</p>
        <span className="font-black">{settlement.points} 分 · {formatMoney(settlement.netAmount)}</span>
      </div>
      <p className="mt-2 text-sm font-bold leading-6 text-ink/60">
        {prediction
          ? `赛前纸条：${pickResultLabel(prediction.pickResult, match)}，${match.homeTeam} ${prediction.predictedHomeScore}-${prediction.predictedAwayScore} ${match.awayTeam}，趣味题选${prediction.funAnswer ? "是" : "否"}。`
          : "赛前纸条缺席。"}
      </p>
      <div className="mt-3 grid gap-2">
        {detailRows.map(({ label, value, suffix }) => (
          <div className="ledger-score-row" key={label}>
            <span>{label}</span>
            <strong>{value > 0 ? `+${value}${suffix}` : `0${suffix}`}</strong>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-bold text-ink/45">结算时间 {formatFullBeijingTime(settlement.settledAt)}</p>
    </div>
  );
}

type LedgerBadge = {
  name: string;
  note: string;
  priority: number;
};

type BadgeCatalogItem = LedgerBadge & {
  unlocked: boolean;
  progress: number;
  progressText: string;
  rarity: string;
};

function buildBadgeSummaries(players: Player[], matches: Match[], settlements: Settlement[]) {
  const stats = buildStats(players, settlements);

  return players.map((player) => {
    const stat = stats.find((item) => item.playerId === player.id) ?? {
      playerId: player.id,
      code: player.code,
      displayName: player.displayName,
      avatarColor: player.avatarColor,
      points: 0,
      netAmount: 0,
      exactScores: 0,
      funHits: 0,
      streakBadges: 0,
    };
    const catalog = buildPlayerBadgeCatalog(player, stat, matches, settlements, stats);
    const badges = catalog.filter((badge) => badge.unlocked);
    if (badges.length === 0) {
      badges.push({
        name: "等待开球",
        note: "第一场结算后称号就会出现。",
        priority: 1,
        unlocked: true,
        progress: 0,
        progressText: "0/1",
        rarity: "初始",
      });
    }

    const sortedBadges = badges.sort((a, b) => b.priority - a.priority);
    const primaryTitle = sortedBadges[0]?.name ?? "等待开球";
    const supportingBadges = sortedBadges
      .filter((badge) => badge.name !== primaryTitle)
      .slice(0, 6);

    return {
      player,
      stat,
      primaryTitle,
      badges: supportingBadges.length > 0 ? supportingBadges : [{ name: "待解锁新徽章", note: "下一场可能就来了。", priority: 0 }],
      note: sortedBadges[0]?.note ?? "第一场结算后称号就会出现。",
    };
  });
}

function buildBadgeCatalogs(players: Player[], matches: Match[], settlements: Settlement[]) {
  const stats = buildStats(players, settlements);
  return players.map((player) => {
    const stat = stats.find((item) => item.playerId === player.id) ?? playerAvatarRow(player);
    const items = buildPlayerBadgeCatalog(player, stat, matches, settlements, stats);
    const unlockedCount = items.filter((badge) => badge.unlocked).length;
    const progress = Math.round((unlockedCount / Math.max(items.length, 1)) * 100);
    return {
      player,
      stat,
      items,
      unlockedCount,
      progress,
    };
  });
}

function buildPlayerBadgeCatalog(
  player: Player,
  stat: DashboardStats,
  matches: Match[],
  settlements: Settlement[],
  allStats: DashboardStats[],
): BadgeCatalogItem[] {
  const ownSettlements = settlements.filter((settlement) => settlement.playerId === player.id);
  const matchById = Object.fromEntries(matches.map((match) => [match.id, match]));
  const highestNet = Math.max(...allStats.map((item) => item.netAmount), 0);
  const highestFunHits = Math.max(...allStats.map((item) => item.funHits), 0);
  const resultPoints = ownSettlements.reduce((sum, settlement) => sum + settlement.resultPoints, 0);
  const scoreHits = ownSettlements.filter((settlement) => settlement.scorePoints > 0).length;
  const scoreNearHits = ownSettlements.filter((settlement) => settlement.scorePoints > 0 && settlement.exactScoreBonus === 0).length;
  const advanceHits = ownSettlements.filter((settlement) => settlement.advancePoints > 0).length;
  const firstSettlement = [...ownSettlements].sort((a, b) => new Date(a.settledAt).getTime() - new Date(b.settledAt).getTime())[0];
  const funHitsByKey = (key: Match["funQuestionKey"]) =>
    ownSettlements.filter((settlement) => matchById[settlement.matchId]?.funQuestionKey === key && settlement.funPoints > 0).length;
  const positiveWins = ownSettlements.filter((settlement) => settlement.netAmount > 0).length;

  const makeBadge = (
    name: string,
    note: string,
    priority: number,
    value: number,
    target: number,
    rarity: string,
    unlockedOverride?: boolean,
  ): BadgeCatalogItem => {
    const unlocked = unlockedOverride ?? value >= target;
    return {
      name,
      note,
      priority,
      unlocked,
      progress: Math.min(100, Math.round((Math.max(value, 0) / Math.max(target, 1)) * 100)),
      progressText: unlocked ? "已解锁" : `${Math.max(value, 0)}/${target}`,
      rarity,
    };
  };

  return [
    makeBadge("比分预言家", "精确比分命中 1 次。", 100, stat.exactScores, 1, "稀有"),
    makeBadge("三分拆弹手", "精确比分命中 3 次。", 98, stat.exactScores, 3, "史诗"),
    makeBadge("玄学大师", "趣味题命中 3 次。", 95, stat.funHits, 3, "稀有", stat.funHits > 0 && stat.funHits === highestFunHits),
    makeBadge("隐藏任务达人", "趣味题命中 5 次。", 92, stat.funHits, 5, "史诗"),
    makeBadge("反向球王", "累计净赢小于 0。", 88, stat.netAmount < 0 ? 1 : 0, 1, "剧情", stat.netAmount < 0),
    makeBadge("点球猎人", "点球趣味题命中 1 次。", 84, funHitsByKey("penalty_goal"), 1, "稀有"),
    makeBadge("补时心碎者", "比分擦边命中但没精确 1 次。", 80, scoreNearHits, 1, "剧情"),
    makeBadge("净赢领跑者", "当前净赢排名第一。", 76, stat.netAmount > 0 && stat.netAmount === highestNet ? 1 : 0, 1, "闪耀", stat.netAmount > 0 && stat.netAmount === highestNet),
    makeBadge("稳胆专家", "胜平负累计拿到 4 分。", 72, resultPoints, 4, "常见"),
    makeBadge("火眼金睛", "比分项拿分 1 次。", 68, scoreHits, 1, "常见"),
    makeBadge("连胜小火苗", "获得三连胜徽章 1 次。", 64, stat.streakBadges, 1, "稀有"),
    makeBadge("淘汰赛导演", "淘汰赛晋级球队猜中 1 次。", 60, advanceHits, 1, "史诗"),
    makeBadge("开门红", "第一笔结算净赢为正。", 56, firstSettlement?.netAmount && firstSettlement.netAmount > 0 ? 1 : 0, 1, "剧情", Boolean(firstSettlement && firstSettlement.netAmount > 0)),
    makeBadge("零封守门员", "零封趣味题命中 1 次。", 52, funHitsByKey("clean_sheet"), 1, "稀有"),
    makeBadge("补时雷达", "75 分钟后进球趣味题命中 1 次。", 48, funHitsByKey("late_goal_after_75"), 1, "稀有"),
    makeBadge("乌龙雷达", "乌龙球趣味题命中 1 次。", 44, funHitsByKey("own_goal"), 1, "稀有"),
    makeBadge("黄牌侦探", "黄牌 4+ 趣味题命中 1 次。", 40, funHitsByKey("yellow_cards_4_plus"), 1, "稀有"),
    makeBadge("小金库开张", "净赢场次达到 2 场。", 36, positiveWins, 2, "常见"),
  ];
}

function LeaderboardView({ stats }: { stats: DashboardStats[] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      {stats.map((row, index) => (
        <div className="rounded-lg bg-white/88 p-5 shadow-soft ring-1 ring-ink/10" key={row.playerId}>
          <p className="text-sm font-bold text-grass">第 {index + 1} 名</p>
          <h2 className="mt-1 text-3xl font-black">{row.displayName}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="积分" value={`${row.points}`} />
            <Metric label="净赢" value={formatMoney(row.netAmount)} />
            <Metric label="精确比分" value={`${row.exactScores}`} />
            <Metric label="三连胜" value={`${row.streakBadges}`} />
          </div>
        </div>
      ))}
    </section>
  );
}

function PlayerStat({ row }: { row: DashboardStats }) {
  return (
    <div className="rounded-lg bg-white/88 p-5 shadow-soft ring-1 ring-ink/10">
      <div className="flex items-center gap-3">
        <PixelAvatar row={row} size="small" />
        <div>
          <p className="text-sm font-bold text-grass">玩家</p>
          <h2 className="text-2xl font-black">{row.displayName}</h2>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="累计积分" value={`${row.points}`} />
        <Metric label="累计净赢" value={formatMoney(row.netAmount)} />
        <Metric label="精确比分" value={`${row.exactScores}`} />
        <Metric label="趣味题命中" value={`${row.funHits}`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-ink/50">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-ink">{value}</p>
    </div>
  );
}

function StatusPill({ match }: { match: Match }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-3 py-1 text-sm font-black text-white">
      <CircleDollarSign size={15} />
      {matchStatusText(match)}
    </span>
  );
}

function matchStatusText(match: Match) {
  if (match.status === "finished") return "已完赛";
  if (match.status === "live") return "进行中";
  if (match.status === "postponed") return "延期";
  if (match.status === "cancelled") return "取消";
  return "未开始";
}

function buildStats(players: Player[], settlements: Settlement[]): DashboardStats[] {
  return players
    .map((player) => {
      const own = settlements.filter((settlement) => settlement.playerId === player.id);
      return {
        playerId: player.id,
        code: player.code,
        displayName: player.displayName,
        avatarColor: player.avatarColor,
        points: own.reduce((sum, settlement) => sum + settlement.points, 0),
        netAmount: own.reduce((sum, settlement) => sum + settlement.netAmount, 0),
        exactScores: own.filter((settlement) => settlement.exactScoreBonus > 0).length,
        funHits: own.filter((settlement) => settlement.funPoints > 0).length,
        streakBadges: own.filter((settlement) => settlement.streakBadge).length,
      };
    })
    .sort((a, b) => b.points - a.points || b.netAmount - a.netAmount);
}
