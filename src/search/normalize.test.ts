import { describe, it, expect } from 'vitest'
import { normalize, matches } from './normalize'

describe('normalize', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalize('Café  DELUXE')).toBe('cafe deluxe')
  })

  it('leaves CJK untouched', () => {
    expect(normalize('赤伶')).toBe('赤伶')
  })
})

describe('matches', () => {
  it('substring-matches CJK without word boundaries', () => {
    expect(matches('赤伶', '伶')).toBe(true)
    expect(matches('赤伶', '青')).toBe(false)
  })

  it('is case and diacritic insensitive', () => {
    expect(matches('Furina Cover', 'furina')).toBe(true)
    expect(matches('Chì Líng', 'chi ling')).toBe(true)
  })

  it('requires every term to appear', () => {
    expect(matches('Furina Covers 赤伶', 'furina 赤伶')).toBe(true)
    expect(matches('Furina Covers', 'furina nope')).toBe(false)
  })

  it('treats an empty query as matching everything', () => {
    expect(matches('anything', '   ')).toBe(true)
  })
})
