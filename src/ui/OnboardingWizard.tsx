import { useState, useCallback, CSSProperties } from 'react'
import type { SlotRole, ValidationIssue } from '../utils/config'
import { SLOTS } from '../utils/config'
import { removeBackground } from '../processing/background-removal'
import { validatePhoto } from '../processing/photo-validator'
import CatGuide from './CatGuide'

// ─── Types ─────────────────────────────────────────────────────────────────────

type SlotState =
  | { status: 'empty' }
  | { status: 'loading'; progress: number }
  | { status: 'done'; dataUrl: string }
  | { status: 'error'; message: string }

type SlotMap = Partial<Record<SlotRole, SlotState>>
type WizardStep = 'welcome' | 'primary' | 'optional' | 'launch'

// ─── Shared styles ─────────────────────────────────────────────────────────────

const DARK   = '#0f0f23'
const CARD   = '#1c1c38'
const ACCENT = '#6c63ff'
const TEXT   = '#e8e8f0'
const MUTED  = '#8888aa'

const base: CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  background: DARK,
  color: TEXT,
  minHeight: '100vh',
  boxSizing: 'border-box',
}

const btnPrimary: CSSProperties = {
  background: ACCENT, color: '#fff', border: 'none',
  borderRadius: 10, padding: '12px 32px',
  fontSize: 15, fontWeight: 700, cursor: 'pointer',
  transition: 'opacity 0.15s',
}

const btnGhost: CSSProperties = {
  background: 'transparent', color: MUTED, border: 'none',
  borderRadius: 8, padding: '10px 20px',
  fontSize: 14, cursor: 'pointer',
}

// ─── Progress dots ─────────────────────────────────────────────────────────────

