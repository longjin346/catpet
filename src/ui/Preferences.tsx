import { useState, useEffect, CSSProperties } from 'react'
import { PERSONALITIES, PERSONALITY_IDS, type PersonalityId } from '../core/personality'

interface Stats {
  firstLaunch:   string | null
  launchCount:   number
  interactions:  number
  playSeconds:   number
}

export default function Preferences() {
  const [personality,     setPersonality]     = useState<PersonalityId>('chill')
  const [soundMuted,      setSoundMuted]      = useState(true)
  const [volume,          setVolume]          = useState(35)
  const [catScale,        setCatScale]        = useState(100)
  const [hungerHours,     setHungerHours]     = useState(1.5)
  const [saved,           setSaved]           = useState(false)
  const [stats,           setStats]           = useState<Stats>({
    firstLaunch: null, launchCount: 0, interactions: 0, playSeconds: 0,
  })

  useEffect(() => {
    async function load() {
      const [p, m, v, s, hi, fl, lc, ic, ps] = await Promise.all([
        window.catpet.storeGet('personality'),
        window.catpet.storeGet('soundMuted'),
        window.catpet.storeGet('soundVolume'),
        window.catpet.storeGet('catScale'),
        window.catpet.storeGet('hungerInterval'),
        window.catpet.storeGet('stats.firstLaunch'),
        window.catpet.storeGet('stats.launchCount'),
        window.catpet.storeGet('stats.interactions'),
        window.catpet.storeGet('stats.playSeconds'),
      ])
      if (typeof p === 'string' && p in PERSONALITIES) setPersonality(p as PersonalityId)
      if (typeof m === 'boolean') setSoundMuted(m)
      if (typeof v === 'number')  setVolume(Math.round(v * 100))
      if (typeof s === 'number')  setCatScale(Math.round(s * 100))
      if (typeof hi === 'number') setHungerHours(Math.round((hi / 3_600_000) * 10) / 10)
      setStats({
        firstLaunch:  typeof fl === 'string' ? fl : null,
        launchCount:  typeof lc === 'number' ? lc : 0,
        interactions: typeof ic === 'number' ? ic : 0,
        playSeconds:  typeof ps === 'number' ? ps : 0,
      })
    }
    load()
  }, [])

  async function save() {
    await Promise.all([
      window.catpet.storeSet('personality',    personality),
      window.catpet.storeSet('soundMuted',     soundMuted),
      window.catpet.storeSet('soundVolume',    volume / 100),
      window.catpet.storeSet('catScale',       catScale / 100),
      window.catpet.storeSet('hungerInterval', Math.round(hungerHours * 3_600_000)),
    ])
    window.catpet.notifyPrefsChanged()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function formatPlayTime(secs: number): string {
    if (secs < 60)   return `${secs}s`
    if (secs < 3600) return `${Math.floor(secs / 60)}m`
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
  }

  return (
    <div style={s.page}>
      <h2 style={s.title}>Preferences</h2>

      <section style={s.section}>
        <div style={s.sectionLabel}>Personality</div>
        <div style={s.cards}>
          {PERSONALITY_IDS.map(id => {
            const p = PERSONALITIES[id]
            return (
              <button
                key={id}
                style={{ ...s.card, ...(personality === id ? s.cardActive : {}) }}
                onClick={() => setPersonality(id)}
              >
                <div style={s.cardTitle}>{p.label}</div>
                <div style={s.cardDesc}>{p.description}</div>
              </button>
            )
          })}
        </div>
      </section>

      <section style={s.section}>
        <div style={s.sectionLabel}>Sound</div>
        <label style={s.row}>
          <span>Enable sounds</span>
          <input
            type="checkbox"
            checked={!soundMuted}
            onChange={e => setSoundMuted(!e.target.checked)}
          />
        </label>
        {!soundMuted && (
          <label style={s.row}>
            <span>Volume — {volume}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              style={s.slider}
            />
          </label>
        )}
      </section>

      <section style={s.section}>
        <div style={s.sectionLabel}>Cat Size</div>
        <label style={s.row}>
          <span>{catScale}%</span>
          <input
            type="range"
            min={50}
            max={200}
            value={catScale}
            onChange={e => setCatScale(Number(e.target.value))}
            style={s.slider}
          />
        </label>
      </section>

      <section style={s.section}>
        <div style={s.sectionLabel}>Hunger</div>
        <label style={s.row}>
          <span>Gets hungry after {hungerHours}h</span>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={hungerHours}
            onChange={e => setHungerHours(Number(e.target.value))}
            style={s.slider}
          />
        </label>
        <div style={s.hint}>
          Cat will meow for food after {hungerHours}h. Feed via tray icon or click on the cat.
        </div>
      </section>

      <section style={s.section}>
        <div style={s.sectionLabel}>Stats</div>
        <div style={s.statGrid}>
          <div style={s.statBox}>
            <div style={s.statVal}>{stats.launchCount}</div>
            <div style={s.statKey}>Launches</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statVal}>{stats.interactions}</div>
            <div style={s.statKey}>Interactions</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statVal}>{formatPlayTime(stats.playSeconds)}</div>
            <div style={s.statKey}>Play time</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statVal}>
              {stats.firstLaunch
                ? new Date(stats.firstLaunch).toLocaleDateString()
                : '—'}
            </div>
            <div style={s.statKey}>First seen</div>
          </div>
        </div>
      </section>

      <div style={s.footer}>
        <button style={{ ...s.saveBtn, ...(saved ? s.saveBtnSaved : {}) }} onClick={save}>
          {saved ? 'Saved!' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}

const s: Record<string, CSSProperties> = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: '28px 32px',
    background: '#1a1a2e',
    color: '#e8e8f0',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: '0 0 24px',
    color: '#ffffff',
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: '#777',
    marginBottom: 10,
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  card: {
    background: '#252540',
    border: '2px solid #353560',
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#e8e8f0',
    transition: 'border-color 0.15s, background 0.15s',
  },
  cardActive: {
    background: '#2a2a60',
    borderColor: '#6c63ff',
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 4,
    color: '#fff',
  },
  cardDesc: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 1.35,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    fontSize: 14,
  },
  slider: {
    width: 200,
    accentColor: '#6c63ff',
  },
  hint: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  statBox: {
    background: '#252540',
    borderRadius: 8,
    padding: '10px 14px',
  },
  statVal: {
    fontSize: 20,
    fontWeight: 700,
    color: '#6c63ff',
    marginBottom: 2,
  },
  statKey: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  footer: {
    paddingTop: 8,
  },
  saveBtn: {
    background: '#6c63ff',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 28px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  saveBtnSaved: {
    background: '#3dba77',
  },
}
