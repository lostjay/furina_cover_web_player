/**
 * Imperative wrapper over a single long-lived <audio> element.
 *
 * Two deliberate decisions:
 *  1. The element is created once and never replaced — only `.src` changes.
 *     Constructing a new element mid-session loses the user-gesture autoplay
 *     grant, so the second track would silently fail to start.
 *  2. `crossOrigin` is never set. Plain media playback performs no CORS check;
 *     setting the attribute would opt into one. The media host currently sends
 *     an invalid `Access-Control-Allow-Origin: https://*.lostjay.xyz` (a wildcard
 *     in the subdomain position matches nothing), so any CORS-gated request
 *     would fail outright.
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
  private snapshot: TimeSnapshot = EMPTY
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
  }

  subscribeTime = (fn: EngineListener): (() => void) => {
    this.timeListeners.add(fn)
    return () => this.timeListeners.delete(fn)
  }

  getTimeSnapshot = (): TimeSnapshot => this.snapshot

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
    this.el.remove()
    this.preloadEl.remove()
  }
}
