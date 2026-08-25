import { usePlayer, useTime } from '../state/PlayerProvider'
import { Scrubber, formatTime } from './Scrubber'
import { LyricsPane } from './LyricsPane'
import { Backdrop } from './Backdrop'
import {
  PlayIcon, PauseIcon, NextIcon, PrevIcon, ShuffleIcon, RepeatIcon, ChevronDownIcon,
  LyricsIcon,
} from './icons'
import { repeatLabel } from '../i18n/labels'

interface Props {
  onClose: () => void
  lyricsVisible: boolean
  onToggleLyrics: () => void
}

export function FullScreenPlayer({ onClose, lyricsVisible, onToggleLyrics }: Props) {
  const { state, dispatch, engine, track, artworkFor } = usePlayer()
  const { currentTime, duration, buffered } = useTime()

  if (!track) return null
  const art = artworkFor(track)
  const total = duration > 0 ? duration : (track.durationSec ?? 0)
  // AMLL's background renderer gets livelier when the track has lyrics.
  const hasLyrics = Boolean(track.lyrics?.length || track.ttmlUrl || track.lrcUrl)
  // The pane is mounted whenever lyrics are switched on, even for a track with
  // none — it renders a helpful empty state, which is the long-standing desktop
  // behaviour. The toggle itself is hidden when there is nothing to show, so a
  // phone never lands on an empty pane.
  const showLyrics = lyricsVisible

  return (
    <div
      className={[
        'fullscreen',
        showLyrics ? 'has-lyrics' : '',
        state.isPlaying ? 'is-playing' : '',
      ].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label="正在播放"
    >
      <Backdrop artwork={art} playing={state.isPlaying} hasLyrics={hasLyrics} />

      <div className="fs-head">
        <button className="icon-btn" onClick={onClose} aria-label="收起全屏播放器">
          <ChevronDownIcon size={20} />
        </button>
        <div className="fs-album-name">{track.albumTitle}</div>
        {hasLyrics ? (
          <button
            className="icon-btn"
            onClick={onToggleLyrics}
            aria-pressed={showLyrics}
            aria-label={showLyrics ? '隐藏歌词' : '显示歌词'}
            title={showLyrics ? '隐藏歌词' : '显示歌词'}
          >
            <LyricsIcon size={18} />
          </button>
        ) : (
          <div style={{ width: 32 }} />
        )}
      </div>

      <div className="fs-body">
        <div className="fs-compact" aria-hidden="true">
          <img className="fs-compact-art" src={art} alt="" />
          <div className="fs-compact-meta">
            <div className="fs-compact-title">{track.title}</div>
            <div className="fs-compact-artist">{track.artist}</div>
          </div>
        </div>

        <div className="fs-left">
          <div className={`fs-art-wrap${state.isPlaying ? '' : ' is-paused'}`}>
            <img className={`fs-art${state.isPlaying ? '' : ' is-paused'}`} src={art} alt="" />
          </div>

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
                label="播放进度"
              />
              <span className="scrubber-time right">{total > 0 ? formatTime(total) : '--:--'}</span>
            </div>

            <div className="fs-transport">
              <button
                className="icon-btn"
                onClick={() => dispatch({ type: 'toggleShuffle' })}
                aria-pressed={state.shuffle}
                aria-label="随机播放"
              >
                <ShuffleIcon size={18} />
              </button>
              <button className="icon-btn" onClick={() => dispatch({ type: 'prev' })} aria-label="上一首">
                <PrevIcon size={26} />
              </button>
              <button
                className="fs-play"
                onClick={() => dispatch({ type: 'toggle' })}
                aria-label={state.isPlaying ? '暂停' : '播放'}
              >
                {state.isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
              </button>
              <button className="icon-btn" onClick={() => dispatch({ type: 'next' })} aria-label="下一首">
                <NextIcon size={26} />
              </button>
              <button
                className="icon-btn"
                onClick={() => dispatch({ type: 'cycleRepeat' })}
                aria-pressed={state.repeat !== 'off'}
                aria-label={repeatLabel(state.repeat)}
              >
                <RepeatIcon size={18} />
              </button>
            </div>
          </div>
        </div>

        {showLyrics && <LyricsPane />}
      </div>
    </div>
  )
}
