import { useState, useCallback } from 'react'
import type { SlotRole, ValidationIssue } from '../utils/config'
import { SLOTS } from '../utils/config'
import { removeBackground } from '../processing/background-removal'
import { validatePhoto } from '../processing/photo-validator'
import QualityMeter from './QualityMeter'

type SlotState =
  | { status: 'empty' }
  | { status: 'loading'; progress: number }
  | { status: 'done'; dataUrl: string }
  | { status: 'error'; message: string }

type SlotMap = Partial<Record<SlotRole, SlotState>>

// ─── Styles ────────────────────────────────────────────────────────────────────
const cardBase: React.CSSProperties = {
  borderRadius: 10,
  padding: '12px 10px',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  border: '2px dashed #d1d5db',
  background: '#fafafa',
  minHeight: 130,
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  userSelect: 'none',
}

// ─── SlotCard ─────────────────────────────────────────────────────────────────
interface SlotCardProps {
  role: SlotRole
  state: SlotState
  required: boolean
  emoji: string
  label: string
  tip: string
  onUpload: (role: SlotRole) => void
  onRemove: (role: SlotRole) => void
}

function SlotCard({ role, state, required, emoji, label, tip, onUpload, onRemove }: SlotCardProps) {
  const [hover, setHover] = useState(false)

  const borderColor =
    state.status === 'done' ? '#10b981'
    : state.status === 'error' ? '#ef4444'
    : state.status === 'loading' ? '#6366f1'
    : required ? '#f59e0b'
    : '#d1d5db'

  const style: React.CSSProperties = {
    ...cardBase,
    borderColor,
    boxShadow: hover ? '0 2px 8px rgba(0,0,0,0.12)' : undefined,
    background: state.status === 'done' ? '#f0fdf4' : '#fafafa',
  }

  return (
    <div
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => state.status !== 'loading' && onUpload(role)}
      title={tip}
    >
      {state.status === 'done' && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(role) }}
          style={{
            position: 'absolute', top: 4, right: 4,
            background: 'rgba(0,0,0,0.4)', color: '#fff',
            border: 'none', borderRadius: '50%',
            width: 20, height: 20, cursor: 'pointer',
            fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Remove photo"
        >
          ✕
        </button>
      )}

      {state.status === 'done' ? (
        <img
          src={state.dataUrl}
          alt={label}
          style={{ width: '100%', height: 90, objectFit: 'contain', borderRadius: 6 }}
        />
      ) : state.status === 'loading' ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>⏳</div>
          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
            {state.progress < 0.1 ? 'Loading model…' : `Removing background… ${Math.round(state.progress * 100)}%`}
          </div>
          <div style={{
            marginTop: 6, height: 4, borderRadius: 2, background: '#e5e7eb',
            overflow: 'hidden', width: 80, margin: '6px auto 0',
          }}>
            <div style={{
              height: '100%', width: `${state.progress * 100}%`,
              background: '#6366f1', borderRadius: 2, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      ) : state.status === 'error' ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22 }}>⚠️</div>
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
            {state.status === 'error' ? (state as Extract<SlotState, { status: 'error' }>).message : ''}
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Click to try again</div>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26 }}>{emoji}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 2 }}>{label}</div>
          {required && (
            <div style={{
              fontSize: 10, background: '#fef3c7', color: '#92400e',
              borderRadius: 4, padding: '1px 6px', marginTop: 2, fontWeight: 600,
            }}>REQUIRED</div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>+ Add photo</div>
        </div>
      )}
    </div>
  )
}

// ─── Validation Banner ─────────────────────────────────────────────────────────
function ValidationBanner({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) return null
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8, marginBottom: 8,
      background: issues.some(i => i.severity === 'error') ? '#fef2f2' : '#fffbeb',
      border: `1px solid ${issues.some(i => i.severity === 'error') ? '#fca5a5' : '#fcd34d'}`,
    }}>
      {issues.map((issue, i) => (
        <div key={i} style={{ fontSize: 12, color: issue.severity === 'error' ? '#b91c1c' : '#92400e' }}>
          {issue.severity === 'error' ? '❌ ' : '⚠️ '}{issue.message}
        </div>
      ))}
    </div>
  )
}

