import { useSettings } from './store/settings'

let ctx: AudioContext | null = null
let master: GainNode | null = null

function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = useSettings.getState().volume
    master.connect(ctx.destination)
    useSettings.subscribe((s) => {
      if (master && ctx) master.gain.setTargetAtTime(s.volume, ctx.currentTime, 0.05)
    })
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return { ctx, master: master! }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.12, slideTo?: number) {
  const a = audio()
  if (!a) return
  const t0 = a.ctx.currentTime + start
  const osc = a.ctx.createOscillator()
  const g = a.ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(a.master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function noiseBurst(start: number, dur: number, vol = 0.15, freq = 2000) {
  const a = audio()
  if (!a) return
  const t0 = a.ctx.currentTime + start
  const buf = a.ctx.createBuffer(1, Math.ceil(a.ctx.sampleRate * dur), a.ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = a.ctx.createBufferSource()
  src.buffer = buf
  const filter = a.ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  const g = a.ctx.createGain()
  g.gain.value = vol
  src.connect(filter).connect(g).connect(a.master)
  src.start(t0)
}

export type Sfx = 'select' | 'confirm' | 'dice' | 'hit' | 'crit' | 'miss' | 'heal' | 'levelup' | 'victory' | 'defeat' | 'bump' | 'encounter' | 'type'

export function sfx(name: Sfx) {
  if (!useSettings.getState().sfx) return
  switch (name) {
    case 'select':
      return tone(880, 0, 0.05, 'square', 0.05)
    case 'confirm':
      tone(660, 0, 0.06, 'square', 0.07)
      return tone(990, 0.06, 0.08, 'square', 0.07)
    case 'type':
      return tone(520 + Math.random() * 80, 0, 0.025, 'square', 0.02)
    case 'dice':
      for (let i = 0; i < 6; i++) noiseBurst(i * 0.06 + Math.random() * 0.02, 0.04, 0.2, 2500 + Math.random() * 2000)
      return
    case 'hit':
      noiseBurst(0, 0.12, 0.25, 900)
      return tone(220, 0, 0.12, 'square', 0.1, 80)
    case 'crit':
      noiseBurst(0, 0.2, 0.3, 700)
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.05, 0.12, 'square', 0.08))
      return
    case 'miss':
      return tone(400, 0, 0.15, 'triangle', 0.08, 200)
    case 'heal':
      ;[523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.2, 'sine', 0.1))
      return
    case 'levelup':
      ;[523, 523, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.14, 'square', 0.08))
      return
    case 'victory':
      ;[784, 784, 784, 784, 622, 698, 784, 698, 784].forEach((f, i) =>
        tone(f, [0, 0.12, 0.24, 0.36, 0.6, 0.84, 1.08, 1.26, 1.38][i], i === 8 ? 0.6 : 0.1, 'square', 0.07),
      )
      return
    case 'defeat':
      ;[392, 370, 349, 330].forEach((f, i) => tone(f, i * 0.3, 0.35, 'triangle', 0.1))
      return
    case 'bump':
      return tone(120, 0, 0.06, 'square', 0.05)
    case 'encounter':
      ;[220, 330, 440, 660, 880].forEach((f, i) => tone(f, i * 0.04, 0.08, 'sawtooth', 0.05))
      return
  }
}

/* Ambient lo-fi loop: soft jazzy chords, a gentle kick, and vinyl crackle. */
const CHORDS = [
  [261.63, 329.63, 392.0, 493.88],
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 329.63],
  [196.0, 246.94, 293.66, 349.23],
]
const BEAT = 60 / 72

let ambientTimer: number | null = null
let ambientBus: GainNode | null = null
let crackle: AudioBufferSourceNode | null = null
let nextBeat = 0
let beatIndex = 0

function scheduleBeat(a: { ctx: AudioContext }, bus: GainNode, t: number, i: number) {
  if (i % 8 === 0) {
    const chord = CHORDS[(i / 8) % CHORDS.length]
    const filter = a.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    filter.connect(bus)
    for (const f of chord) {
      for (const detune of [-6, 6]) {
        const osc = a.ctx.createOscillator()
        const g = a.ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = f / 2
        osc.detune.value = detune
        g.gain.setValueAtTime(0.0001, t)
        g.gain.linearRampToValueAtTime(0.03, t + 0.4)
        g.gain.linearRampToValueAtTime(0.0001, t + BEAT * 4)
        osc.connect(g).connect(filter)
        osc.start(t)
        osc.stop(t + BEAT * 4 + 0.1)
      }
    }
  }
  if (i % 4 === 0 || i % 8 === 6) {
    const osc = a.ctx.createOscillator()
    const g = a.ctx.createGain()
    osc.frequency.setValueAtTime(110, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18)
    g.gain.setValueAtTime(0.18, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    osc.connect(g).connect(bus)
    osc.start(t)
    osc.stop(t + 0.3)
  }
  if (i % 2 === 1) {
    const buf = a.ctx.createBuffer(1, 2205, a.ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / d.length)
    const src = a.ctx.createBufferSource()
    src.buffer = buf
    const hp = a.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    const g = a.ctx.createGain()
    g.gain.value = 0.04
    src.connect(hp).connect(g).connect(bus)
    src.start(t)
  }
}

export function startAmbient() {
  const a = audio()
  if (!a || ambientTimer !== null) return
  ambientBus = a.ctx.createGain()
  ambientBus.gain.value = 0.8
  ambientBus.connect(a.master)

  const len = a.ctx.sampleRate * 4
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() < 0.0008 ? (Math.random() * 2 - 1) * 0.6 : (Math.random() * 2 - 1) * 0.006
  crackle = a.ctx.createBufferSource()
  crackle.buffer = buf
  crackle.loop = true
  crackle.connect(ambientBus)
  crackle.start()

  nextBeat = a.ctx.currentTime + 0.1
  beatIndex = 0
  ambientTimer = window.setInterval(() => {
    if (!ambientBus) return
    while (nextBeat < a.ctx.currentTime + 0.3) {
      scheduleBeat(a, ambientBus, nextBeat, beatIndex)
      nextBeat += BEAT / 2
      beatIndex++
    }
  }, 100)
}

export function stopAmbient() {
  if (ambientTimer !== null) window.clearInterval(ambientTimer)
  ambientTimer = null
  crackle?.stop()
  crackle = null
  if (ambientBus && ctx) {
    const bus = ambientBus
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.2)
    setTimeout(() => bus.disconnect(), 1000)
  }
  ambientBus = null
}