function StepDots({ step }: { step: WizardStep }) {
  const steps: WizardStep[] = ['welcome', 'primary', 'optional', 'launch']
  const idx = steps.indexOf(step)
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28 }}>
      {steps.slice(1).map((_, i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: i < idx ? ACCENT : i === idx - 1 ? ACCENT : 'rgba(255,255,255,0.2)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  )
}

// ─── Upload slot helper ─────────────────────────────────────────────────────────

interface UploadSlotProps {
  role:      SlotRole
  state:     SlotState
  large?:    boolean
  onUpload:  (role: SlotRole) => void
  onRemove:  (role: SlotRole) => void
}

function UploadSlot({ role, state, large = false, onUpload, onRemove }: UploadSlotProps) {
  const [hover, setHover] = useState(false)
  const sz = large ? 180 : 68

  const borderColor =
    state.status === 'done'    ? '#34d399'
    : state.status === 'error' ? '#f87171'
    : state.status === 'loading' ? ACCENT
    : 'rgba(255,255,255,0.18)'

  return (
    <div
      onClick={() => state.status !== 'loading' && onUpload(role)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `2px ${state.status === 'empty' ? 'dashed' : 'solid'} ${borderColor}`,
        borderRadius: 10, cursor: state.status === 'loading' ? 'wait' : 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: large ? 16 : 10, position: 'relative', overflow: 'hidden',
        background: state.status === 'done' ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)',
        minHeight: large ? 180 : 80,
        boxShadow: hover && state.status !== 'loading' ? '0 0 0 2px rgba(108,99,255,0.35)' : undefined,
        transition: 'box-shadow 0.15s, border-color 0.15s',
        userSelect: 'none',
      }}
    >
      {state.status === 'done' && (
        <>
          <img
            src={state.dataUrl}
            alt={role}
            style={{ width: '100%', height: sz, objectFit: 'contain', borderRadius: 6 }}
          />
          <button
            onClick={e => { e.stopPropagation(); onRemove(role) }}
            style={{
              position: 'absolute', top: 4, right: 4,
              background: 'rgba(0,0,0,0.5)', color: '#fff',
              border: 'none', borderRadius: '50%',
              width: 20, height: 20, cursor: 'pointer', fontSize: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </>
      )}
      {state.status === 'loading' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: ACCENT, fontWeight: 600, marginBottom: 6 }}>
            {state.progress < 0.05 ? 'Loading model…'
              : `Removing background… ${Math.round(state.progress * 100)}%`}
          </div>
          <div style={{ height: 4, width: 120, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${state.progress * 100}%`,
              background: ACCENT, borderRadius: 2, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}
      {state.status === 'error' && (
        <div style={{ textAlign: 'center', fontSize: 12, color: '#f87171', padding: '0 8px' }}>
          {(state as Extract<SlotState, { status: 'error' }>).message}
          <div style={{ color: MUTED, marginTop: 4 }}>Click to retry</div>
        </div>
      )}
      {state.status === 'empty' && (
        <div style={{ textAlign: 'center', color: MUTED }}>
          <div style={{ fontSize: large ? 28 : 20 }}>+</div>
          {large && <div style={{ fontSize: 13, marginTop: 4 }}>Click to upload</div>}
        </div>
      )}
    </div>
  )
}

// ─── Validation banner ─────────────────────────────────────────────────────────

function ValidationBanner({ issues, onClose }: { issues: ValidationIssue[]; onClose: () => void }) {
  if (issues.length === 0) return null
  const isError = issues.some(i => i.severity === 'error')
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8, marginBottom: 12,
      background: isError ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
      border: `1px solid ${isError ? '#f87171' : '#fbbf24'}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    }}>
      <div>
        {issues.map((issue, i) => (
          <div key={i} style={{ fontSize: 12, color: isError ? '#f87171' : '#fbbf24' }}>
            {issue.severity === 'error' ? '⚠ ' : '○ '}{issue.message}
          </div>
        ))}
      </div>
      <button onClick={onClose} style={{ ...btnGhost, padding: '0 4px', fontSize: 16, color: MUTED }}>×</button>
    </div>
  )
}

// ─── Step: Welcome ─────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ ...base, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 56px', textAlign: 'center' }}>
      <div style={{ marginBottom: 24 }}>
        <CatGuide role="primary" size={108} />
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 800, color: '#fff', margin: '0 0 14px', letterSpacing: '-0.5px' }}>
        Your cat, animated
      </h1>
      <p style={{ fontSize: 15, color: '#aaaabf', lineHeight: 1.7, maxWidth: 360, margin: '0 0 36px' }}>
        Upload 1–6 photos of your cat and they become a desktop pet —
        walking, sleeping, and grooming live on your screen.
        Runs offline, no cloud needed.
      </p>
      <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
        {([
          ['primary', '🐱', 'Puppet rig'],
          ['sleep',   '😴', 'Sleep pose'],
          ['action',  '🐈', 'Play pose'],
        ] as [SlotRole, string, string][]).map(([role, , label]) => (
          <div key={role} style={{ textAlign: 'center' }}>
            <CatGuide role={role} size={70} />
            <div style={{ fontSize: 11, color: MUTED, marginTop: 5 }}>{label}</div>
          </div>
        ))}
      </div>
      <button style={btnPrimary} onClick={onNext}>
        Get Started →
      </button>
    </div>
  )
}

// ─── Step: Primary photo ────────────────────────────────────────────────────────

