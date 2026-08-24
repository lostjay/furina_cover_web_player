import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { AudioEngine, type TimeSnapshot } from '../audio/AudioEngine'
import { parseLibrary, type Library, type Track } from '../types'
import { resolveLibraryUrls } from '../media/resolveMediaUrl'
import {
  playerReducer,
  initialPlayerState,
  currentTrackId,
  type PlayerAction,
  type PlayerState,
} from './playerReducer'
import { loadPlaylists, savePlaylists, createPlaylist, type Playlist } from './playlists'
import { readJson, writeJson } from './storage'
import { generateCoverDataUri } from '../art/generateCover'

interface PlayerContextValue {
  library: Library | null
  loadError: string | null
  state: PlayerState
  dispatch: (action: PlayerAction) => void
  engine: AudioEngine
  track: Track | undefined
  artworkFor: (track: Track) => string
  playlists: Playlist[]
  addPlaylist: (name: string) => void
  removePlaylist: (id: string) => void
  addToPlaylist: (playlistId: string, trackId: string) => void
  removeFromPlaylist: (playlistId: string, trackId: string) => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

/**
 * Dev-only escape hatch so automated tests can run against a local fixture
 * instead of the remote media host. Ignored in production builds.
 */
function manifestUrl(): string {
  const base = import.meta.env.BASE_URL
  if (import.meta.env.DEV) {
    const which = new URLSearchParams(window.location.search).get('manifest')
    if (which === 'dev') return `${base}tracks.dev.json`
  }
  return `${base}tracks.json`
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => new AudioEngine(), [])
  const [library, setLibrary] = useState<Library | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists())

  const [state, dispatch] = useReducer(playerReducer, initialPlayerState, (init) => ({
    ...init,
    volume: readJson<number>('volume', 1),
  }))

  const track = useMemo(() => {
    const id = currentTrackId(state)
    return id && library ? library.tracks.get(id) : undefined
  }, [state, library])

  // Attach the audio elements once the provider actually commits, so a
  // StrictMode-discarded engine instance never leaves orphans in the DOM.
  useEffect(() => {
    engine.attach()
    return () => engine.detach()
  }, [engine])

  // --- manifest ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    fetch(manifestUrl())
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => resolveLibraryUrls(parseLibrary(json)))
      .then((library) => {
        if (cancelled) return
        setLibrary(library)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // --- engine <- state --------------------------------------------------
  useEffect(() => {
    if (!track) return
    engine.load(track.audioUrl)
  }, [engine, track])

  useEffect(() => {
    if (state.isPlaying) void engine.play()
    else engine.pause()
    // `track` is a dependency because a new src needs play() called again.
  }, [engine, state.isPlaying, track])

  useEffect(() => {
    engine.setVolume(state.volume)
    writeJson('volume', state.volume)
  }, [engine, state.volume])

  useEffect(() => {
    engine.setMuted(state.muted)
  }, [engine, state.muted])

  // Warm the next track's connection so skipping feels instant.
  useEffect(() => {
    const nextId = state.index >= 0 ? state.order[state.index + 1] : undefined
    const nextTrack = nextId && library ? library.tracks.get(nextId) : undefined
    engine.preload(nextTrack?.audioUrl ?? null)
  }, [engine, state.order, state.index, library])

  // --- engine -> state --------------------------------------------------
  const failedRef = useRef(state.failed)
  failedRef.current = state.failed

  useEffect(() => {
    const el = engine.el
    const onEnded = () => {
      // Repeat-one restarts here; the reducer only keeps `isPlaying` true.
      dispatch({ type: 'next', auto: true })
      engine.seek(0)
    }
    const onError = () => {
      const id = currentTrackId(state)
      if (!id) return
      console.warn('[audio] failed to load', engine.el.currentSrc || engine.el.src)
      dispatch({ type: 'markFailed', trackId: id })
      // Don't strand the user on a dead URL — move on if there is somewhere to go.
      if (state.index < state.order.length - 1 || state.repeat === 'all') {
        dispatch({ type: 'next', auto: true })
      } else {
        dispatch({ type: 'pause' })
      }
    }
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
    }
  }, [engine, state])

  // Keep React's notion of playing in sync with the element, which can pause
  // itself (interruptions, focus loss, OS media keys).
  useEffect(() => {
    const el = engine.el
    const onPlay = () => dispatch({ type: 'play' })
    const onPause = () => {
      if (!el.ended) dispatch({ type: 'pause' })
    }
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
    }
  }, [engine])

  // --- artwork ----------------------------------------------------------
  const artworkFor = useCallback(
    (t: Track) => t.artworkUrl ?? generateCoverDataUri(t.id, t.title),
    [],
  )

  // --- OS media integration --------------------------------------------
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.albumTitle,
      artwork: [{ src: artworkFor(track), sizes: '512x512' }],
    })
    const handlers: [MediaSessionAction, () => void][] = [
      ['play', () => dispatch({ type: 'play' })],
      ['pause', () => dispatch({ type: 'pause' })],
      ['previoustrack', () => dispatch({ type: 'prev' })],
      ['nexttrack', () => dispatch({ type: 'next' })],
    ]
    for (const [action, fn] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, fn)
      } catch {
        // Not every action is supported everywhere.
      }
    }
  }, [track, artworkFor])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused'
  }, [state.isPlaying])

  // --- playlists --------------------------------------------------------
  const persist = useCallback((next: Playlist[]) => {
    setPlaylists(next)
    savePlaylists(next)
  }, [])

  const value: PlayerContextValue = {
    library,
    loadError,
    state,
    dispatch,
    engine,
    track,
    artworkFor,
    playlists,
    addPlaylist: (name) => persist([...playlists, createPlaylist(name)]),
    removePlaylist: (id) => persist(playlists.filter((p) => p.id !== id)),
    addToPlaylist: (playlistId, trackId) =>
      persist(
        playlists.map((p) =>
          p.id === playlistId && !p.trackIds.includes(trackId)
            ? { ...p, trackIds: [...p.trackIds, trackId] }
            : p,
        ),
      ),
    removeFromPlaylist: (playlistId, trackId) =>
      persist(
        playlists.map((p) =>
          p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId) } : p,
        ),
      ),
  }

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>')
  return ctx
}

/**
 * Subscribe to playback position WITHOUT re-rendering the tree. Only the
 * scrubber and the lyrics pane call this.
 */
export function useTime(): TimeSnapshot {
  const { engine } = usePlayer()
  return useSyncExternalStore(engine.subscribeTime, engine.getTimeSnapshot, engine.getTimeSnapshot)
}

/**
 * Playback position in integer milliseconds, updated every animation frame.
 *
 * Only the AMLL lyric player should use this — it drives word-level animation
 * and needs the resolution. Everything else wants `useTime()`.
 */
export function useTimeMs(): number {
  const { engine } = usePlayer()
  return useSyncExternalStore(engine.subscribeRaf, engine.getRafTimeMs, engine.getRafTimeMs)
}
