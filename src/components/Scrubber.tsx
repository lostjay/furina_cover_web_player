import { useCallback, useRef, useState } from 'react'

interface Props {
  value: number
  max: number
  buffered?: number
  onSeek: (seconds: number) => void
  label: string
  /** Arrow-key increment. */
  step?: number
}

/**
 * Pointer- and keyboard-driven slider.
 *
 * While dragging we render a local value so the thumb tracks the finger even
 * though the audio element only reports position a few times a second.
 */
export function Scrubber({ value, max, buffered = 0, onSeek, label, step = 5 }: Props) {
  const railRef = useRef<HTMLDivElement>(null)
  const [dragValue, setDragValue] = useState<number | null>(null)

  const shown = dragValue ?? value
  const pct = max > 0 ? Math.min(100, (shown / max) * 100) : 0
  const bufferedPct = max > 0 ? Math.min(100, (buffered / max) * 100) : 0

  const valueAt = useCallback(
    (clientX: number) => {
      const rail = railRef.current
      if (!rail || max <= 0) return 0
      const rect = rail.getBoundingClientRect()
      const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width
      return Math.max(0, Math.min(1, ratio)) * max
    },
    [max],
  )

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (max <= 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragValue(valueAt(e.clientX))
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragValue === null) return
    setDragValue(valueAt(e.clientX))
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragValue === null) return
    onSeek(valueAt(e.clientX))
    setDragValue(null)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? step
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? -step
          : e.key === 'Home'
            ? -Infinity
            : e.key === 'End'
              ? Infinity
              : null
    if (delta === null) return
    e.preventDefault()
    onSeek(Math.max(0, Math.min(max, value + delta)))
  }

  return (
    <div
      ref={railRef}
      className={`rail${dragValue !== null ? ' is-dragging' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={formatTime(shown)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <div className="rail-bg">
        <div className="rail-buffered" style={{ width: `${bufferedPct}%` }} />
        <div className="rail-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="rail-knob" style={{ left: `${pct}%` }} />
    </div>
  )
}

/** mm:ss, or "--:--" when the duration is not known yet. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
