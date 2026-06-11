"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Crown,
  Loader2,
  Lock,
  LogOut,
  Save,
  ShieldCheck,
  Trophy,
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
      const [user, players, matches, predictions, settlements] = await Promise.all([
        getSessionUser(),
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
      {view === "ledger" ? <LedgerView matches={state.matches} players={state.players} settlements={state.settlements} /> : null}
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
  return (
    <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
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
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
        <MetricCard label="已完赛" value={`${finished}/${matches.length}`} />
        <MetricCard label="已结算流动" value={formatMoney(totalNet)} />
        <MetricCard label="当前模式" value="标准 10r" />
      </div>
      <div className="grid gap-4 lg:col-span-2 sm:grid-cols-2">
        {stats.map((row) => (
          <PlayerStat key={row.playerId} row={row} />
        ))}
      </div>
    </section>
  );
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

  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-ink/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-grass">{stageLabel(match.stage)} · 北京时间 {formatFullBeijingTime(match.kickoffAt)}</p>
          <h2 className="text-2xl font-black">{match.homeTeam} vs {match.awayTeam}</h2>
          <p className="mt-1 text-sm font-semibold text-ink/65">{match.venue ?? "待定场馆"} · {funQuestions[match.funQuestionKey]}</p>
        </div>
        <StatusPill match={match} />
      </div>
      <PredictionForm currentPlayer={currentPlayer} locked={locked} match={match} prediction={ownPrediction} onSaved={onSaved} />
      <div className="mt-5 grid gap-3">
        {players.map((player) => {
          const prediction = predictions.find((item) => item.playerId === player.id);
          const settlement = settlements.find((item) => item.playerId === player.id);
          return <PredictionSummary key={player.id} match={match} player={player} prediction={prediction} settlement={settlement} />;
        })}
      </div>
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

function PredictionSummary({
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
  return (
    <div className="rounded-md bg-white p-3 ring-1 ring-ink/10">
      <div className="flex items-center justify-between gap-3">
        <p className="font-black" style={{ color: player.avatarColor }}>{player.displayName}</p>
        {settlement ? <span className="font-black">{settlement.points} 分 · {formatMoney(settlement.netAmount)}</span> : <span className="text-sm font-bold text-ink/50">未结算</span>}
      </div>
      <p className="mt-1 text-sm font-semibold text-ink/65">
        {prediction
          ? `选择 ${pickResultLabel(prediction.pickResult, match)}，${match.homeTeam} ${prediction.predictedHomeScore} - ${prediction.predictedAwayScore} ${match.awayTeam}，趣味题 ${prediction.funAnswer ? "是" : "否"}`
          : "尚未下注"}
      </p>
    </div>
  );
}

function pickResultLabel(pickResult: Prediction["pickResult"], match: Match) {
  if (pickResult === "home") return `${match.homeTeam} 胜`;
  if (pickResult === "away") return `${match.awayTeam} 胜`;
  return "平局";
}

function LedgerView({ matches, players, settlements }: { matches: Match[]; players: Player[]; settlements: Settlement[] }) {
  const rows = matches
    .map((match) => ({ match, settlements: settlements.filter((item) => item.matchId === match.id) }))
    .filter((row) => row.settlements.length > 0);
  return (
    <section className="rounded-lg bg-white/88 p-4 shadow-soft ring-1 ring-ink/10">
      <h2 className="mb-4 text-xl font-black">结算账本</h2>
      <div className="grid gap-3">
        {rows.map(({ match, settlements: matchSettlements }) => (
          <div className="rounded-md bg-white p-3 ring-1 ring-ink/10" key={match.id}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-black">#{match.matchNumber} {match.homeTeam} {match.homeScore90}-{match.awayScore90} {match.awayTeam}</p>
              <span className="text-sm font-bold text-ink/60">{stageLabel(match.stage)}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {players.map((player) => {
                const settlement = matchSettlements.find((item) => item.playerId === player.id);
                return (
                  <div className="rounded-md bg-mint/40 px-3 py-2" key={player.id}>
                    <span className="font-bold">{player.displayName}</span>
                    <span className="float-right font-black">{settlement ? `${settlement.points} 分 · ${formatMoney(settlement.netAmount)}` : "未结算"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {rows.length === 0 ? <p className="font-bold text-ink/60">暂无已结算比赛。</p> : null}
      </div>
    </section>
  );
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
      <p className="text-sm font-bold text-grass">玩家</p>
      <h2 className="text-2xl font-black">{row.displayName}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Metric label="累计积分" value={`${row.points}`} />
        <Metric label="累计净赢" value={formatMoney(row.netAmount)} />
        <Metric label="精确比分" value={`${row.exactScores}`} />
        <Metric label="趣味题命中" value={`${row.funHits}`} />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/88 p-4 shadow-soft ring-1 ring-ink/10">
      <Metric label={label} value={value} />
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
  const label = match.status === "finished" ? "已完赛" : match.status === "live" ? "进行中" : "未开始";
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-3 py-1 text-sm font-black text-white">
      <CircleDollarSign size={15} />
      {label}
    </span>
  );
}

function buildStats(players: Player[], settlements: Settlement[]): DashboardStats[] {
  return players
    .map((player) => {
      const own = settlements.filter((settlement) => settlement.playerId === player.id);
      return {
        playerId: player.id,
        displayName: player.displayName,
        points: own.reduce((sum, settlement) => sum + settlement.points, 0),
        netAmount: own.reduce((sum, settlement) => sum + settlement.netAmount, 0),
        exactScores: own.filter((settlement) => settlement.exactScoreBonus > 0).length,
        funHits: own.filter((settlement) => settlement.funPoints > 0).length,
        streakBadges: own.filter((settlement) => settlement.streakBadge).length,
      };
    })
    .sort((a, b) => b.points - a.points || b.netAmount - a.netAmount);
}
