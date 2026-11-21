import { MUTE_STORAGE_KEY } from './rules';

/**
 * Pure Web Audio API procedural sound synthesizer (zero external asset URLs).
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean;

  constructor() {
    this.muted = this.loadMuted();
  }

  private loadMuted(): boolean {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(next: boolean): void {
    this.muted = next;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
      }
    } catch {
      // Ignore storage errors
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(next ? 0 : 0.36, this.ctx.currentTime, 0.02);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playClick();
    }
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.36;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * 0.45);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private jitter(base: number, pct = 0.06): number {
    return base * (1 + (Math.random() * 2 - 1) * pct);
  }

  private tone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    duration: number,
    volume: number,
    delay = 0
  ): void {
    if (this.muted || !this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, startFreq), now);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noiseBurst(
    duration: number,
    filterFreq: number,
    volume: number,
    delay = 0
  ): void {
    if (this.muted || !this.ctx || !this.masterGain || !this.noiseBuffer || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  public playClick(): void {
    this.unlock();
    this.tone('triangle', 520, 740, 0.06, 0.22);
  }

  public playPickup(carryCount: number): void {
    const step = Math.min(5, Math.max(1, carryCount));
    const root = this.jitter(440 + step * 55, 0.04);
    this.tone('sine', root, root * 1.25, 0.09, 0.28, 0);
    this.tone('triangle', root * 1.25, root * 1.5, 0.11, 0.22, 0.045);
  }

  public playBank(count: number, streak = 1): void {
    const pitchBoost = Math.pow(1.085, Math.min(5, Math.max(0, streak - 1)));
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const reps = Math.min(notes.length, Math.max(2, count + 1));
    for (let i = 0; i < reps; i++) {
      const f = notes[i] * pitchBoost;
      this.tone('triangle', f, f * 1.02, 0.16, 0.3, i * 0.052);
    }
  }

  public playPowerUp(): void {
    this.tone('sine', 520, 780, 0.1, 0.24, 0);
    this.tone('triangle', 780, 1180, 0.15, 0.26, 0.06);
  }

  public playShieldDeflect(): void {
    this.tone('triangle', 680, 340, 0.18, 0.28, 0);
    this.tone('sine', 960, 1280, 0.12, 0.2, 0.03);
  }

  public playDash(): void {
    this.tone('sawtooth', this.jitter(220, 0.07), 90, 0.14, 0.22);
    this.noiseBurst(0.16, 1600, 0.26);
  }

  public playJump(): void {
    this.tone('sine', this.jitter(260, 0.06), 620, 0.16, 0.24);
    this.tone('triangle', 390, 740, 0.12, 0.14, 0.02);
  }

  public playVaultBonus(): void {
    this.tone('triangle', 660, 990, 0.11, 0.24, 0);
    this.tone('sine', 990, 1320, 0.13, 0.2, 0.05);
  }

  public playInteractPulse(): void {
    this.tone('sine', 340, 880, 0.18, 0.22, 0);
    this.tone('triangle', 510, 1020, 0.14, 0.16, 0.04);
  }

  public playEmpJam(): void {
    this.tone('sawtooth', 520, 110, 0.28, 0.28, 0);
    this.tone('square', 280, 75, 0.24, 0.2, 0.05);
    this.noiseBurst(0.26, 2200, 0.28);
  }

  public playShockwave(): void {
    this.tone('sine', 165, 58, 0.3, 0.32, 0);
    this.noiseBurst(0.24, 600, 0.22);
  }

  public playTelegraph(): void {
    this.tone('sine', this.jitter(640, 0.05), 860, 0.11, 0.11);
  }

  public playImpact(): void {
    this.tone('sine', this.jitter(125, 0.08), 38, 0.22, 0.36);
    this.noiseBurst(0.22, 720, 0.32);
  }

  public playHurt(): void {
    this.tone('sawtooth', 190, 62, 0.26, 0.38);
    this.tone('square', 135, 55, 0.22, 0.24, 0.03);
    this.noiseBurst(0.25, 1100, 0.36);
  }

  public playPhaseUp(phase: number): void {
    const base = 320 + phase * 50;
    this.tone('sawtooth', base, base * 1.15, 0.12, 0.22, 0);
    this.tone('sawtooth', base * 1.25, base * 1.5, 0.18, 0.26, 0.11);
  }

  public playTickUrgent(finalThree: boolean): void {
    const freq = finalThree ? 980 : 760;
    this.tone('triangle', freq, freq * 0.92, 0.055, finalThree ? 0.24 : 0.14);
  }

  public playVictory(): void {
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, idx) => {
      this.tone('triangle', freq, freq, 0.38, 0.28, idx * 0.08);
    });
  }

  public playDefeat(): void {
    this.tone('sawtooth', 310, 210, 0.22, 0.28, 0);
    this.tone('sawtooth', 210, 125, 0.32, 0.3, 0.18);
    this.tone('sine', 125, 68, 0.42, 0.32, 0.38);
  }
}
