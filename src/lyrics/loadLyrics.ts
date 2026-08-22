import { parseLrc, parseTTML, parseYrc, parseQrc, parseLys } from '@applemusic-like-lyrics/lyric'
import type { LyricLine as AmllLyricLine } from '@applemusic-like-lyrics/core'
import type { LyricsFormat, Track } from '../types'
import { inlineToAmll } from './toAmll'

/**
 * Resolve a track's lyrics into AMLL's line model.
 *
 * Parsing is delegated entirely to `@applemusic-like-lyrics/lyric` — it already
 * handles every format we care about, including word-level TTML, which is the
 * whole reason for using AMLL.
 */

const PARSERS: Record<LyricsFormat, (text: string) => AmllLyricLine[]> = {
  // parseTTML returns { lines, metadata }; every other parser returns the array.
  ttml: (text) => parseTTML(text).lines,
  lrc: parseLrc,
  yrc: parseYrc,
  qrc: parseQrc,
  lys: parseLys,
}

/** Guess the format from a URL's extension, defaulting to LRC. */
export function formatFromUrl(url: string): LyricsFormat {
  // Strip query/hash before looking at the extension.
  const path = url.split(/[?#]/)[0] ?? url
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'ttml' || ext === 'xml') return 'ttml'
  if (ext === 'yrc') return 'yrc'
  if (ext === 'qrc') return 'qrc'
  if (ext === 'lys') return 'lys'
  return 'lrc'
}

export function parseLyrics(text: string, format: LyricsFormat): AmllLyricLine[] {
  return PARSERS[format](text)
}

// Dev-only handle so the e2e suite can exercise the parsers directly.
// The `window` guard matters: unit tests import this module under Node.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__parseLyrics = parseLyrics
}

/**
 * Fetch and parse a track's lyrics, or return null when it has none.
 *
 * Inline manifest lyrics win over a URL, since they need no network round-trip.
 * A failed fetch or unparseable file resolves to null rather than throwing —
 * a broken lyric file should not take down the player.
 */
export async function loadLyrics(
  track: Track,
  signal?: AbortSignal,
): Promise<AmllLyricLine[] | null> {
  if (track.lyrics?.length) return inlineToAmll(track.lyrics, track.durationSec)

  const url = track.ttmlUrl ?? track.lrcUrl
  if (!url) return null

  const format = track.lyricsFormat ?? (track.ttmlUrl ? 'ttml' : formatFromUrl(url))

  try {
    const res = await fetch(url, signal ? { signal } : undefined)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const lines = parseLyrics(await res.text(), format)
    if (lines.length === 0) {
      // Silent-empty is a real trap with TTML: AMLL drops every <p> that has no
      // `itunes:key` attribute, so a structurally valid file can yield nothing.
      console.warn(`[lyrics] ${url} parsed as ${format} but produced no lines`)
      return null
    }
    return lines
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return null
    console.warn(`[lyrics] could not load ${url} as ${format}:`, err)
    return null
  }
}
