/**
 * Imperative wrapper over a single long-lived <audio> element.
 *
 * Two deliberate decisions:
 *  1. The element is created once and never replaced — only `.src` changes.
 *     Constructing a new element mid-session loses the user-gesture autoplay
 *     grant, so the second track would silently fail to start.
 *  2. `crossOrigin` is never set. Plain media playback performs no CORS check
 *     at all, and nothing here reads the audio's samples, so the attribute
 *     would opt into a check that buys nothing.
 *
 * `currentTime` is exposed through a subscribe/getSnapshot pair rather than React
 * state: it changes ~4x/second and would otherwise re-render the whole tree.
 */

export type EngineListener = () => void

export interface TimeSnapshot {
  currentTime: number
  duration: number
  buffered: number
}

const EMPTY: TimeSnapshot = { currentTime: 0, duration: 0, buffered: 0 }

export class AudioEngine {
  readonly el: HTMLAudioElement
  /** Hidden second element that warms the next track's connection. */
  private readonly preloadEl: HTMLAudioElement
  private timeListeners = new Set<EngineListener>()
  private stateListeners = new Set<EngineListener>()
  private rafListeners = new Set<EngineListener>()
  private snapshot: TimeSnapshot = EMPTY
  private rafTimeMs = 0
  private rafHandle: number | null = null
  private preloadedUrl: string | null = null

  constructor() {
    this.el = new Audio()
    this.el.preload = 'metadata'
    this.preloadEl = new Audio()
    this.preloadEl.preload = 'metadata'
    this.preloadEl.muted = true

    this.el.setAttribute('data-audio-engine', 'main')
    this.preloadEl.setAttribute('data-audio-engine', 'preload')
    for (const el of [this.el, this.preloadEl]) el.style.display = 'none'

    const emitTime = () => {
      const { currentTime, duration } = this.el
      let buffered = 0
      try {
        const ranges = this.el.buffered
        if (ranges.length > 0) buffered = ranges.end(ranges.length - 1)
      } catch {
        // buffered throws on some browsers before metadata is known.
      }
      this.snapshot = {
        currentTime: Number.isFinite(currentTime) ? currentTime : 0,
        duration: Number.isFinite(duration) ? duration : 0,
        buffered,
      }
      for (const fn of this.timeListeners) fn()
    }

    const emitState = () => {
      for (const fn of this.stateListeners) fn()
    }

    this.el.addEventListener('timeupdate', emitTime)
    this.el.addEventListener('durationchange', emitTime)
    this.el.addEventListener('progress', emitTime)
    this.el.addEventListener('loadedmetadata', emitTime)
    this.el.addEventListener('seeked', emitTime)
    for (const ev of ['play', 'pause', 'waiting', 'playing', 'ended', 'error'] as const) {
      this.el.addEventListener(ev, emitState)
    }

    // The rAF loop only needs to spin while audio is actually moving.
    this.el.addEventListener('play', this.startRafLoop)
    this.el.addEventListener('playing', this.startRafLoop)
    this.el.addEventListener('pause', this.stopRafLoop)
    this.el.addEventListener('ended', this.stopRafLoop)
    // A seek while paused still has to move the lyric highlight.
    this.el.addEventListener('seeked', this.emitRafTime)
    this.el.addEventListener('loadedmetadata', this.emitRafTime)
  }

  subscribeTime = (fn: EngineListener): (() => void) => {
    this.timeListeners.add(fn)
    return () => this.timeListeners.delete(fn)
  }

  getTimeSnapshot = (): TimeSnapshot => this.snapshot

  // --- high-resolution position ------------------------------------------
  //
  // `timeupdate` fires around 4x/second, which is fine for a scrubber but far
  // too coarse for word-level lyric animation — the highlight would visibly
  // step. AMLL's LyricPlayer wants integer milliseconds as often as possible,
  // so this second store is driven by requestAnimationFrame.
  //
  // Kept separate from `subscribeTime` on purpose: re-rendering the scrubber at
  // 60Hz would be pure waste.

  subscribeRaf = (fn: EngineListener): (() => void) => {
    this.rafListeners.add(fn)
    // A subscriber arriving mid-playback should not wait for the next event.
    if (!this.el.paused) this.startRafLoop()
    return () => {
      this.rafListeners.delete(fn)
      if (this.rafListeners.size === 0) this.stopRafLoop()
    }
  }

  getRafTimeMs = (): number => this.rafTimeMs

  private emitRafTime = (): void => {
    const t = this.el.currentTime
    // Must be an integer: AMLL documents currentTime as integer milliseconds.
    const ms = Number.isFinite(t) ? Math.round(t * 1000) : 0
    if (ms === this.rafTimeMs) return
    this.rafTimeMs = ms
    for (const fn of this.rafListeners) fn()
  }

  private startRafLoop = (): void => {
    if (this.rafHandle !== null || typeof requestAnimationFrame === 'undefined') return
    const tick = () => {
      this.emitRafTime()
      this.rafHandle = requestAnimationFrame(tick)
    }
    this.rafHandle = requestAnimationFrame(tick)
  }

  private stopRafLoop = (): void => {
    if (this.rafHandle === null) return
    cancelAnimationFrame(this.rafHandle)
    this.rafHandle = null
    // Settle on the final position so a paused player still reads correctly.
    this.emitRafTime()
  }

  subscribeState = (fn: EngineListener): (() => void) => {
    this.stateListeners.add(fn)
    return () => this.stateListeners.delete(fn)
  }

  /** Point the element at a new URL. No-op if it is already loaded. */
  load(url: string): void {
    if (this.el.src === url) return
    this.el.src = url
    this.snapshot = EMPTY
    for (const fn of this.timeListeners) fn()
  }

  /** Warm the next track so a skip starts near-instantly. */
  preload(url: string | null): void {
    if (!url || url === this.preloadedUrl) return
    this.preloadedUrl = url
    this.preloadEl.src = url
  }

  async play(): Promise<void> {
    try {
      await this.el.play()
    } catch (err) {
      // Autoplay rejection is expected before the first user gesture; a real
      // decode/network failure surfaces separately via the 'error' event.
      if ((err as DOMException)?.name !== 'AbortError') {
        console.warn('[audio] play() rejected:', err)
      }
    }
  }

  pause(): void {
    this.el.pause()
  }

  seek(seconds: number): void {
    const { duration } = this.el
    const max = Number.isFinite(duration) && duration > 0 ? duration : Number.MAX_SAFE_INTEGER
    this.el.currentTime = Math.max(0, Math.min(seconds, max))
  }

  setVolume(v: number): void {
    this.el.volume = Math.max(0, Math.min(1, v))
  }

  setMuted(muted: boolean): void {
    this.el.muted = muted
  }

  /**
   * Put the elements in the document. A detached element plays in most
   * browsers, but some mobile engines refuse to start one.
   *
   * This is deliberately NOT done in the constructor: React StrictMode invokes
   * the `useMemo` factory twice, so a constructor with side effects would leave
   * an orphaned element in the DOM that never receives a src.
   */
  attach(): void {
    if (typeof document === 'undefined') return
    document.body.appendChild(this.el)
    document.body.appendChild(this.preloadEl)
  }

  detach(): void {
    this.el.pause()
    this.stopRafLoop()
    this.el.remove()
    this.preloadEl.remove()
  }
}
