import type { LyricLine } from '../types'

/**
 * Parse an LRC file into timed lines.
 *
 * Handles the forms found in the wild:
 *   [mm:ss]        [mm:ss.xx]      [mm:ss.xxx]      [mm:ss:xx] (legacy)
 * plus multiple timestamps on one line (repeated choruses), ID tags like
 * [ar:...] which are skipped, and lines that arrive out of order.
 */
const TIMESTAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g

export function parseLrc(source: string): LyricLine[] {
  const lines: LyricLine[] = []

  for (const rawLine of source.split(/\r?\n/)) {
    TIMESTAMP.lastIndex = 0
    const stamps: number[] = []
    let match: RegExpExecArray | null
    let end = 0

    while ((match = TIMESTAMP.exec(rawLine)) !== null) {
      // Only leading timestamps count; a bracket later in the line is lyric text.
      if (match.index !== end) break
      end = match.index + match[0].length

      const minutes = Number(match[1])
      const seconds = Number(match[2])
      const fracRaw = match[3]
      let fraction = 0
      if (fracRaw !== undefined) {
        // "5" means .5s, "05" means .05s, "050" means .050s
        fraction = Number(fracRaw) / 10 ** fracRaw.length
      }
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) continue
      stamps.push(minutes * 60 + seconds + fraction)
    }

    if (stamps.length === 0) continue
    const text = rawLine.slice(end).trim()
    for (const t of stamps) lines.push({ t, text })
  }

  lines.sort((a, b) => a.t - b.t)
  return lines
}

/**
 * Index of the line active at `time`, or -1 before the first line.
 * Binary search — this runs on every timeupdate.
 */
export function activeLineIndex(lines: readonly LyricLine[], time: number): number {
  let lo = 0
  let hi = lines.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const line = lines[mid]
    if (line === undefined) break
    if (line.t <= time) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}
