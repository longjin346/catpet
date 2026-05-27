import { SLOTS } from '../utils/config'
import type { SlotRole } from '../utils/config'

interface Props {
  filledSlots: Set<SlotRole>
}

const QUALITY_LABELS = ['', 'Basic', 'Good', 'Great', 'Great', 'Excellent', 'Maximum']
const QUALITY_COLORS = ['#ddd', '#f59e0b', '#3b82f6', '#10b981', '#10b981', '#8b5cf6', '#ec4899']

export default function QualityMeter({ filledSlots }: Props) {
  const count = filledSlots.size
  const max = SLOTS.length
  const pct = Math.round((count / max) * 100)
  const label = QUALITY_LABELS[count] ?? 'Maximum'
  const color = QUALITY_COLORS[count] ?? '#ec4899'

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: '#555' }}>
          Quality: <strong style={{ color }}>{label}</strong>
        </span>
        <span style={{ fontSize: 13, color: '#888' }}>{count}/{max} photos</span>
      </div>
      <div style={{
        height: 8,
        borderRadius: 4,
        background: '#e5e7eb',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.4s ease, background 0.4s ease',
        }} />
      </div>
      {count < 3 && (
        <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
          {count === 0
            ? 'Add at least 1 photo to continue.'
            : count === 1
              ? 'Adding a face photo improves idle and sit animations.'
              : 'A sleep photo makes naps look much more natural.'}
        </p>
      )}
    </div>
  )
}