// ─── Main Upload Component ─────────────────────────────────────────────────────
export default function Upload() {
  const [slots, setSlots] = useState<SlotMap>({})
  const [catName, setCatName] = useState('')
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [saving, setSaving] = useState(false)
  const [lastProcessedSlot, setLastProcessedSlot] = useState<SlotRole | null>(null)

  const filledSlots = new Set(
    Object.entries(slots)
      .filter(([, s]) => s.status === 'done')
      .map(([role]) => role as SlotRole)
  )

  const setSlotState = useCallback((role: SlotRole, state: SlotState) => {
    setSlots(prev => ({ ...prev, [role]: state }))
  }, [])

  const handleUpload = useCallback(async (role: SlotRole) => {
    if (slots[role]?.status === 'loading') return

    const filePath = await window.catpet.openFileDialog()
    if (!filePath) return

    setSlotState(role, { status: 'loading', progress: 0 })
    setValidationIssues([])
    setLastProcessedSlot(null)

    try {
      // Read file from disk via IPC
      const rawDataUrl = await window.catpet.readFile(filePath)

      // Validate photo quality
      const validation = await validatePhoto(rawDataUrl)
      if (!validation.passed) {
        setSlotState(role, { status: 'error', message: validation.issues[0]?.message ?? 'Invalid photo.' })
        return
      }

      // Show warnings but continue
      if (validation.issues.length > 0) {
        setValidationIssues(validation.issues)
      }

      // Remove background
      const bgRemovedUrl = await removeBackground(rawDataUrl, progress => {
        setSlotState(role, { status: 'loading', progress })
      })

      // Save to disk
      await window.catpet.savePhoto(role, bgRemovedUrl)

      setSlotState(role, { status: 'done', dataUrl: bgRemovedUrl })
      setLastProcessedSlot(role)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Processing failed.'
      setSlotState(role, { status: 'error', message: msg.length > 60 ? msg.slice(0, 60) + '…' : msg })
    }
  }, [slots, setSlotState])

  const handleRemove = useCallback(async (role: SlotRole) => {
    await window.catpet.deletePhoto(role)
    setSlotState(role, { status: 'empty' })
  }, [setSlotState])

  const handleBringToLife = async () => {
    if (filledSlots.size === 0) return
    setSaving(true)
    try {
      const config = {
        name: catName.trim() || 'Unnamed Cat',
        photoSlots: Object.fromEntries(
          [...filledSlots].map(role => [role, `${role}.png`])
        ),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await window.catpet.storeSet('catConfig', config)
      window.catpet.catReady()
    } finally {
      setSaving(false)
    }
  }

  const canProceed = filledSlots.size > 0

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '24px 28px',
      maxWidth: 760,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0 }}>
          Upload Cat Photos
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
          You only need the first photo to get started. Each additional photo improves a specific animation.
        </p>
      </div>

      {/* Validation banner */}
      {lastProcessedSlot && validationIssues.length > 0 && (
        <ValidationBanner issues={validationIssues} />
      )}

      {/* 6-slot grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 20,
      }}>
        {SLOTS.map(slot => (
          <SlotCard
            key={slot.role}
            role={slot.role}
            state={slots[slot.role] ?? { status: 'empty' }}
            required={slot.required}
            emoji={slot.emoji}
            label={slot.label}
            tip={slot.tip}
            onUpload={handleUpload}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Quality meter */}
      <QualityMeter filledSlots={filledSlots} />

      {/* Cat name + CTA */}
      <div style={{
        marginTop: 20,
        padding: '16px 20px',
        background: '#f9fafb',
        borderRadius: 10,
        border: '1px solid #e5e7eb',
      }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
          What's your cat's name?
        </label>
        <input
          type="text"
          value={catName}
          onChange={e => setCatName(e.target.value)}
          placeholder="e.g. Mochi, Luna, Biscuit…"
          maxLength={32}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 14,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: 16,
          }}
        />
        <button
          onClick={handleBringToLife}
          disabled={!canProceed || saving}
          style={{
            width: '100%',
            padding: '12px 0',
            fontSize: 15,
            fontWeight: 700,
            background: canProceed ? '#6366f1' : '#d1d5db',
            color: canProceed ? '#fff' : '#9ca3af',
            border: 'none',
            borderRadius: 8,
            cursor: canProceed ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          {saving ? 'Launching…' : `Bring ${catName.trim() || 'My Cat'} to Life!`}
        </button>
        {!canProceed && (
          <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
            Add at least 1 photo to continue
          </p>
        )}
      </div>

      {/* First-run note about model download */}
      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 12, textAlign: 'center' }}>
        Background removal runs locally. The first photo takes ~15s to download the AI model; subsequent photos are instant.
      </p>
    </div>
  )
}
