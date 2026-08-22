/**
 * Pure playback state: what is queued, what is playing, and how the queue
 * advances. Kept free of DOM access so it can be unit-tested directly.
 *
 * `currentTime` deliberately lives in AudioEngine, not here — see AudioEngine.ts.
 */

export type RepeatMode = 'off' | 'all' | 'one'

export interface PlayerState {
  /** Track ids in playback order (already shuffled when `shuffle` is on). */
  order: string[]
  /** Playback order before shuffling, so un-shuffling restores it. */
  sourceOrder: string[]
  /** Index into `order`; -1 when nothing is loaded. */
  index: number
  isPlaying: boolean
  shuffle: boolean
  repeat: RepeatMode
  volume: number
  muted: boolean
  /** Track ids whose audio failed to load, so the UI can mark them. */
  failed: string[]
}

export const initialPlayerState: PlayerState = {
  order: [],
  sourceOrder: [],
  index: -1,
  isPlaying: false,
  shuffle: false,
  repeat: 'off',
  volume: 1,
  muted: false,
  failed: [],
}

export type PlayerAction =
  | { type: 'playQueue'; order: string[]; startId?: string }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'next'; auto?: boolean }
  | { type: 'prev' }
  | { type: 'jumpTo'; index: number }
  | { type: 'toggleShuffle' }
  | { type: 'cycleRepeat' }
  | { type: 'setVolume'; volume: number }
  | { type: 'toggleMute' }
  | { type: 'enqueueNext'; trackId: string }
  | { type: 'enqueueLast'; trackId: string }
  | { type: 'removeAt'; index: number }
  | { type: 'moveInQueue'; from: number; to: number }
  | { type: 'markFailed'; trackId: string }

/** Fisher-Yates over a copy. */
function shuffled(ids: readonly string[]): string[] {
  const out = ids.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = out[i]
    const b = out[j]
    if (a === undefined || b === undefined) continue
    out[i] = b
    out[j] = a
  }
  return out
}

/** Move `id` to the front so toggling shuffle never interrupts what is playing. */
function shuffleKeepingCurrent(ids: readonly string[], currentId: string | undefined): string[] {
  if (currentId === undefined) return shuffled(ids)
  const rest = shuffled(ids.filter((id) => id !== currentId))
  return [currentId, ...rest]
}

export function currentTrackId(state: PlayerState): string | undefined {
  return state.index >= 0 ? state.order[state.index] : undefined
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'playQueue': {
      const sourceOrder = action.order.slice()
      if (sourceOrder.length === 0) return { ...state, order: [], sourceOrder: [], index: -1, isPlaying: false }
      const startId = action.startId ?? sourceOrder[0]
      const order = state.shuffle ? shuffleKeepingCurrent(sourceOrder, startId) : sourceOrder
      const index = startId === undefined ? 0 : Math.max(0, order.indexOf(startId))
      return { ...state, order, sourceOrder, index, isPlaying: true }
    }

    case 'play':
      return state.index < 0 ? state : { ...state, isPlaying: true }

    case 'pause':
      return { ...state, isPlaying: false }

    case 'toggle':
      return state.index < 0 ? state : { ...state, isPlaying: !state.isPlaying }

    case 'next': {
      if (state.order.length === 0) return state
      // Repeat-one only loops on natural end, never on an explicit skip.
      if (action.auto && state.repeat === 'one') return { ...state, isPlaying: true }
      const last = state.index >= state.order.length - 1
      if (!last) return { ...state, index: state.index + 1, isPlaying: true }
      if (state.repeat === 'all') return { ...state, index: 0, isPlaying: true }
      // End of queue: hold on the final track, stopped.
      return action.auto ? { ...state, isPlaying: false } : state
    }

    case 'prev': {
      if (state.order.length === 0) return state
      if (state.index > 0) return { ...state, index: state.index - 1, isPlaying: true }
      if (state.repeat === 'all') return { ...state, index: state.order.length - 1, isPlaying: true }
      return { ...state, index: 0, isPlaying: true }
    }

    case 'jumpTo': {
      if (action.index < 0 || action.index >= state.order.length) return state
      return { ...state, index: action.index, isPlaying: true }
    }

    case 'toggleShuffle': {
      const currentId = currentTrackId(state)
      if (state.shuffle) {
        const order = state.sourceOrder.slice()
        const index = currentId === undefined ? state.index : order.indexOf(currentId)
        return { ...state, shuffle: false, order, index: index < 0 ? 0 : index }
      }
      const order = shuffleKeepingCurrent(state.sourceOrder, currentId)
      return { ...state, shuffle: true, order, index: currentId === undefined ? state.index : 0 }
    }

    case 'cycleRepeat': {
      const next: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' }
      return { ...state, repeat: next[state.repeat] }
    }

    case 'setVolume':
      return { ...state, volume: Math.max(0, Math.min(1, action.volume)), muted: false }

    case 'toggleMute':
      return { ...state, muted: !state.muted }

    case 'enqueueNext': {
      if (state.index < 0) return { ...state, order: [action.trackId], sourceOrder: [action.trackId], index: 0 }
      const order = state.order.slice()
      order.splice(state.index + 1, 0, action.trackId)
      return { ...state, order }
    }

    case 'enqueueLast': {
      if (state.index < 0) return { ...state, order: [action.trackId], sourceOrder: [action.trackId], index: 0 }
      return { ...state, order: [...state.order, action.trackId] }
    }

    case 'removeAt': {
      if (action.index < 0 || action.index >= state.order.length) return state
      const order = state.order.slice()
      order.splice(action.index, 1)
      let index = state.index
      if (action.index < state.index) index -= 1
      else if (action.index === state.index) index = Math.min(index, order.length - 1)
      if (order.length === 0) return { ...state, order, index: -1, isPlaying: false }
      return { ...state, order, index }
    }

    case 'moveInQueue': {
      const { from, to } = action
      if (from === to) return state
      if (from < 0 || from >= state.order.length) return state
      if (to < 0 || to >= state.order.length) return state
      const order = state.order.slice()
      const [moved] = order.splice(from, 1)
      if (moved === undefined) return state
      order.splice(to, 0, moved)
      // Keep `index` pointing at whatever is actually playing.
      let index = state.index
      if (from === state.index) index = to
      else if (from < state.index && to >= state.index) index -= 1
      else if (from > state.index && to <= state.index) index += 1
      return { ...state, order, index }
    }

    case 'markFailed':
      return state.failed.includes(action.trackId)
        ? state
        : { ...state, failed: [...state.failed, action.trackId] }

    default:
      return state
  }
}
