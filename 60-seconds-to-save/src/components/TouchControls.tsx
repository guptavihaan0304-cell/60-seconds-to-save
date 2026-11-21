import { useRef, useState } from 'react';
import { computeJoystickVector } from '../game/rules';
import { DashBoltIcon, MagnetPulseIcon } from './GameIcons';

interface TouchControlsProps {
  empJammedSeconds: number;
  interactReady: boolean;
  dashReady: boolean;
  exhausted: boolean;
  onJoystickMove: (x: number, y: number) => void;
  onDash: () => void;
  onInteract: () => void;
}

const MAX_KNOB_TRAVEL = 40;

export function TouchControls({
  empJammedSeconds,
  interactReady,
  dashReady,
  exhausted,
  onJoystickMove,
  onDash,
  onInteract,
}: TouchControlsProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const isJammed = empJammedSeconds > 0;

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const rawDx = clientX - cx;
    const rawDy = clientY - cy;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(dist, MAX_KNOB_TRAVEL);
    const kx = dist > 0.001 ? (rawDx / dist) * clampedDist : 0;
    const ky = dist > 0.001 ? (rawDy / dist) * clampedDist : 0;

    setKnobOffset({ x: kx, y: ky });
    const vec = computeJoystickVector(rawDx, rawDy, MAX_KNOB_TRAVEL, 0.14);
    onJoystickMove(vec.x, vec.y);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
    updateFromClient(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateFromClient(e.clientX, e.clientY);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    activePointerId.current = null;
    setActive(false);
    setKnobOffset({ x: 0, y: 0 });
    onJoystickMove(0, 0);
  };

  return (
    <div className="flex items-end justify-between w-full mt-auto gap-3">
      {/* Bottom-Left Virtual Joystick (visible on mobile/tablet; keyboard/mouse still work everywhere) */}
      <div className="lg:hidden pointer-events-auto flex flex-col items-start gap-1">
        <div
          ref={baseRef}
          data-testid="virtual-joystick"
          role="application"
          aria-label="Movement virtual joystick"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className={`relative w-[112px] h-[112px] rounded-full border-2 flex items-center justify-center touch-none select-none transition-colors ${
            active ? 'border-orange-400/80' : 'border-slate-500/45'
          }`}
          style={{
            backgroundColor: 'rgba(12, 20, 33, 0.72)',
            boxShadow: '0 6px 20px rgba(4, 8, 16, 0.55)',
          }}
        >
          {/* Subtle cardinal direction ticks */}
          <span className="absolute top-2.5 w-1.5 h-1.5 rounded-full bg-slate-500/70" aria-hidden="true" />
          <span className="absolute bottom-2.5 w-1.5 h-1.5 rounded-full bg-slate-500/70" aria-hidden="true" />
          <span className="absolute left-2.5 w-1.5 h-1.5 rounded-full bg-slate-500/70" aria-hidden="true" />
          <span className="absolute right-2.5 w-1.5 h-1.5 rounded-full bg-slate-500/70" aria-hidden="true" />

          {/* Responsive thumb knob */}
          <div
            data-testid="joystick-knob"
            className={`w-12 h-12 rounded-full border-2 transition-colors pointer-events-none ${
              active
                ? 'bg-orange-500/90 border-orange-200'
                : 'bg-slate-700/90 border-slate-400/75'
            }`}
            style={{
              transform: `translate3d(${knobOffset.x.toFixed(1)}px, ${knobOffset.y.toFixed(1)}px, 0)`,
              boxShadow: '0 4px 12px rgba(4, 8, 16, 0.65)',
            }}
          />
        </div>
      </div>

      {/* Desktop bottom-left spacer so action buttons remain right-aligned */}
      <div className="hidden lg:block" />

      {/* Bottom-Right Ergonomic Action Buttons: INTERACT + DASH */}
      <div className="pointer-events-auto flex items-end gap-2.5 sm:gap-3">
        <button
          type="button"
          tabIndex={-1}
          data-testid="btn-interact"
          aria-label={isJammed ? 'Interact jammed by EMP' : 'Interact magnet pulse'}
          disabled={isJammed}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.blur();
            onInteract();
          }}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-w-[74px] sm:min-w-[118px] h-[58px] sm:h-12 px-3 sm:px-4 rounded-xl sm:rounded-lg border font-display font-bold tracking-wide uppercase transition-transform cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-white ${
            isJammed
              ? 'bg-purple-950/85 border-purple-400/60 text-purple-200 opacity-85 cursor-not-allowed'
              : interactReady
              ? 'bg-sky-600/95 hover:bg-sky-500 active:scale-95 border-sky-300/70 text-white'
              : 'bg-slate-800/90 border-slate-600/60 text-slate-400'
          }`}
          style={{
            boxShadow: !isJammed && interactReady ? '0 4px 16px rgba(14, 165, 233, 0.35)' : '0 4px 12px rgba(4, 8, 16, 0.5)',
          }}
        >
          <MagnetPulseIcon />
          <span className="text-sm sm:text-base leading-none whitespace-nowrap">
            {isJammed ? `JAM ${empJammedSeconds.toFixed(0)}s` : 'Interact'}
          </span>
          <span className="hidden sm:inline font-mono-num text-[11px] font-semibold opacity-85">
            [E]
          </span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          data-testid="btn-dash"
          aria-label={isJammed ? 'Dash jammed by EMP' : 'Dash and vault'}
          disabled={isJammed}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.blur();
            onDash();
          }}
          className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-w-[82px] sm:min-w-[126px] h-[64px] sm:h-12 px-3.5 sm:px-4 rounded-xl sm:rounded-lg border font-display font-extrabold tracking-wide uppercase transition-transform cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-white ${
            isJammed
              ? 'bg-purple-950/85 border-purple-400/60 text-purple-200 opacity-85 cursor-not-allowed'
              : exhausted
              ? 'bg-slate-800/90 border-amber-500/50 text-amber-300'
              : dashReady
              ? 'bg-[#F97316] hover:bg-[#FB923C] active:scale-95 border-orange-300/80 text-slate-950'
              : 'bg-orange-950/85 border-orange-500/50 text-orange-200'
          }`}
          style={{
            boxShadow:
              !isJammed && !exhausted && dashReady
                ? '0 4px 18px rgba(249, 115, 22, 0.45)'
                : '0 4px 12px rgba(4, 8, 16, 0.5)',
          }}
        >
          <DashBoltIcon />
          <span className="text-base sm:text-lg leading-none whitespace-nowrap">
            {isJammed ? `JAM ${empJammedSeconds.toFixed(0)}s` : 'Dash'}
          </span>
          <span className="hidden sm:inline font-mono-num text-[11px] font-semibold opacity-80">
            [SPACE]
          </span>
        </button>
      </div>
    </div>
  );
}
