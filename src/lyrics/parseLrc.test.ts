import { describe, it, expect } from 'vitest'
import { parseLrc, activeLineIndex } from './parseLrc'

describe('parseLrc', () => {
  it('parses the common timestamp forms', () => {
    const lines = parseLrc(['[00:01]a', '[00:02.5]b', '[00:03.25]c', '[01:00.500]d'].join('\n'))
    expect(lines.map((l) => l.t)).toEqual([1, 2.5, 3.25, 60.5])
    expect(lines.map((l) => l.text)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('treats a 2-digit fraction as hundredths, 1-digit as tenths', () => {
    expect(parseLrc('[00:00.05]x')[0]?.t).toBeCloseTo(0.05)
    expect(parseLrc('[00:00.5]x')[0]?.t).toBeCloseTo(0.5)
  })

  it('supports the legacy colon fraction separator', () => {
    expect(parseLrc('[00:10:50]x')[0]?.t).toBeCloseTo(10.5)
  })

  it('expands repeated timestamps on one line', () => {
    const lines = parseLrc('[00:10][01:10]chorus')
    expect(lines).toEqual([
      { t: 10, text: 'chorus' },
      { t: 70, text: 'chorus' },
    ])
  })

  it('sorts out-of-order input', () => {
    expect(parseLrc('[00:30]late\n[00:10]early').map((l) => l.text)).toEqual(['early', 'late'])
  })

  it('skips ID tags and junk without throwing', () => {
    const lines = parseLrc('[ar:Furina]\n[ti:赤伶]\nnot a lyric\n\n[00:05]real')
    expect(lines).toEqual([{ t: 5, text: 'real' }])
  })

  it('keeps CJK text and empty interlude lines intact', () => {
    const lines = parseLrc('[00:01]戏一折 水袖起落\n[00:09]')
    expect(lines[0]?.text).toBe('戏一折 水袖起落')
    expect(lines[1]?.text).toBe('')
  })

  it('does not treat a bracket inside lyric text as a timestamp', () => {
    expect(parseLrc('[00:01]hello [00:99] world')[0]?.text).toBe('hello [00:99] world')
  })

  it('returns empty for empty input', () => {
    expect(parseLrc('')).toEqual([])
  })
})

describe('activeLineIndex', () => {
  const lines = [
    { t: 0, text: 'a' },
    { t: 10, text: 'b' },
    { t: 20, text: 'c' },
  ]

  it('returns -1 before the first line', () => {
    expect(activeLineIndex([{ t: 5, text: 'x' }], 1)).toBe(-1)
  })

  it('is inclusive of the line start', () => {
    expect(activeLineIndex(lines, 10)).toBe(1)
  })

  it('holds the last line past the end', () => {
    expect(activeLineIndex(lines, 9999)).toBe(2)
  })

  it('handles an empty list', () => {
    expect(activeLineIndex([], 5)).toBe(-1)
  })
})
