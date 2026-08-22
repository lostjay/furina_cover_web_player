import { useEffect, useState } from 'react'
import { LyricPlayer } from '@applemusic-like-lyrics/react'
import type { LyricLine as AmllLyricLine } from '@applemusic-like-lyrics/core'
import { usePlayer, useTimeMs } from '../state/PlayerProvider'
import { loadLyrics } from '../lyrics/loadLyrics'
import type { Track } from '../types'

/** Resolve the current track's lyrics, cancelling in flight on a track change. */
function useLyricLines(track: Track | undefined): AmllLyricLine[] | null {
  const [lines, setLines] = useState<AmllLyricLine[] | null>(null)

  useEffect(() => {
    if (!track) {
      setLines(null)
      return
    }
    const controller = new AbortController()
    // Clear immediately so the previous track's lyrics never show against the
    // new one while a fetch is in flight.
    setLines(null)
    void loadLyrics(track, controller.signal).then((result) => {
      if (!controller.signal.aborted) setLines(result)
    })
    return () => controller.abort()
  }, [track])

  return lines
}

export function LyricsPane({ className = 'fs-lyrics' }: { className?: string }) {
  const { track, engine, state } = usePlayer()
  // Integer milliseconds at frame rate — required for word-level animation.
  const currentTime = useTimeMs()
  const lines = useLyricLines(track)

  if (!track) return null

  if (!lines || lines.length === 0) {
    return (
      <div className={className}>
        <div className="lyrics-empty">
          <div>
            No lyrics for this track yet.
            <br />
            <span style={{ fontSize: 12.5 }}>
              Add a <code>ttmlUrl</code>, <code>lrcUrl</code> or inline <code>lyrics</code> in
              tracks.json.
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <LyricPlayer
      className={className}
      lyricLines={lines}
      currentTime={currentTime}
      playing={state.isPlaying}
      alignAnchor="center"
      alignPosition={0.4}
      enableSpring
      enableBlur
      enableScale
      onLyricLineClick={(e) => {
        const line = lines[e.lineIndex]
        // AMLL times are milliseconds; the engine seeks in seconds.
        if (line) engine.seek(line.startTime / 1000)
      }}
    />
  )
}
