import { Application, Container, Text, TextStyle } from 'pixi.js'

export type ParticleType = 'heart' | 'zzz' | 'sparkle' | 'exclaim'

interface Particle {
  text:    Text
  vx:      number
  vy:      number
  life:    number
  maxLife: number
}

const GLYPHS: Record<ParticleType, string[]> = {
  heart:   ['♥'],
  zzz:     ['z', 'Z', 'z'],
  sparkle: ['✦', '✧'],
  exclaim: ['!'],
}

const COLORS: Record<ParticleType, number> = {
  heart:   0xFF6B8A,
  zzz:     0x88BBFF,
  sparkle: 0xFFDD44,
  exclaim: 0xFF9922,
}

export class ParticleEmitter {
  private container: Container
  private particles: Particle[] = []

  constructor(app: Application) {
    this.container = new Container()
    app.stage.addChild(this.container)
  }

  burst(x: number, y: number, type: ParticleType, count = 3): void {
    for (let i = 0; i < count; i++) {
      this.spawnOne(x + (Math.random() - 0.5) * 28, y - 10 - i * 7, type)
    }
  }

  private spawnOne(x: number, y: number, type: ParticleType): void {
    const glyphSet = GLYPHS[type]
    const glyph    = glyphSet[Math.floor(Math.random() * glyphSet.length)]
    const color    = COLORS[type]

    const style = new TextStyle({ fontSize: type === 'zzz' ? 12 : 15, fill: color })
    const text  = new Text({ text: glyph, style })
    text.position.set(x, y)
    text.pivot.set(text.width / 2, text.height / 2)
    this.container.addChild(text)

    const maxLife = 1.4 + Math.random() * 0.8
    this.particles.push({
      text,
      vx:      (Math.random() - 0.5) * 28,
      vy:      -(35 + Math.random() * 25),
      life:    maxLife,
      maxLife,
    })
  }

  tick(deltaMs: number): void {
    const dt = deltaMs / 1000
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        p.text.destroy()
        this.particles.splice(i, 1)
        continue
      }
      p.text.x    += p.vx * dt
      p.text.y    += p.vy * dt
      p.vy        += 20 * dt
      p.text.alpha = Math.max(0, p.life / p.maxLife)
    }
  }

  destroy(): void {
    for (const p of this.particles) p.text.destroy()
    this.particles = []
    this.container.destroy({ children: true })
  }
}
