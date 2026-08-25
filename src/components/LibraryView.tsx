import { usePlayer } from '../state/PlayerProvider'
import { TrackRow } from './TrackRow'
import { matches } from '../search/normalize'
import { PlayIcon, ShuffleIcon } from './icons'
import { songCount } from '../i18n/labels'
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
          <strong>无法加载 tracks.json</strong>
          {loadError}
        </div>
      </div>
    )
  }
  if (!library) return <div className="content"><div className="empty">正在加载资料库…</div></div>

  // Resolve the current view to a title and an ordered list of tracks.
  let title = '歌曲'
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
    title = pl?.name ?? '播放列表'
    ids = pl?.trackIds ?? []
    subtitle = songCount(ids.length)
  } else {
    subtitle = songCount(ids.length)
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
          <div className="album-hero-art-wrap">
            <img
              className="album-hero-art"
              src={album.artworkUrl ?? (tracks[0] ? artworkFor(tracks[0]) : '')}
              alt=""
            />
          </div>
          <div className="album-hero-meta">
            <h2>{album.title}</h2>
            <div className="artist">{album.artist}</div>
            <div className="detail">
              {album.year ? `${album.year} · ` : ''}
              {songCount(album.trackIds.length)}
            </div>
            <div className="album-actions">
              <button className="btn-filled" onClick={() => playFrom()} disabled={tracks.length === 0}>
                <PlayIcon size={13} /> 播放
              </button>
              <button className="btn-tinted" onClick={shufflePlay} disabled={tracks.length === 0}>
                <ShuffleIcon size={13} /> 随机播放
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
              <strong>没有找到“{query}”</strong>
              换一个歌名或歌手试试。
            </>
          ) : view.kind === 'playlist' ? (
            <>
              <strong>这个播放列表是空的</strong>
              在资料库中用歌曲右侧的 + 按钮添加歌曲。
            </>
          ) : (
            <>
              <strong>还没有歌曲</strong>
              请在 <code>public/tracks.json</code> 中添加条目。
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
