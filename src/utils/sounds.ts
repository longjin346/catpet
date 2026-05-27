export class SoundManager {
  private ctx:        AudioContext | null = null
  private masterGain: GainNode     | null = null
  private purrNodes:  AudioNode[]         = []
  private _volume                         = 0.35
  private _muted                          = true

  get volume(): number  { return this._volume }
  get muted():  boolean { return this._muted  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this._muted ? 0 : this._volume
      this.masterGain.connect(this.ctx.destination)
    }
    return this.ctx
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v))
    if (this.masterGain) this.masterGain.gain.value = this._muted ? 0 : this._volume
  }

  setMuted(muted: boolean): void {
    this._muted = muted
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : this._volume
    if (muted) this.stopPurr()
  }

  startPurr(): void {
    if (this._muted || this.purrNodes.length > 0) return
    const ctx = this.ensureCtx()

    const osc1    = ctx.createOscillator()
    const osc2    = ctx.createOscillator()
    const filter  = ctx.createBiquadFilter()
    const gain    = ctx.createGain()
    const modOsc  = ctx.createOscillator()
    const modGain = ctx.createGain()

    osc1.type = 'sawtooth';  osc1.frequency.value = 100
    osc2.type = 'sawtooth';  osc2.frequency.value = 104
    filter.type = 'lowpass'; filter.frequency.value = 280
    gain.gain.value = 0.028
    modOsc.type = 'sine';    modOsc.frequency.value = 24
    modGain.gain.value = 0.45

    osc1.connect(filter)
    osc2.connect(filter)
    filter.connect(gain)
    modOsc.connect(modGain)
    modGain.connect(gain.gain)
    gain.connect(this.masterGain!)

    osc1.start(); osc2.start(); modOsc.start()
    this.purrNodes = [osc1, osc2, modOsc, modGain, gain, filter]
  }

  stopPurr(): void {
    for (const n of this.purrNodes) {
      if (n instanceof OscillatorNode) {
        try { n.stop() } catch { /* already stopped */ }
      }
    }
    this.purrNodes = []
  }

  meow(): void {
    if (this._muted) return
    const ctx  = this.ensureCtx()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    const now  = ctx.currentTime

    osc.type = 'sine'
    osc.frequency.setValueAtTime(680, now)
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.35)
    gain.gain.setValueAtTime(0.11, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

    osc.connect(gain)
    gain.connect(this.masterGain!)
    osc.start(now)
    osc.stop(now + 0.5)
  }

  chirp(): void {
    if (this._muted) return
    const ctx     = this.ensureCtx()
    const offsets = [0, 0.09, 0.18]
    const freqs   = [850, 1050, 1350]

    for (let i = 0; i < 3; i++) {
      const t    = ctx.currentTime + offsets[i]
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.value = freqs[i]
      gain.gain.setValueAtTime(0.07, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)

      osc.connect(gain)
      gain.connect(this.masterGain!)
      osc.start(t)
      osc.stop(t + 0.09)
    }
  }

  destroy(): void {
    this.stopPurr()
    this.ctx?.close()
    this.ctx = null
    this.masterGain = null
  }
}
