import { usePlayer } from '../state/PlayerProvider'
import { TrackRow } from './TrackRow'
import { matches } from '../search/normalize'
import { PlayIcon, ShuffleIcon } from './icons'
import type { Track } from '../types'
import type { View } from '../App'

interface Props {
  view: View
  query: string
}

export function LibraryView({ view, query }: Props) {
  const { library, playlists, dispatch, artworkFor, loadError } = usePlayer()

  if (loadError) {
    return (
      <div className="content">
        <div className="empty">
          <strong>Could not load tracks.json</strong>
          {loadError}
        </div>
      </div>
    )
  }
  if (!library) return <div className="content"><div className="empty">Loading library…</div></div>

  // Resolve the current view to a title and an ordered list of tracks.
  let title = 'Songs'
  let subtitle = ''
  let ids: string[] = library.order
  let album = null

  if (view.kind === 'album') {
    album = library.albums.find((a) => a.id === view.albumId) ?? null
    if (album) {
      title = album.title
      ids = album.trackIds
    }
  } else if (view.kind === 'playlist') {
    const pl = playlists.find((p) => p.id === view.playlistId)
    title = pl?.name ?? 'Playlist'
    ids = pl?.trackIds ?? []
    subtitle = `${ids.length} song${ids.length === 1 ? '' : 's'}`
  } else {
    subtitle = `${ids.length} song${ids.length === 1 ? '' : 's'}`
  }

  const all = ids
    .map((id) => library.tracks.get(id))
    .filter((t): t is Track => t !== undefined)

  const tracks = query.trim()
    ? all.filter((t) => matches(`${t.title} ${t.artist} ${t.albumTitle}`, query))
    : all

  const playFrom = (startId?: string) =>
    dispatch({ type: 'playQueue', order: tracks.map((t) => t.id), startId })

  const shufflePlay = () => {
    dispatch({ type: 'playQueue', order: tracks.map((t) => t.id) })
    dispatch({ type: 'toggleShuffle' })
  }

  return (
    <div className="content">
      {album ? (
        <div className="album-hero">
          <img
            className="album-hero-art"
            src={album.artworkUrl ?? (tracks[0] ? artworkFor(tracks[0]) : '')}
            alt=""
          />
          <div className="album-hero-meta">
            <h2>{album.title}</h2>
            <div className="artist">{album.artist}</div>
            <div className="detail">
              {album.year ? `${album.year} · ` : ''}
              {album.trackIds.length} song{album.trackIds.length === 1 ? '' : 's'}
            </div>
            <div className="album-actions">
              <button className="btn-filled" onClick={() => playFrom()} disabled={tracks.length === 0}>
                <PlayIcon size={13} /> Play
              </button>
              <button className="btn-tinted" onClick={shufflePlay} disabled={tracks.length === 0}>
                <ShuffleIcon size={13} /> Shuffle
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="page-header">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
      )}

      {tracks.length === 0 ? (
        <div className="empty">
          {query.trim() ? (
            <>
              <strong>No results for “{query}”</strong>
              Try a different title or artist.
            </>
          ) : view.kind === 'playlist' ? (
            <>
              <strong>This playlist is empty</strong>
              Add songs from the library with the + button on a row.
            </>
          ) : (
            <>
              <strong>No tracks yet</strong>
              Add entries to <code>public/tracks.json</code>.
            </>
          )}
        </div>
      ) : (
        <ul className="track-list">
          {tracks.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} onPlay={() => playFrom(track.id)} />
          ))}
        </ul>
      )}
    </div>
  )
}
