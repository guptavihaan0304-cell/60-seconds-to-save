import { PERK_SPECS } from '../game/rules';
import type { PerkId, RunRank, RunSummary } from '../game/types';
import { CheckMarkIcon, RescueKindIcon, SoundIcon, TitleEmblem } from './GameIcons';

interface TitleOverlayProps {
  bestScore: number;
  muted: boolean;
  selectedPerk: PerkId;
  onSelectPerk: (perk: PerkId) => void;
  onPlay: () => void;
  onToggleMute: () => void;
}

const PERK_ORDER: PerkId[] = ['fast_runner', 'wide_pickup', 'extra_time'];

export function TitleOverlay({
  bestScore,
  muted,
  selectedPerk,
  onSelectPerk,
  onPlay,
  onToggleMute,
}: TitleOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col items-center justify-between p-4 sm:p-7 overflow-y-auto"
      style={{
        background:
          'radial-gradient(circle at 50% 48%, rgba(9, 16, 28, 0.94) 0%, rgba(9, 16, 28, 0.74) 55%, rgba(9, 16, 28, 0.88) 100%)',
      }}
    >
      {/* Top-right sound button */}
      <div className="w-full flex justify-end shrink-0">
        <button
          type="button"
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          aria-pressed={muted}
          onClick={onToggleMute}
          className="flex items-center gap-2 px-3.5 h-10 sm:h-11 rounded-lg border border-slate-600/50 text-xs font-semibold text-slate-200 hover:border-slate-400 active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-orange-500"
          style={{ backgroundColor: 'rgba(12, 20, 33, 0.92)' }}
        >
          <SoundIcon muted={muted} />
          <span className="whitespace-nowrap">{muted ? 'Sound Off' : 'Sound On'}</span>
        </button>
      </div>

      {/* Center Negative-Space Title Composition */}
      <main className="flex flex-col items-center text-center max-w-xl w-full my-auto py-3 gap-4 sm:gap-5">
        <TitleEmblem />

        <p className="text-xs sm:text-base text-slate-200 leading-relaxed max-w-md hud-text-shadow px-1">
          Rescue stranded targets and return them to the Safe Zone before time runs out—chain consecutive saves for streak multipliers while managing stamina and escalating arena events.
        </p>

        {/* 3 Target Variants Inline Legend */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-300">
          <div className="flex items-center gap-1.5">
            <RescueKindIcon kind="normal" size={15} />
            <span>Civilian · 100</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RescueKindIcon kind="fast" size={15} />
            <span>Fast Scout · 200</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RescueKindIcon kind="golden" size={15} />
            <span>Heavy Gold · 350</span>
          </div>
        </div>

        {/* Pre-Game Perk Choice (1 of 3 tactile buttons) */}
        <div className="w-full max-w-md flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Choose Mission Perk
          </span>
          <div
            role="radiogroup"
            aria-label="Choose Mission Perk"
            className="grid grid-cols-3 gap-2"
          >
            {PERK_ORDER.map((perkId) => {
              const perk = PERK_SPECS[perkId];
              const active = selectedPerk === perkId;
              return (
                <button
                  key={perkId}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelectPerk(perkId)}
                  className={`flex flex-col items-center justify-center px-2 py-2.5 rounded-lg border text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-orange-400 ${
                    active
                      ? 'bg-orange-500/20 border-orange-400 text-slate-50'
                      : 'bg-slate-900/85 border-slate-700/80 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="text-xs sm:text-sm font-bold leading-tight">
                    {perk.name}
                  </span>
                  <span
                    className={`text-[10px] sm:text-[11px] mt-0.5 leading-tight ${
                      active ? 'text-orange-300 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {perk.benefit}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5 mt-0.5">
          <button
            type="button"
            data-start="true"
            onClick={onPlay}
            className="px-12 h-13 sm:h-14 rounded-lg bg-[#F97316] hover:bg-[#FB923C] active:scale-95 text-slate-950 font-display text-2xl font-extrabold tracking-wider uppercase transition-transform cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ boxShadow: '0 8px 28px rgba(249, 115, 22, 0.45)' }}
          >
            Play
          </button>

          {bestScore > 0 && (
            <div className="text-xs sm:text-sm font-medium text-slate-300">
              Best Score <span aria-hidden="true">·</span>{' '}
              <span className="font-mono-num font-bold text-emerald-400">
                {bestScore.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Flat borderless bottom control hint */}
      <footer className="text-[11px] sm:text-sm text-slate-400 text-center tracking-wide hud-text-shadow shrink-0 pt-2">
        WASD / Joystick Move · Space Dash · E Interact · P Pause · M Mute
      </footer>
    </div>
  );
}

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export function PauseModal({ onResume, onRestart, onTitle }: PauseModalProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 11, 20, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-600/50 p-6 flex flex-col gap-5 text-center"
        style={{
          backgroundColor: '#101A2B',
          boxShadow: '0 18px 48px rgba(0, 0, 0, 0.65)',
        }}
      >
        <div>
          <h2 id="pause-title" className="font-display text-3xl font-extrabold uppercase tracking-wide text-slate-50">
            Paused
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Extraction timer halted. Ready to redeploy?
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full h-12 rounded-lg bg-[#F97316] hover:bg-[#FB923C] text-slate-950 font-display text-xl font-extrabold uppercase tracking-wide transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full h-11 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/50 text-slate-100 text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-orange-400"
          >
            Restart Run
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="w-full h-11 rounded-lg text-slate-400 hover:text-slate-100 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-orange-400"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}

const RANK_STYLE: Record<RunRank, { text: string; border: string; bg: string }> = {
  S: { text: 'text-amber-300', border: 'border-amber-400/70', bg: 'bg-amber-500/15' },
  A: { text: 'text-emerald-300', border: 'border-emerald-400/70', bg: 'bg-emerald-500/15' },
  B: { text: 'text-sky-300', border: 'border-sky-400/70', bg: 'bg-sky-500/15' },
  C: { text: 'text-slate-300', border: 'border-slate-500/70', bg: 'bg-slate-700/25' },
};

interface GameOverModalProps {
  summary: RunSummary;
  onPlayAgain: () => void;
  onTitle: () => void;
}

export function GameOverModal({ summary, onPlayAgain, onTitle }: GameOverModalProps) {
  const isVictory = summary.outcome === 'victory';
  const heading = isVictory ? 'Extraction Complete' : 'Mission Failed';
  const subline =
    summary.reason === 'hull_breach'
      ? `Hull breached at ${summary.timeSurvived.toFixed(1)}s.`
      : summary.reason === 'none_saved'
      ? 'Time expired before any targets reached the Safe Zone.'
      : `Survived the full ${Math.round(summary.duration)}s window.`;

  const rankStyle = RANK_STYLE[summary.rank];

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(6, 11, 20, 0.84)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-600/50 p-5 sm:p-6 flex flex-col gap-4 my-auto"
        style={{
          backgroundColor: '#101A2B',
          boxShadow: '0 20px 56px rgba(0, 0, 0, 0.72)',
        }}
      >
        {/* Header + Post-Game Rank */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-left">
            <h2
              id="gameover-title"
              className={`font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-wide leading-none ${
                isVictory ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {heading}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">{subline}</p>
          </div>

          <div
            data-testid="summary-rank"
            aria-label={`Rank ${summary.rank}`}
            className={`flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 shrink-0 ${rankStyle.bg} ${rankStyle.border}`}
          >
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300 leading-none">
              Rank
            </span>
            <span className={`font-display text-3xl sm:text-4xl font-extrabold leading-none ${rankStyle.text}`}>
              {summary.rank}
            </span>
          </div>
        </div>

        {/* Score & Best Local High Score */}
        <div className="grid grid-cols-2 gap-3 border-y border-slate-700/70 py-3">
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Final Score
            </span>
            <span
              data-testid="summary-score"
              className="font-mono-num text-2xl sm:text-3xl font-bold text-slate-50 mt-0.5"
            >
              {summary.finalScore.toLocaleString()}
            </span>
            {summary.isNewBest && (
              <span className="text-[11px] font-bold text-amber-400">New High Score!</span>
            )}
          </div>

          <div className="flex flex-col items-center border-l border-slate-700/70">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Best Local Score
            </span>
            <span
              data-testid="summary-best"
              className="font-mono-num text-2xl sm:text-3xl font-bold text-emerald-400 mt-0.5"
            >
              {summary.bestScore.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">Saved locally</span>
          </div>
        </div>

        {/* 3 Target Variants Breakdown */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Targets Saved</span>
            <span className="font-mono-num text-slate-200">
              Total: {summary.savedTotal} · Max Streak: {summary.maxStreak}x
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-slate-200">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900/75 border border-slate-800">
              <div className="flex items-center gap-1.5">
                <RescueKindIcon kind="normal" size={15} />
                <span>Civ</span>
              </div>
              <span className="font-mono-num font-bold text-sky-400">{summary.breakdown.normal}</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900/75 border border-slate-800">
              <div className="flex items-center gap-1.5">
                <RescueKindIcon kind="fast" size={15} />
                <span>Fast</span>
              </div>
              <span className="font-mono-num font-bold text-emerald-400">{summary.breakdown.fast}</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900/75 border border-slate-800">
              <div className="flex items-center gap-1.5">
                <RescueKindIcon kind="golden" size={15} />
                <span>Gold</span>
              </div>
              <span className="font-mono-num font-bold text-amber-400">{summary.breakdown.golden}</span>
            </div>
          </div>
        </div>

        {/* 3 Mini-Challenges */}
        <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Mission Challenges
          </span>
          <ul className="flex flex-col gap-1.5">
            {summary.challenges.map((ch) => (
              <li
                key={ch.id}
                className="flex items-center justify-between gap-2 text-xs text-slate-200"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckMarkIcon done={ch.completed} />
                  <span className={ch.completed ? 'text-emerald-300 font-medium' : 'text-slate-300'}>
                    {ch.label}
                  </span>
                </div>
                <span className="font-mono-num text-[11px] text-slate-400 shrink-0">
                  {ch.completed ? 'DONE' : ch.progressText}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Instant Replay Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="w-full h-12 rounded-lg bg-[#F97316] hover:bg-[#FB923C] active:scale-95 text-slate-950 font-display text-2xl font-extrabold uppercase tracking-wide transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
            style={{ boxShadow: '0 6px 22px rgba(249, 115, 22, 0.35)' }}
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="w-full h-9 rounded-lg text-slate-400 hover:text-slate-100 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-orange-400"
          >
            Back to Title
          </button>
        </div>
      </div>
    </div>
  );
}