function PrimaryStep({
  state, onUpload, onRemove, onNext,
  warnings, onDismissWarnings,
}: {
  state:              SlotState
  onUpload:           (role: SlotRole) => void
  onRemove:           (role: SlotRole) => void
  onNext:             () => void
  warnings:           ValidationIssue[]
  onDismissWarnings:  () => void
}) {
  const ready = state.status === 'done'

  return (
    <div style={{ ...base, padding: '32px 40px', display: 'flex', flexDirection: 'column' }}>
      <StepDots step="primary" />

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: ACCENT, textTransform: 'uppercase', marginBottom: 8 }}>
        Step 1 of 2 — Required
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
        The essential photo
      </h2>
      <p style={{ fontSize: 13, color: MUTED, margin: '0 0 20px' }}>
        A full-body side view is the only photo you need to get started.
      </p>

      <ValidationBanner issues={warnings} onClose={onDismissWarnings} />

      <div style={{ display: 'flex', gap: 28, flex: 1 }}>
        {/* Guide */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <CatGuide role="primary" size={168} />
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Full body head-to-tail',
              'Side or ¾ view',
              'Standing, sitting, or walking',
              'Good lighting, sharp focus',
            ].map(tip => (
              <li key={tip} style={{ fontSize: 12, color: MUTED, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ color: ACCENT, marginTop: 1 }}>✓</span>{tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Upload */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <UploadSlot role="primary" state={state} large onUpload={onUpload} onRemove={onRemove} />
          {ready && (
            <div style={{ marginTop: 10, fontSize: 13, color: '#34d399', textAlign: 'center' }}>
              Background removed automatically
            </div>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: 12, color: MUTED }}>
            <strong style={{ color: TEXT }}>How it works:</strong> Your photo is segmented into 5 body-part layers (head, torso, legs, tail) which are then rigged and animated. Everything runs on your computer.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
        <button
          style={{
            ...btnPrimary,
            opacity: ready ? 1 : 0.4,
            cursor: ready ? 'pointer' : 'not-allowed',
          }}
          disabled={!ready}
          onClick={onNext}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

// ─── Step: Optional photos ──────────────────────────────────────────────────────

const OPTIONAL_SLOTS = SLOTS.filter(s => !s.required)

function OptionalStep({
  slots, onUpload, onRemove, onNext, onSkip,
}: {
  slots:    SlotMap
  onUpload: (role: SlotRole) => void
  onRemove: (role: SlotRole) => void
  onNext:   () => void
  onSkip:   () => void
}) {
  const doneCount = OPTIONAL_SLOTS.filter(s => slots[s.role]?.status === 'done').length

  return (
    <div style={{ ...base, padding: '28px 40px', display: 'flex', flexDirection: 'column' }}>
      <StepDots step="optional" />

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: ACCENT, textTransform: 'uppercase', marginBottom: 8 }}>
        Step 2 of 2 — Optional
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
        More photos, more life
      </h2>
      <p style={{ fontSize: 13, color: MUTED, margin: '0 0 20px' }}>
        Each extra photo unlocks a new animation state. You can always add more later.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1 }}>
        {OPTIONAL_SLOTS.map(slot => (
          <div key={slot.role} style={{
            display: 'flex', gap: 10, padding: 14,
            background: CARD, borderRadius: 10,
            border: `1px solid ${slots[slot.role]?.status === 'done' ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.07)'}`,
          }}>
            <CatGuide role={slot.role} size={80} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#fff' }}>{slot.label}</div>
              <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{slot.tip}</div>
              <div style={{ flex: 1 }} />
              <UploadSlot
                role={slot.role}
                state={slots[slot.role] ?? { status: 'empty' }}
                onUpload={onUpload}
                onRemove={onRemove}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
        <button style={btnGhost} onClick={onSkip}>
          Skip for now →
        </button>
        <button style={btnPrimary} onClick={onNext}>
          {doneCount > 0 ? `Continue with ${doneCount + 1} photo${doneCount + 1 > 1 ? 's' : ''} →` : 'Continue →'}
        </button>
      </div>
    </div>
  )
}

// ─── Step: Launch ──────────────────────────────────────────────────────────────

function LaunchStep({
  slots, catName, setCatName, onLaunch, stage,
}: {
  slots:       SlotMap
  catName:     string
  setCatName:  (n: string) => void
  onLaunch:    () => void
  stage:       null | 'segmenting' | 'done'
}) {
  const photoCount = Object.values(slots).filter(s => s?.status === 'done').length

  return (
    <div style={{ ...base, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 56px', textAlign: 'center' }}>
      <StepDots step="launch" />

      <div style={{ marginBottom: 20 }}>
        <CatGuide role="face" size={96} />
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>
        What's your cat's name?
      </h2>
      <p style={{ fontSize: 13, color: MUTED, margin: '0 0 24px' }}>
        {photoCount} photo{photoCount !== 1 ? 's' : ''} ready — your pet is about to come to life.
      </p>

      <input
        type="text"
        value={catName}
        onChange={e => setCatName(e.target.value)}
        placeholder="e.g. Mochi, Luna, Biscuit…"
        maxLength={32}
        autoFocus
        style={{
          width: 280, padding: '11px 16px', fontSize: 16,
          background: CARD, border: `2px solid ${ACCENT}40`,
          borderRadius: 10, color: TEXT, outline: 'none',
          textAlign: 'center', marginBottom: 24,
          boxSizing: 'border-box',
        }}
      />

      {stage === 'segmenting' && (
        <div style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>
          <div style={{ marginBottom: 8 }}>Analysing {catName.trim() || 'your cat'}…</div>
          <div style={{ height: 4, width: 240, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', margin: '0 auto' }}>
            <div style={{ height: '100%', background: ACCENT, borderRadius: 2, animation: 'slide 1.5s ease-in-out infinite' }} />
          </div>
          <style>{`@keyframes slide { 0%{width:0%} 50%{width:80%} 100%{width:100%} }`}</style>
        </div>
      )}

      <button
        style={{ ...btnPrimary, fontSize: 16, padding: '14px 40px', opacity: stage ? 0.6 : 1 }}
        onClick={onLaunch}
        disabled={stage !== null}
      >
        {stage === 'segmenting'
          ? 'Preparing…'
          : stage === 'done'
          ? 'Launching!'
          : `Bring ${catName.trim() || 'My Cat'} to Life!`}
      </button>

      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 20 }}>
        Background removal runs locally — the first time takes ~15 s to load the AI model.
      </p>
    </div>
  )
}

// ─── Root wizard ───────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const [step,     setStep]     = useState<WizardStep>('welcome')
  const [slots,    setSlots]    = useState<SlotMap>({})
  const [catName,  setCatName]  = useState('')
  const [stage,    setStage]    = useState<null | 'segmenting' | 'done'>(null)
  const [warnings, setWarnings] = useState<ValidationIssue[]>([])

  const setSlotState = useCallback((role: SlotRole, state: SlotState) => {
    setSlots(prev => ({ ...prev, [role]: state }))
  }, [])

  const handleUpload = useCallback(async (role: SlotRole) => {
    const filePath = await window.catpet.openFileDialog()
    if (!filePath) return

    setSlotState(role, { status: 'loading', progress: 0 })
    setWarnings([])

    try {
      const rawDataUrl = await window.catpet.readFile(filePath)

      const validation = await validatePhoto(rawDataUrl)
      if (!validation.passed) {
        setSlotState(role, { status: 'error', message: validation.issues[0]?.message ?? 'Invalid photo.' })
        return
      }
      if (validation.issues.length > 0) setWarnings(validation.issues)

      const bgRemovedUrl = await removeBackground(rawDataUrl, progress => {
        setSlotState(role, { status: 'loading', progress })
      })

      await window.catpet.savePhoto(role, bgRemovedUrl)
      setSlotState(role, { status: 'done', dataUrl: bgRemovedUrl })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Processing failed.'
      setSlotState(role, { status: 'error', message: msg.length > 72 ? msg.slice(0, 72) + '…' : msg })
    }
  }, [setSlotState])

  const handleRemove = useCallback(async (role: SlotRole) => {
    await window.catpet.deletePhoto(role)
    setSlotState(role, { status: 'empty' })
  }, [setSlotState])

  const handleLaunch = async () => {
    setStage('segmenting')
    try {
      const filledSlots = Object.entries(slots)
        .filter(([, s]) => s?.status === 'done')
        .map(([role]) => role as SlotRole)

      const config = {
        name:       catName.trim() || 'My Cat',
        photoSlots: Object.fromEntries(filledSlots.map(r => [r, `${r}.png`])),
        createdAt:  Date.now(),
        updatedAt:  Date.now(),
      }
      await window.catpet.storeSet('catConfig', config)

      const primaryState = slots.primary
      if (primaryState?.status === 'done') {
        try {
          const { segmentCat } = await import('../processing/body-segmenter')
          const result = await segmentCat(primaryState.dataUrl)
          await window.catpet.saveSegments(
            'primary',
            result.layers.map(l => ({ id: l.id, dataUrl: l.dataUrl })),
          )
          await window.catpet.saveRig('primary', result.rig)
        } catch {
          // Non-fatal: overlay falls back to flat photo
        }
      }

      setStage('done')
      window.catpet.catReady()
    } catch {
      setStage(null)
    }
  }

  if (step === 'welcome') return <WelcomeStep onNext={() => setStep('primary')} />

  if (step === 'primary') return (
    <PrimaryStep
      state={slots.primary ?? { status: 'empty' }}
      onUpload={handleUpload}
      onRemove={handleRemove}
      onNext={() => setStep('optional')}
      warnings={warnings}
      onDismissWarnings={() => setWarnings([])}
    />
  )

  if (step === 'optional') return (
    <OptionalStep
      slots={slots}
      onUpload={handleUpload}
      onRemove={handleRemove}
      onNext={() => setStep('launch')}
      onSkip={() => setStep('launch')}
    />
  )

  return (
    <LaunchStep
      slots={slots}
      catName={catName}
      setCatName={setCatName}
      onLaunch={handleLaunch}
      stage={stage}
    />
  )
}
