import type { LyricLine as AmllLyricLine } from '@applemusic-like-lyrics/core'
import type { LyricLine as ManifestLyricLine } from '../types'

/**
 * Adapt the manifest's simple inline lyric format to AMLL's line model.
 *
 * The manifest has always accepted `[{ t: seconds, text }]`, and that contract
 * is documented, so it keeps working — it just cannot express word-level
 * timing. Each line becomes a single "word" spanning the whole line, which is
 * exactly how AMLL represents LRC-grade lyrics internally.
 *
 * For real karaoke highlighting, use a TTML file instead.
 */
export function inlineToAmll(
  lines: readonly ManifestLyricLine[],
  trackDurationSec?: number,
): AmllLyricLine[] {
  const sorted = [...lines].sort((a, b) => a.t - b.t)

  // A line ends when the next one starts. The last line runs to the end of the
  // track, falling back to a few seconds when the duration is not known yet.
  const trackEndMs =
    trackDurationSec && trackDurationSec > 0 ? Math.round(trackDurationSec * 1000) : undefined

  return sorted.map((line, i) => {
    const startTime = Math.round(line.t * 1000)
    const next = sorted[i + 1]
    const endTime = next
      ? Math.round(next.t * 1000)
      : Math.max(startTime, trackEndMs ?? startTime + 5000)

    return {
      words: line.text ? [{ word: line.text, startTime, endTime }] : [],
      translatedLyric: '',
      romanLyric: '',
      startTime,
      endTime,
      isBG: false,
      isDuet: false,
    }
  })
}
