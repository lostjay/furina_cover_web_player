import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlayer } from './state/PlayerProvider'
import { Sidebar } from './components/Sidebar'
import { LibraryView } from './components/LibraryView'
import { NowPlayingBar } from './components/NowPlayingBar'
import { FullScreenPlayer } from './components/FullScreenPlayer'
import { QueuePanel } from './components/QueuePanel'
import { SearchIcon, SunIcon, MoonIcon, QueueIcon } from './components/icons'
import { readJson, writeJson } from './state/storage'

export type View =
  | { kind: 'library' }
  | { kind: 'album'; albumId: string }
  | { kind: 'playlist'; playlistId: string }

type Theme = 'light' | 'dark' | 'system'

export function App() {
  const { state, dispatch, engine, track, addPlaylist, library } = usePlayer()

  const [view, setView] = useState<View>({ kind: 'library' })
  const [query, setQuery] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const [theme, setTheme] = useState<Theme>(() => readJson<Theme>('theme', 'system'))

  const searchRef = useRef<HTMLInputElement>(null)
  // Tracks whether the user has chosen a view themselves, so the single-album
  // redirect below never yanks them off a page they navigated to.
  const navigatedRef = useRef(false)

  // With exactly one album, "Songs" is a bare list of the same tracks. Open on
  // the album itself so the app lands on artwork rather than a single row.
  // A second album restores the normal library home automatically.
  useEffect(() => {
    if (navigatedRef.current || !library) return
    const only = library.albums.length === 1 ? library.albums[0] : undefined
    if (only) setView({ kind: 'album', albumId: only.id })
  }, [library])

  // `system` removes the attribute so the prefers-color-scheme rules apply.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    writeJson('theme', theme)
  }, [theme])

  const cycleTheme = useCallback(() => {
    setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system'))
  }, [])

  // --- keyboard shortcuts ---------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true

      if (e.key === 'Escape') {
        if (dialogOpen) setDialogOpen(false)
        else if (fullscreen) setFullscreen(false)
        else if (queueOpen) setQueueOpen(false)
        else if (typing) (target as HTMLInputElement).blur()
        return
      }

      if (typing || e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          dispatch({ type: 'toggle' })
          break
        case 'ArrowRight':
          e.preventDefault()
          engine.seek(engine.el.currentTime + 5)
          break
        case 'ArrowLeft':
          e.preventDefault()
          engine.seek(engine.el.currentTime - 5)
          break
        case 'ArrowUp':
          e.preventDefault()
          dispatch({ type: 'setVolume', volume: state.volume + 0.05 })
          break
        case 'ArrowDown':
          e.preventDefault()
          dispatch({ type: 'setVolume', volume: state.volume - 0.05 })
          break
        case 'm': case 'M': dispatch({ type: 'toggleMute' }); break
        case 'n': case 'N': dispatch({ type: 'next' }); break
        case 'p': case 'P': dispatch({ type: 'prev' }); break
        case 'f': case 'F': if (track) setFullscreen((v) => !v); break
        case 'l': case 'L': if (track) setFullscreen(true); break
        case '/':
          e.preventDefault()
          searchRef.current?.focus()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, engine, state.volume, track, fullscreen, queueOpen, dialogOpen])

  const themeLabel = theme === 'system' ? 'Theme: system' : `Theme: ${theme}`

  return (
    <div className="app">
      <Sidebar
        view={view}
        onNavigate={(v) => {
          navigatedRef.current = true
          setView(v)
          setQuery('')
        }}
        onNewPlaylist={() => {
          setPlaylistName('')
          setDialogOpen(true)
        }}
      />

      <main className="main">
        <div className="topbar">
          <label className="search">
            <SearchIcon size={15} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Search songs, artists…"
              aria-label="Search library"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div style={{ flex: 1 }} />
          <button
            className="icon-btn"
            onClick={() => setQueueOpen((v) => !v)}
            aria-pressed={queueOpen}
            aria-label="Playing next"
          >
            <QueueIcon size={17} />
          </button>
          <button className="icon-btn" onClick={cycleTheme} aria-label={themeLabel} title={themeLabel}>
            {theme === 'dark' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
          </button>
        </div>

        <LibraryView view={view} query={query} />
      </main>

      <NowPlayingBar
        onExpand={() => setFullscreen(true)}
        onToggleQueue={() => setQueueOpen((v) => !v)}
        queueOpen={queueOpen}
      />

      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
      {fullscreen && <FullScreenPlayer onClose={() => setFullscreen(false)} />}

      {dialogOpen && (
        <>
          <div className="scrim" onClick={() => setDialogOpen(false)} />
          <div className="dialog" role="dialog" aria-modal="true" aria-label="New playlist">
            <h2>New Playlist</h2>
            <input
              autoFocus
              value={playlistName}
              placeholder="Playlist name"
              aria-label="Playlist name"
              onChange={(e) => setPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && playlistName.trim()) {
                  addPlaylist(playlistName.trim())
                  setDialogOpen(false)
                }
              }}
            />
            <div className="dialog-actions">
              <button className="cancel" onClick={() => setDialogOpen(false)}>Cancel</button>
              <button
                className="confirm"
                disabled={!playlistName.trim()}
                onClick={() => {
                  addPlaylist(playlistName.trim())
                  setDialogOpen(false)
                }}
              >
                Create
              </button>
            </div>
          </div>
        </>
      )}

      {/* Announce track changes to screen readers without a visual change. */}
      <div className="visually-hidden" role="status" aria-live="polite">
        {track ? `${track.title} by ${track.artist}` : ''}
      </div>
    </div>
  )
}
