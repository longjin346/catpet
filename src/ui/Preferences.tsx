import { useState, useEffect, CSSProperties } from 'react'
import { PERSONALITIES, PERSONALITY_IDS, type PersonalityId } from '../core/personality'

export default function Preferences() {
  const [personality, setPersonality] = useState<PersonalityId>('chill')
  const [soundMuted,  setSoundMuted]  = useState(true)
  const [volume,      setVolume]      = useState(35)
  const [catScale,    setCatScale]    = useState(100)
  const [saved,       setSaved]       = useState(false)

  useEffect(() => {
    async function load() {
      const [p, m, v, s] = await Promise.all([
        window.catpet.storeGet('personality'),
        window.catpet.storeGet('soundMuted'),
        window.catpet.storeGet('soundVolume'),
        window.catpet.storeGet('catScale'),
      ])
      if (typeof p === 'string' && p in PERSONALITIES) setPersonality(p as PersonalityId)
      if (typeof m === 'boolean') setSoundMuted(m)
      if (typeof v === 'number')  setVolume(Math.round(v * 100))
      if (typeof s === 'number')  setCatScale(Math.round(s * 100))
    }
    load()
  }, [])

  async function save() {
    await Promise.all([
      window.catpet.storeSet('personality',  personality),
      window.catpet.storeSet('soundMuted',   soundMuted),
      window.catpet.storeSet('soundVolume',  volume / 100),
      window.catpet.storeSet('catScale',     catScale / 100),
    ])
    window.catpet.notifyPrefsChanged()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
