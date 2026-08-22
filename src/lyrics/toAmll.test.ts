import { describe, it, expect } from 'vitest'
import { inlineToAmll } from './toAmll'
import { formatFromUrl } from './loadLyrics'

describe('inlineToAmll', () => {
  const lines = [
    { t: 0, text: 'first' },
    { t: 3, text: 'second' },
    { t: 6.5, text: 'third' },
  ]

  it('converts seconds to integer milliseconds', () => {
    const out = inlineToAmll(lines, 10)
    expect(out.map((l) => l.startTime)).toEqual([0, 3000, 6500])
    expect(out.every((l) => Number.isInteger(l.startTime))).toBe(true)
  })

  it('ends each line where the next one begins', () => {
    const out = inlineToAmll(lines, 10)
    expect(out[0]?.endTime).toBe(3000)
    expect(out[1]?.endTime).toBe(6500)
  })

  it('runs the last line to the end of the track', () => {
    expect(inlineToAmll(lines, 10)[2]?.endTime).toBe(10000)
  })

  it('falls back to a fixed tail when the duration is unknown', () => {
    // Duration is not known until loadedmetadata fires for a remote file.
    expect(inlineToAmll(lines)[2]?.endTime).toBe(6500 + 5000)
  })

  it('never produces an endTime before its startTime', () => {
    // A track shorter than its last cue must not invert the range.
    const out = inlineToAmll([{ t: 30, text: 'late' }], 5)
    expect(out[0]?.endTime).toBeGreaterThanOrEqual(out[0]!.startTime)
  })

  it('wraps each line as a single word spanning the line', () => {
    const [first] = inlineToAmll(lines, 10)
    expect(first?.words).toEqual([{ word: 'first', startTime: 0, endTime: 3000 }])
  })

  it('emits no words for an empty interlude line', () => {
    expect(inlineToAmll([{ t: 1, text: '' }], 5)[0]?.words).toEqual([])
  })

  it('sorts out-of-order input before deriving end times', () => {
    const out = inlineToAmll(
      [
        { t: 6, text: 'c' },
        { t: 0, text: 'a' },
        { t: 3, text: 'b' },
      ],
      9,
    )
    expect(out.map((l) => l.words[0]?.word)).toEqual(['a', 'b', 'c'])
    expect(out[0]?.endTime).toBe(3000)
  })

  it('fills in the fields AMLL requires', () => {
    const [first] = inlineToAmll(lines, 10)
    expect(first).toMatchObject({ translatedLyric: '', romanLyric: '', isBG: false, isDuet: false })
  })

  it('handles an empty list', () => {
    expect(inlineToAmll([], 10)).toEqual([])
  })
})

describe('formatFromUrl', () => {
  it('recognises the word-level formats', () => {
    expect(formatFromUrl('https://x/a.ttml')).toBe('ttml')
    expect(formatFromUrl('https://x/a.yrc')).toBe('yrc')
    expect(formatFromUrl('https://x/a.qrc')).toBe('qrc')
    expect(formatFromUrl('https://x/a.lys')).toBe('lys')
  })

  it('treats .xml as TTML', () => {
    expect(formatFromUrl('https://x/lyrics.xml')).toBe('ttml')
  })

  it('defaults to lrc for unknown or absent extensions', () => {
    expect(formatFromUrl('https://x/a.lrc')).toBe('lrc')
    expect(formatFromUrl('https://x/lyrics')).toBe('lrc')
  })

  it('ignores query strings and fragments', () => {
    expect(formatFromUrl('https://x/a.ttml?v=2#frag')).toBe('ttml')
  })

  it('is case insensitive', () => {
    expect(formatFromUrl('https://x/A.TTML')).toBe('ttml')
  })
})
