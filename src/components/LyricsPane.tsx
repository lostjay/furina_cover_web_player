import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlayer, useTime } from '../state/PlayerProvider'
import { activeLineIndex, parseLrc } from '../lyrics/parseLrc'
import type { LyricLine, Track } from '../types'

/** Resolve lyrics from the manifest, fetching an .lrc file only if needed. */
function useLyrics(track: Track | undefined): LyricLine[] | null {
  const [fetched, setFetched] = useState<Record<string, LyricLine[]>>({})

  useEffect(() => {
    if (!track?.lrcUrl || track.lyrics || fetched[track.id]) return
    let cancelled = false
    const { id, lrcUrl } = track
    fetch(lrcUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text) => {
        if (!cancelled) setFetched((prev) => ({ ...prev, [id]: parseLrc(text) }))
      })
      .catch((err: unknown) => console.warn('[lyrics] could not load', lrcUrl, err))
    return () => {
      cancelled = true
    }
  }, [track, fetched])

  return useMemo(() => {
    if (!track) return null
    if (track.lyrics) return track.lyrics
    return fetched[track.id] ?? null
  }, [track, fetched])
}

export function LyricsPane({ className = 'fs-lyrics' }: { className?: string }) {
  const { track, engine } = usePlayer()
  const { currentTime } = useTime()
  const lines = useLyrics(track)

  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  // Manual scrolling pauses follow-along so the reader can look ahead.
  const suspendUntil = useRef(0)

  const active = lines ? activeLineIndex(lines, currentTime) : -1

  useEffect(() => {
    if (active < 0 || Date.now() < suspendUntil.current) return
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [active])

  if (!track) return null

  if (!lines || lines.length === 0) {
    return (
      <div className={className}>
        <div className="lyrics-empty">
          <div>
            No lyrics for this track yet.
            <br />
            <span style={{ fontSize: 12.5 }}>
              Add a <code>lyrics</code> array or an <code>lrcUrl</code> in tracks.json.
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      onWheel={() => (suspendUntil.current = Date.now() + 3000)}
      onTouchMove={() => (suspendUntil.current = Date.now() + 3000)}
    >
      {lines.map((line, i) => (
        <button
          key={`${line.t}-${i}`}
          ref={i === active ? activeRef : undefined}
          className={`lyric-line${i === active ? ' is-active' : ''}${i < active ? ' is-past' : ''}`}
          onClick={() => engine.seek(line.t)}
        >
          {line.text || ' '}
        </button>
      ))}
    </div>
  )
}
