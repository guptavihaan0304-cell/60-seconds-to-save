import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameOverModal, PauseModal, TitleOverlay } from './components/OverlayModals';
import { RescueGameEngine } from './game/engine';
import { DEFAULT_DURATION_SECONDS, MAX_CARRY_ITEMS, MAX_HULL, readStoredBestScore } from './game/rules';
import type { GameScreenState, HudSnapshot, PerkId, RunSummary } from './game/types';

function getQueryDuration(): number {
  if (typeof window === 'undefined') return DEFAULT_DURATION_SECONDS;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('time');
  if (!raw) return DEFAULT_DURATION_SECONDS;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 3 || parsed > 180) {
    return DEFAULT_DURATION_SECONDS;
  }
  return parsed;
}

function shouldAutostart(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

function getQueryPhase(): 1 | 2 | 3 | 4 {
  if (typeof window === 'undefined') return 1;
  const raw = new URLSearchParams(window.location.search).get('phase');
  if (raw === '2') return 2;
  if (raw === '3') return 3;
  if (raw === '4') return 4;
  return 1;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<RescueGameEngine | null>(null);

  const timerRef = useRef<HTMLSpanElement | null>(null);
  const staminaFillRef = useRef<HTMLDivElement | null>(null);
  const staminaGhostRef = useRef<HTMLDivElement | null>(null);
  const staminaLabelRef = useRef<HTMLSpanElement | null>(null);

  const [screenState, setScreenState] = useState<GameScreenState>('title');
  const [selectedPerk, setSelectedPerk] = useState<PerkId>('fast_runner');
  const selectedPerkRef = useRef<PerkId>('fast_runner');
  selectedPerkRef.current = selectedPerk;

  const [muted, setMuted] = useState<boolean>(false);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(() => ({
    score: 0,
    savedTotal: 0,
    carryingCount: 0,
    maxCarry: MAX_CARRY_ITEMS,
    comboMultiplier: 1.0,
    streakCount: 0,
    streakMultiplier: 1.0,
    hull: MAX_HULL,
    maxHull: MAX_HULL,
    phase: 1,
    phaseLabel: 'Seismic Breach',
    activeEventLabel: null,
    bannerText: null,
    inFire: false,
    inSafeZone: true,
    exhausted: false,
    isRegenerating: false,
    empJammedSeconds: 0,
    interactCooldownPct: 1,
    dashCooldownPct: 1,
    hasShield: false,
    speedBoostSeconds: 0,
    freezeSeconds: 0,
    bestScore: readStoredBestScore(),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new RescueGameEngine(
      canvas,
      {
        onScreenChange: (next) => setScreenState(next),
        onHudChange: (nextHud) => setHud(nextHud),
        onRunEnd: (runSummary) => setSummary(runSummary),
      },
      getQueryDuration(),
      getQueryPhase()
    );
    engineRef.current = engine;
    setMuted(engine.audio.isMuted());

    if (shouldAutostart()) {
      engine.startNewRun(selectedPerkRef.current, false);
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (screenState === 'playing' && engineRef.current) {
      engineRef.current.setHudRefs({
        timerEl: timerRef.current,
        staminaFillEl: staminaFillRef.current,
        staminaGhostEl: staminaGhostRef.current,
        staminaLabelEl: staminaLabelRef.current,
      });
    }
  }, [screenState]);

  const handlePlay = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setSummary(null);
    engineRef.current?.startNewRun(selectedPerkRef.current, true);
    canvasRef.current?.focus();
  }, []);

  const handleToggleMute = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const nextMuted = engine.audio.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resume();
    canvasRef.current?.focus();
  }, []);

  const handleTitle = useCallback(() => {
    setSummary(null);
    engineRef.current?.returnToTitle();
  }, []);

  const handleJoystickMove = useCallback((x: number, y: number) => {
    engineRef.current?.setJoystickVector(x, y);
  }, []);

  const handleDash = useCallback(() => {
    engineRef.current?.triggerDashInput();
  }, []);

  const handleInteract = useCallback(() => {
    engineRef.current?.triggerInteractInput();
  }, []);

  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }
      if ((e.code === 'Enter' || e.code === 'Space') && (screenState === 'title' || screenState === 'gameover')) {
        e.preventDefault();
        handlePlay();
      } else if (e.code === 'KeyR' && (screenState === 'paused' || screenState === 'gameover')) {
        e.preventDefault();
        handlePlay();
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [screenState, handlePlay, handleToggleMute]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#09101C]">
      <div className="fixed inset-0 w-full h-full">
        <canvas
          ref={canvasRef}
          data-testid="game-canvas"
          tabIndex={0}
          aria-label="60 Seconds to Save game arena"
          className="block w-full h-full outline-none cursor-crosshair"
        />
      </div>

      {(screenState === 'playing' || screenState === 'paused') && (
        <GameHud
          hud={hud}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onJoystickMove={handleJoystickMove}
          onDash={handleDash}
          onInteract={handleInteract}
          timerRef={timerRef}
          staminaFillRef={staminaFillRef}
          staminaGhostRef={staminaGhostRef}
          staminaLabelRef={staminaLabelRef}
        />
      )}

      {screenState === 'title' && (
        <TitleOverlay
          bestScore={hud.bestScore}
          muted={muted}
          selectedPerk={selectedPerk}
          onSelectPerk={setSelectedPerk}
          onPlay={handlePlay}
          onToggleMute={handleToggleMute}
        />
      )}

      {screenState === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handlePlay}
          onTitle={handleTitle}
        />
      )}

      {screenState === 'gameover' && summary && (
        <GameOverModal
          summary={summary}
          onPlayAgain={handlePlay}
          onTitle={handleTitle}
        />
      )}
    </div>
  );
}
