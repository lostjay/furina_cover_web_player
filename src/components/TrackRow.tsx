import { usePlayer } from '../state/PlayerProvider'
import { formatTime } from './Scrubber'
import type { Track } from '../types'

interface Props {
  track: Track
  index: number
  onPlay: () => void
}

export function TrackRow({ track, index, onPlay }: Props) {
  const { state, track: current, artworkFor } = usePlayer()
  const isCurrent = current?.id === track.id
  const failed = state.failed.includes(track.id)

  return (
    <li>
      <button
        className={`track-row${isCurrent ? ' is-current' : ''}${failed ? ' is-failed' : ''}`}
        onClick={onPlay}
        aria-current={isCurrent ? 'true' : undefined}
      >
        <span className="track-index">
          {isCurrent && state.isPlaying ? (
            <span className="eq" aria-label="Now playing">
              <span /><span /><span />
            </span>
          ) : (
            index + 1
          )}
        </span>
        <img className="track-art" src={artworkFor(track)} alt="" />
        <span className="track-main">
          <span className="track-title">{track.title}</span>
          <span className="track-artist">{track.artist}</span>
        </span>
        {failed && <span className="track-badge">Unavailable</span>}
        <span className="track-dur">
          {track.durationSec ? formatTime(track.durationSec) : '--:--'}
        </span>
      </button>
    </li>
  )
}
