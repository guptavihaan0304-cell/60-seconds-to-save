import type { RefObject } from 'react';
import type { HudSnapshot } from '../game/types';
import { HullPipIcon, PauseIcon, RescueKindIcon, SoundIcon } from './GameIcons';
import { TouchControls } from './TouchControls';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onJoystickMove: (x: number, y: number) => void;
  onDash: () => void;
  onInteract: () => void;
  timerRef: RefObject<HTMLSpanElement | null>;
  staminaFillRef: RefObject<HTMLDivElement | null>;
  staminaGhostRef: RefObject<HTMLDivElement | null>;
  staminaLabelRef: RefObject<HTMLSpanElement | null>;
}

export function GameHud({
  hud,
  muted,
  onToggleMute,
  onPause,
  onJoystickMove,
  onDash,
  onInteract,
  timerRef,
  staminaFillRef,
  staminaGhostRef,
  staminaLabelRef,
}: GameHudProps) {
  const staminaStateText = hud.exhausted
    ? 'EXHAUSTED'
    : hud.inFire
    ? 'HEAT DRAIN'
    : hud.isRegenerating
    ? 'RECOVERING'
    : 'STAMINA';

  const staminaBarColor = hud.exhausted
    ? 'bg-rose-500'
    : hud.inFire
    ? 'bg-orange-500'
    : hud.isRegenerating
    ? 'bg-emerald-400'
    : 'bg-sky-400';

  return (
    <div className="fixed inset-0 pointer-events-none z-10 flex flex-col justify-between p-2 sm:p-4">
      {/* Top Arcade HUD Cluster — Optimized for Mobile (390px) & Desktop (1440px) */}
      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex items-start justify-between gap-1.5 sm:gap-3 w-full">
          {/* Left Cluster: Score, Saved, Hull & Streak */}
          <div
            className="pointer-events-auto flex items-center gap-2.5 sm:gap-4 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-slate-600/40"
            style={{
              backgroundColor: 'rgba(12, 20, 33, 0.92)',
              boxShadow: '0 4px 16px rgba(4, 8, 16, 0.55)',
            }}
          >
            <div className="flex flex-col leading-none">
              <span className="text-[9px] sm:text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Score
              </span>
              <span
                data-testid="hud-score"
                className="font-mono-num text-base sm:text-2xl font-bold text-slate-50 hud-text-shadow"
              >
                {Math.round(hud.score).toLocaleString()}
              </span>
            </div>

            <div className="h-6 sm:h-7 w-px bg-slate-700/70" aria-hidden="true" />

            <div className="flex flex-col leading-none">
              <span className="text-[9px] sm:text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Saved
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <RescueKindIcon kind="normal" size={14} />
                <span
                  data-testid="hud-saved"
                  className="font-mono-num text-base sm:text-2xl font-bold text-emerald-400 hud-text-shadow"
                >
                  {hud.savedTotal}
                </span>
                {hud.carryingCount > 0 && (
                  <span className="font-mono-num text-[11px] sm:text-xs font-bold text-amber-300">
                    +{hud.carryingCount}
                  </span>
                )}
              </div>
            </div>

            <div className="hidden md:block h-7 w-px bg-slate-700/70" aria-hidden="true" />

            {/* Desktop Hull Pips */}
            <div
              className="hidden md:flex flex-col leading-none gap-1"
              aria-label={`Hull integrity ${hud.hull} of ${hud.maxHull}`}
            >
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Hull
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: hud.maxHull }, (_, idx) => (
                  <HullPipIcon key={idx} filled={idx < hud.hull} size={18} />
                ))}
              </div>
            </div>

            {hud.streakMultiplier > 1 && (
              <>
                <div className="hidden sm:block h-7 w-px bg-slate-700/70" aria-hidden="true" />
                <div className="hidden sm:flex flex-col leading-none">
                  <span className="text-[10px] font-semibold tracking-wider text-amber-400 uppercase">
                    Streak
                  </span>
                  <span
                    data-testid="hud-streak"
                    className="font-mono-num text-xl font-bold text-amber-300"
                  >
                    {hud.streakMultiplier}x
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Center Cluster: Prominent 60.0s Countdown Timer & Phase/Event */}
          <div
            className="pointer-events-auto flex flex-col items-center px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg border border-slate-600/45 min-w-[96px] sm:min-w-[148px]"
            style={{
              backgroundColor: 'rgba(12, 20, 33, 0.94)',
              boxShadow: '0 4px 16px rgba(4, 8, 16, 0.6)',
            }}
          >
            <span
              ref={timerRef}
              data-testid="hud-timer"
              data-urgency="normal"
              className="font-mono-num text-xl sm:text-4xl font-bold leading-none tracking-tight text-slate-50 data-[urgency=frozen]:text-sky-300 data-[urgency=warning]:text-amber-400 data-[urgency=critical]:text-rose-400 hud-text-shadow"
            >
              60.0s
            </span>
            <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-[11px] font-medium text-slate-400 whitespace-nowrap">
              <span>P{hud.phase}/4</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-200 max-w-[96px] sm:max-w-none truncate">
                {hud.activeEventLabel ?? hud.phaseLabel}
              </span>
            </div>
          </div>

          {/* Right Cluster: Compact Square Utility Controls (Mute [M], Pause [P]) */}
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              aria-pressed={muted}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg border border-slate-600/50 text-slate-100 hover:border-slate-400 active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-orange-500"
              style={{
                backgroundColor: 'rgba(12, 20, 33, 0.92)',
                boxShadow: '0 4px 14px rgba(4, 8, 16, 0.5)',
              }}
              title="Mute / Unmute (M)"
            >
              <SoundIcon muted={muted} />
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause game"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-lg border border-slate-600/50 text-slate-100 hover:border-slate-400 active:scale-95 transition-transform cursor-pointer focus-visible:outline-2 focus-visible:outline-orange-500"
              style={{
                backgroundColor: 'rgba(12, 20, 33, 0.92)',
                boxShadow: '0 4px 14px rgba(4, 8, 16, 0.5)',
              }}
              title="Pause (P / Esc)"
            >
              <PauseIcon />
            </button>
          </div>
        </div>

        {/* Always-Visible Stamina Bar & Compact Status Row (Desktop + Mobile) */}
        <div className="flex items-center justify-between gap-2 w-full">
          <div
            data-testid="hud-stamina"
            className="pointer-events-auto flex items-center gap-2.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-600/40 w-[210px] sm:w-[248px]"
            style={{ backgroundColor: 'rgba(12, 20, 33, 0.9)' }}
          >
            <span
              className={`text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${
                hud.exhausted
                  ? 'text-rose-400'
                  : hud.isRegenerating
                  ? 'text-emerald-400'
                  : hud.inFire
                  ? 'text-orange-400'
                  : 'text-slate-300'
              }`}
            >
              {staminaStateText}
            </span>

            <div className="relative flex-1 h-2.5 rounded-sm bg-slate-900 border border-slate-700 overflow-hidden">
              <div
                ref={staminaGhostRef}
                className="absolute inset-0 bg-amber-300/75 origin-left"
                style={{ transform: 'scaleX(1)' }}
              />
              <div
                ref={staminaFillRef}
                className={`absolute inset-0 origin-left transition-colors ${staminaBarColor}`}
                style={{ transform: 'scaleX(1)' }}
              />
            </div>

            <span
              ref={staminaLabelRef}
              data-testid="hud-stamina-value"
              className="font-mono-num text-[11px] font-bold text-slate-200 w-9 text-right"
            >
              100%
            </span>
          </div>

          {/* Mobile Hull + Active Power-Ups / Streak Status */}
          <div className="flex items-center gap-2">
            {/* Active Buffs / EMP Alert (plain crisp inline text) */}
            {(hud.hasShield || hud.speedBoostSeconds > 0 || hud.freezeSeconds > 0 || hud.empJammedSeconds > 0 || (hud.streakMultiplier > 1)) && (
              <div
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-600/40 text-[11px] font-mono-num font-bold whitespace-nowrap"
                style={{ backgroundColor: 'rgba(12, 20, 33, 0.9)' }}
              >
                {hud.streakMultiplier > 1 && (
                  <span className="sm:hidden text-amber-300">{hud.streakMultiplier}x STRK</span>
                )}
                {hud.hasShield && <span className="text-emerald-400">SHIELD</span>}
                {hud.speedBoostSeconds > 0 && (
                  <span className="text-sky-400">SPD {hud.speedBoostSeconds}s</span>
                )}
                {hud.freezeSeconds > 0 && (
                  <span className="text-sky-200">FRZ {hud.freezeSeconds}s</span>
                )}
                {hud.empJammedSeconds > 0 && (
                  <span className="text-purple-300">EMP {hud.empJammedSeconds.toFixed(1)}s</span>
                )}
              </div>
            )}

            {/* Mobile Hull Sockets */}
            <div
              className="md:hidden flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-600/40"
              style={{ backgroundColor: 'rgba(12, 20, 33, 0.9)' }}
              aria-label={`Hull integrity ${hud.hull} of ${hud.maxHull}`}
            >
              {Array.from({ length: hud.maxHull }, (_, idx) => (
                <HullPipIcon key={idx} filled={idx < hud.hull} size={15} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transient 15-Second Event / Phase Banner Alert */}
      {hud.bannerText && (
        <div className="self-center mt-1.5 px-2 max-w-full">
          <div
            className="px-3.5 py-1.5 rounded border border-amber-400/55 font-display text-sm sm:text-lg font-bold tracking-wider text-amber-300 uppercase text-center hud-text-shadow"
            style={{ backgroundColor: 'rgba(15, 23, 35, 0.92)' }}
          >
            {hud.bannerText}
          </div>
        </div>
      )}

      {/* Bottom Perimeter Controls: Virtual Joystick (Mobile/Tablet) + Action Buttons */}
      <TouchControls
        empJammedSeconds={hud.empJammedSeconds}
        interactReady={hud.interactCooldownPct >= 1}
        dashReady={hud.dashCooldownPct >= 1}
        exhausted={hud.exhausted}
        onJoystickMove={onJoystickMove}
        onDash={onDash}
        onInteract={onInteract}
      />
    </div>
  );
}
