import { usePlayer } from '../state/PlayerProvider'
import { MusicIcon, PlusIcon, TrashIcon } from './icons'
import type { View } from '../App'

interface Props {
  view: View
  onNavigate: (view: View) => void
  onNewPlaylist: () => void
}

export function Sidebar({ view, onNavigate, onNewPlaylist }: Props) {
  const { library, playlists, removePlaylist } = usePlayer()

  return (
    <nav className="sidebar" aria-label="Library">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        Furina Covers
      </div>

      <div className="nav-heading">Library</div>
      <button
        className="nav-item"
        aria-current={view.kind === 'library'}
        onClick={() => onNavigate({ kind: 'library' })}
      >
        <span className="glyph"><MusicIcon size={15} /></span>
        <span className="label">Songs</span>
      </button>

      {/* One album duplicates "Songs", and it is the home view anyway. */}
      {library && library.albums.length > 1 && (
        <>
          <div className="nav-heading">Albums</div>
          {library.albums.map((album) => (
            <button
              key={album.id}
              className="nav-item"
              aria-current={view.kind === 'album' && view.albumId === album.id}
              onClick={() => onNavigate({ kind: 'album', albumId: album.id })}
            >
              <span className="glyph">♪</span>
              <span className="label">{album.title}</span>
            </button>
          ))}
        </>
      )}

      <div className="nav-heading">Playlists</div>
      {playlists.map((pl) => (
        <div key={pl.id} style={{ display: 'flex', alignItems: 'center' }}>
          <button
            className="nav-item"
            aria-current={view.kind === 'playlist' && view.playlistId === pl.id}
            onClick={() => onNavigate({ kind: 'playlist', playlistId: pl.id })}
          >
            <span className="glyph">☰</span>
            <span className="label">{pl.name}</span>
          </button>
          <button
            className="icon-btn"
            style={{ width: 26, height: 26, flex: 'none' }}
            onClick={() => removePlaylist(pl.id)}
            aria-label={`Delete playlist ${pl.name}`}
          >
            <TrashIcon size={13} />
          </button>
        </div>
      ))}
      <button className="sidebar-action" onClick={onNewPlaylist}>
        <PlusIcon size={14} /> New Playlist
      </button>

      {/*
        AGPL-3.0 section 13: this player is conveyed over a network, so users
        interacting with it must be offered a way to get the source.
      */}
      <a
        className="sidebar-source"
        href="https://github.com/lostjay/furina_cover_web_player"
        target="_blank"
        rel="noreferrer noopener"
      >
        Source code (AGPL-3.0)
      </a>
    </nav>
  )
}
