import type { AudioMode } from "../types";

export interface EngineStartOptions {
  mode: AudioMode;
  includeVoice: boolean;
  lines: string[];
  voiceBuffer: AudioBuffer | null;
  carrierHz: number;
  beatHz: number;
  silentVoiceGain: number;
  voicedGain: number;
  carrierGain: number;
}

function clampGain(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

function fillWhiteNoise(buffer: AudioBuffer) {
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }
}

function createNoiseSource(ctx: AudioContext): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  fillWhiteNoise(buffer);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

function brownFilter(ctx: AudioContext): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 380;
  filter.Q.value = 0.4;
  return filter;
}

export class SessionEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private buffers: AudioBufferSourceNode[] = [];
  private speechTimer: number | null = null;
  private paused = false;
  private lines: string[] = [];
  private lineIndex = 0;
  private voiceGain = 0.2;

  get running(): boolean {
    return this.ctx !== null && this.ctx.state !== "closed";
  }

  async start(opts: EngineStartOptions): Promise<"cartesia" | "speech-synthesis" | "carrier-only"> {
    this.stop();
    const ctx = new AudioContext();
    this.ctx = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    this.master = master;

    const carrierGain = clampGain(opts.carrierGain, 0.8);
    const silentVoice = clampGain(opts.silentVoiceGain, 0.12);
    const voiced = clampGain(opts.voicedGain, 0.6);
    const beat = Math.min(16, Math.max(1, opts.beatHz || 7));
    const carrier = Math.min(520, Math.max(80, opts.carrierHz || 220));

    if (opts.mode === "binaural") {
      this.startBinaural(ctx, master, carrier, beat, carrierGain);
    } else {
      this.startNoiseCarrier(ctx, master, carrierGain);
    }

    const voiceGain = opts.mode === "silent" ? silentVoice : voiced;
    this.voiceGain = voiceGain;
    this.lines = opts.lines.filter(Boolean);
    this.lineIndex = 0;

    if (opts.includeVoice && opts.voiceBuffer && this.lines.length) {
      const source = ctx.createBufferSource();
      source.buffer = opts.voiceBuffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = voiceGain;
      source.connect(gain);
      gain.connect(master);
      source.start();
      this.buffers.push(source);
      return "cartesia";
    }

    if (opts.includeVoice && this.lines.length && "speechSynthesis" in window) {
      this.speakLoop();
      return "speech-synthesis";
    }

    return "carrier-only";
  }

  pause() {
    this.paused = true;
    this.master?.gain.setTargetAtTime(0, this.ctx?.currentTime ?? 0, 0.05);
    window.speechSynthesis?.cancel();
    if (this.speechTimer !== null) {
      window.clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }
    void this.ctx?.suspend();
  }

  resume() {
    this.paused = false;
    this.master?.gain.setTargetAtTime(0.85, this.ctx?.currentTime ?? 0, 0.05);
    void this.ctx?.resume();
    if (this.lines.length && this.buffers.length === 0) this.speakLoop();
  }

  stop() {
    this.paused = false;
    if (this.speechTimer !== null) {
      window.clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }
    window.speechSynthesis?.cancel();
    for (const osc of this.oscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.oscillators = [];
    for (const src of this.buffers) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.buffers = [];
    this.master?.disconnect();
    this.master = null;
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  private startBinaural(
    ctx: AudioContext,
    master: GainNode,
    carrier: number,
    beat: number,
    gainValue: number,
  ) {
    const merger = ctx.createChannelMerger(2);
    const gain = ctx.createGain();
    gain.gain.value = gainValue;

    const left = ctx.createOscillator();
    left.type = "sine";
    left.frequency.value = carrier;
    const right = ctx.createOscillator();
    right.type = "sine";
    right.frequency.value = carrier + beat;

    const leftGain = ctx.createGain();
    leftGain.gain.value = 0.55;
    const rightGain = ctx.createGain();
    rightGain.gain.value = 0.55;

    left.connect(leftGain);
    right.connect(rightGain);
    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);
    merger.connect(gain);
    gain.connect(master);
    left.start();
    right.start();
    this.oscillators.push(left, right);
  }

  private startNoiseCarrier(ctx: AudioContext, master: GainNode, gainValue: number) {
    const noise = createNoiseSource(ctx);
    const filter = brownFilter(ctx);
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start();
    this.buffers.push(noise);
  }

  private speakLoop() {
    if (this.paused || !this.lines.length) return;
    const line = this.lines[this.lineIndex % this.lines.length];
    this.lineIndex += 1;
    const utter = new SpeechSynthesisUtterance(line);
    utter.rate = 0.86;
    utter.pitch = 1.18;
    utter.volume = Math.min(1, Math.max(0.03, this.voiceGain));
    const voices = window.speechSynthesis.getVoices();
    const femme =
      voices.find((v) => /female|woman|samantha|victoria|fiona|zira|google uk english female/i.test(v.name)) ??
      voices.find((v) => v.lang.startsWith("en"));
    if (femme) utter.voice = femme;
    utter.onend = () => {
      this.speechTimer = window.setTimeout(() => this.speakLoop(), 420);
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }
}
