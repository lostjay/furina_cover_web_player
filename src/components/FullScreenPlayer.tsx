import { usePlayer, useTime } from '../state/PlayerProvider'
import { Scrubber, formatTime } from './Scrubber'
import { LyricsPane } from './LyricsPane'
import { Backdrop } from './Backdrop'
import { generateCoverDataUri } from '../art/generateCover'
import {
  PlayIcon, PauseIcon, NextIcon, PrevIcon, ShuffleIcon, RepeatIcon, ChevronDownIcon,
} from './icons'

export function FullScreenPlayer({ onClose }: { onClose: () => void }) {
  const { state, dispatch, engine, track, artworkFor } = usePlayer()
  const { currentTime, duration, buffered } = useTime()

  if (!track) return null
  const art = artworkFor(track)
  const total = duration > 0 ? duration : (track.durationSec ?? 0)
  // AMLL's background renderer gets livelier when the track has lyrics.
  const hasLyrics = Boolean(track.lyrics?.length || track.ttmlUrl || track.lrcUrl)

  return (
    <div className="fullscreen" role="dialog" aria-modal="true" aria-label="Now playing">
      <Backdrop
        artwork={art}
        fallbackArtwork={generateCoverDataUri(track.id, track.title)}
        playing={state.isPlaying}
        hasLyrics={hasLyrics}
      />

      <div className="fs-head">
        <button className="icon-btn" onClick={onClose} aria-label="Close full screen player">
          <ChevronDownIcon size={20} />
        </button>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>{track.albumTitle}</div>
        <div style={{ width: 32 }} />
      </div>

      <div className="fs-body">
        <div className="fs-left">
          <img className={`fs-art${state.isPlaying ? '' : ' is-paused'}`} src={art} alt="" />

          <div className="fs-meta">
            <h2>{track.title}</h2>
            <p>{track.artist}</p>
          </div>

          <div className="fs-controls">
            <div className="scrubber">
              <span className="scrubber-time">{formatTime(currentTime)}</span>
              <Scrubber
                value={currentTime}
                max={total}
                buffered={buffered}
                onSeek={(s) => engine.seek(s)}
                label="Playback position"
              />
              <span className="scrubber-time right">{total > 0 ? formatTime(total) : '--:--'}</span>
            </div>

            <div className="fs-transport">
              <button
                className="icon-btn"
                onClick={() => dispatch({ type: 'toggleShuffle' })}
                aria-pressed={state.shuffle}
                aria-label="Shuffle"
              >
                <ShuffleIcon size={18} />
              </button>
              <button className="icon-btn" onClick={() => dispatch({ type: 'prev' })} aria-label="Previous track">
                <PrevIcon size={26} />
              </button>
              <button
                className="fs-play"
                onClick={() => dispatch({ type: 'toggle' })}
                aria-label={state.isPlaying ? 'Pause' : 'Play'}
              >
                {state.isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
              </button>
              <button className="icon-btn" onClick={() => dispatch({ type: 'next' })} aria-label="Next track">
                <NextIcon size={26} />
              </button>
              <button
                className="icon-btn"
                onClick={() => dispatch({ type: 'cycleRepeat' })}
                aria-pressed={state.repeat !== 'off'}
                aria-label={`Repeat: ${state.repeat}`}
              >
                <RepeatIcon size={18} />
              </button>
            </div>
          </div>
        </div>

        <LyricsPane />
      </div>
    </div>
  )
}
