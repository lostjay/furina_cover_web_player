import { describe, it, expect } from 'vitest'
import {
  playerReducer,
  initialPlayerState,
  currentTrackId,
  type PlayerState,
  type PlayerAction,
} from './playerReducer'

const ids = ['a', 'b', 'c', 'd']

function seed(overrides: Partial<PlayerState> = {}): PlayerState {
  const base = playerReducer(initialPlayerState, { type: 'playQueue', order: ids })
  return { ...base, ...overrides }
}

const run = (state: PlayerState, ...actions: PlayerAction[]): PlayerState =>
  actions.reduce(playerReducer, state)

describe('playQueue', () => {
  it('starts at the requested track, not the first', () => {
    const s = playerReducer(initialPlayerState, { type: 'playQueue', order: ids, startId: 'c' })
    expect(currentTrackId(s)).toBe('c')
    expect(s.isPlaying).toBe(true)
  })

  it('clears state for an empty queue', () => {
    const s = playerReducer(seed(), { type: 'playQueue', order: [] })
    expect(s.index).toBe(-1)
    expect(s.isPlaying).toBe(false)
  })
})

describe('next / prev boundaries', () => {
  it('stops at the end when repeat is off and the track ended naturally', () => {
    const s = run(seed({ index: 3 }), { type: 'next', auto: true })
    expect(s.index).toBe(3)
    expect(s.isPlaying).toBe(false)
  })

  it('does not advance past the end on a manual skip', () => {
    const s = run(seed({ index: 3 }), { type: 'next' })
    expect(s.index).toBe(3)
    expect(s.isPlaying).toBe(true)
  })

  it('wraps to the start when repeat is all', () => {
    const s = run(seed({ index: 3, repeat: 'all' }), { type: 'next', auto: true })
    expect(currentTrackId(s)).toBe('a')
    expect(s.isPlaying).toBe(true)
  })

  it('repeat-one holds the track on natural end', () => {
    const s = run(seed({ index: 1, repeat: 'one' }), { type: 'next', auto: true })
    expect(currentTrackId(s)).toBe('b')
    expect(s.isPlaying).toBe(true)
  })

  it('repeat-one still advances on an explicit skip', () => {
    const s = run(seed({ index: 1, repeat: 'one' }), { type: 'next' })
    expect(currentTrackId(s)).toBe('c')
  })

  it('prev clamps at the first track', () => {
    expect(run(seed({ index: 0 }), { type: 'prev' }).index).toBe(0)
  })

  it('prev wraps to the end when repeat is all', () => {
    const s = run(seed({ index: 0, repeat: 'all' }), { type: 'prev' })
    expect(currentTrackId(s)).toBe('d')
  })
})

describe('shuffle', () => {
  it('keeps the current track playing when enabled', () => {
    const s = run(seed({ index: 2 }), { type: 'toggleShuffle' })
    expect(s.shuffle).toBe(true)
    expect(currentTrackId(s)).toBe('c')
    expect(s.order).toHaveLength(4)
    expect([...s.order].sort()).toEqual(ids)
  })

  it('round-trips back to the original order and position', () => {
    const s = run(seed({ index: 2 }), { type: 'toggleShuffle' }, { type: 'toggleShuffle' })
    expect(s.shuffle).toBe(false)
    expect(s.order).toEqual(ids)
    expect(currentTrackId(s)).toBe('c')
  })
})

describe('queue editing', () => {
  it('enqueueNext inserts directly after the current track', () => {
    const s = run(seed({ index: 1 }), { type: 'enqueueNext', trackId: 'z' })
    expect(s.order).toEqual(['a', 'b', 'z', 'c', 'd'])
    expect(currentTrackId(s)).toBe('b')
  })

  it('removing an earlier track keeps the same one playing', () => {
    const s = run(seed({ index: 2 }), { type: 'removeAt', index: 0 })
    expect(currentTrackId(s)).toBe('c')
  })

  it('removing the last remaining track empties the queue', () => {
    const one = playerReducer(initialPlayerState, { type: 'playQueue', order: ['a'] })
    const s = run(one, { type: 'removeAt', index: 0 })
    expect(s.index).toBe(-1)
    expect(s.isPlaying).toBe(false)
  })

  it('moving the current track follows it', () => {
    const s = run(seed({ index: 0 }), { type: 'moveInQueue', from: 0, to: 2 })
    expect(s.order).toEqual(['b', 'c', 'a', 'd'])
    expect(currentTrackId(s)).toBe('a')
  })

  it('moving another track across the cursor keeps the current track', () => {
    const s = run(seed({ index: 2 }), { type: 'moveInQueue', from: 0, to: 3 })
    expect(currentTrackId(s)).toBe('c')
  })

  it('ignores out-of-range moves', () => {
    const before = seed({ index: 1 })
    expect(run(before, { type: 'moveInQueue', from: 9, to: 0 })).toBe(before)
  })
})

describe('misc', () => {
  it('cycles repeat off -> all -> one -> off', () => {
    let s = seed()
    const seen = []
    for (let i = 0; i < 3; i++) {
      s = playerReducer(s, { type: 'cycleRepeat' })
      seen.push(s.repeat)
    }
    expect(seen).toEqual(['all', 'one', 'off'])
  })

  it('setting volume unmutes', () => {
    const s = run(seed({ muted: true }), { type: 'setVolume', volume: 0.4 })
    expect(s.muted).toBe(false)
    expect(s.volume).toBe(0.4)
  })

  it('clamps volume', () => {
    expect(run(seed(), { type: 'setVolume', volume: 5 }).volume).toBe(1)
    expect(run(seed(), { type: 'setVolume', volume: -2 }).volume).toBe(0)
  })

  it('records failed tracks once', () => {
    const s = run(seed(), { type: 'markFailed', trackId: 'a' }, { type: 'markFailed', trackId: 'a' })
    expect(s.failed).toEqual(['a'])
  })

  it('toggle does nothing when nothing is loaded', () => {
    expect(playerReducer(initialPlayerState, { type: 'toggle' })).toBe(initialPlayerState)
  })
})
