import type { RescueKind } from '../game/types';

export function TitleEmblem() {
  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 select-none">
      <svg
        width="64"
        height="64"
        viewBox="0 0 76 76"
        fill="none"
        aria-hidden="true"
        className="w-14 h-14 sm:w-[72px] sm:h-[72px] drop-shadow-[0_6px_18px_rgba(4,8,16,0.75)]"
      >
        <polygon
          points="24,4 52,4 72,24 72,52 52,72 24,72 4,52 4,24"
          fill="#0F1826"
          stroke="#F97316"
          strokeWidth="3"
        />
        <rect x="31" y="0" width="14" height="5" rx="1.5" fill="#F97316" />
        <circle
          cx="38"
          cy="38"
          r="24"
          stroke="#10B981"
          strokeWidth="2.5"
          strokeDasharray="16 6"
        />
        <rect x="33" y="23" width="10" height="30" rx="1.5" fill="#F8FAFC" />
        <rect x="23" y="33" width="30" height="10" rx="1.5" fill="#F8FAFC" />
        <circle cx="38" cy="38" r="4" fill="#F97316" />
      </svg>

      <div className="flex flex-col items-center">
        <div className="flex items-baseline gap-2 leading-none">
          <span
            className="font-display text-5xl sm:text-7xl font-extrabold tracking-tight text-[#F97316] hud-text-shadow"
            style={{ paintOrder: 'stroke fill', WebkitTextStroke: '2.5px #09101C' }}
          >
            60
          </span>
          <h1
            className="font-display text-4xl sm:text-6xl font-extrabold tracking-wide text-slate-50 uppercase hud-text-shadow"
            style={{ paintOrder: 'stroke fill', WebkitTextStroke: '2px #09101C' }}
          >
            Seconds to Save
          </h1>
        </div>
        <svg width="200" height="8" viewBox="0 0 240 8" fill="none" aria-hidden="true" className="mt-1.5">
          <line x1="0" y1="4" x2="88" y2="4" stroke="#33475F" strokeWidth="2" />
          <polygon points="96,4 102,1 138,1 144,4 138,7 102,7" fill="#10B981" />
          <line x1="152" y1="4" x2="240" y2="4" stroke="#33475F" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}

export function HullPipIcon({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polygon
        points="12,2 21,6.5 21,14.5 12,22 3,14.5 3,6.5"
        fill={filled ? '#10B981' : '#0B1220'}
        stroke={filled ? '#A7F3D0' : '#475569'}
        strokeWidth="2"
      />
      {filled && <polygon points="12,5.5 17.5,8.5 12,11 6.5,8.5" fill="#6EE7B7" opacity="0.85" />}
    </svg>
  );
}

export function RescueKindIcon({ kind, size = 18 }: { kind: RescueKind; size?: number }) {
  if (kind === 'normal') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="#0F172A" stroke="#38BDF8" strokeWidth="2.5" />
        <circle cx="12" cy="12" r="4" fill="#38BDF8" />
      </svg>
    );
  }
  if (kind === 'fast') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <polygon
          points="21,12 5,4 9,12 5,20"
          fill="#064E3B"
          stroke="#34D399"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="13" cy="12" r="2.5" fill="#A7F3D0" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polygon
        points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8"
        fill="#451A03"
        stroke="#FBBF24"
        strokeWidth="2.4"
      />
      <circle cx="12" cy="12" r="4.2" fill="#FDE047" />
    </svg>
  );
}

export function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9.5H8.2L13.5 5V19L8.2 14.5H4V9.5Z"
        fill={muted ? '#64748B' : '#F8FAFC'}
        stroke="#0F172A"
        strokeWidth="1.2"
      />
      {muted ? (
        <path d="M16.5 9L21 15M21 9L16.5 15" stroke="#F87171" strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <>
          <path d="M16.5 8.5C17.8 9.8 17.8 14.2 16.5 15.5" stroke="#34D399" strokeWidth="2" strokeLinecap="round" />
          <path d="M19.2 6C21.6 8.5 21.6 15.5 19.2 18" stroke="#34D399" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="5" width="4.5" height="14" rx="1" fill="#F8FAFC" />
      <rect x="13.5" y="5" width="4.5" height="14" rx="1" fill="#F8FAFC" />
    </svg>
  );
}

export function DashBoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polygon points="13,2 4,14 11,14 10,22 20,10 13,10" fill="currentColor" />
    </svg>
  );
}

export function MagnetPulseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
      <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.5" opacity="0.65" />
    </svg>
  );
}

export function CheckMarkIcon({ done }: { done: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="8"
        fill={done ? '#10B981' : '#0B1220'}
        stroke={done ? '#34D399' : '#475569'}
        strokeWidth="1.8"
      />
      {done && (
        <path
          d="M6.2 10.2L8.8 12.8L14 7.5"
          stroke="#06281E"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
