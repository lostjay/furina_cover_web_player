import { usePlayer, useTime } from '../state/PlayerProvider'
import { Scrubber, formatTime } from './Scrubber'
import {
  PlayIcon, PauseIcon, NextIcon, PrevIcon, ShuffleIcon, RepeatIcon,
  QueueIcon, VolumeIcon, MuteIcon, ChevronDownIcon,
} from './icons'
import { repeatLabel } from '../i18n/labels'

interface Props {
  onExpand: () => void
  onToggleQueue: () => void
  queueOpen: boolean
}

export function NowPlayingBar({ onExpand, onToggleQueue, queueOpen }: Props) {
  const { state, dispatch, engine, track, artworkFor } = usePlayer()
  const { currentTime, duration, buffered } = useTime()

  // Prefer the real decoded duration; fall back to the manifest's value so the
  // total shows immediately rather than flickering "--:--" on load.
  const total = duration > 0 ? duration : (track?.durationSec ?? 0)
  const repeatLabelText = repeatLabel(state.repeat)

  return (
    <footer className="bar">
      <div className="bar-track">
        {track ? (
          <>
            <img
              className="bar-art"
              src={artworkFor(track)}
              alt=""
              onClick={onExpand}
            />
            <div className="bar-meta">
              <div className="bar-title">{track.title}</div>
              <div className="bar-artist">{track.artist}</div>
            </div>
            <button className="icon-btn" onClick={onExpand} aria-label="打开全屏播放器">
              <ChevronDownIcon size={17} />
            </button>
          </>
        ) : (
          <div className="bar-artist">暂无播放</div>
        )}
      </div>

      <div className="bar-center">
        <div className="transport">
          <button
            className="icon-btn"
            onClick={() => dispatch({ type: 'toggleShuffle' })}
            aria-pressed={state.shuffle}
            aria-label="随机播放"
          >
            <ShuffleIcon size={15} />
          </button>
          <button className="icon-btn" onClick={() => dispatch({ type: 'prev' })} aria-label="上一首">
            <PrevIcon size={17} />
          </button>
          <button
            className="play-btn"
            onClick={() => dispatch({ type: 'toggle' })}
            aria-label={state.isPlaying ? '暂停' : '播放'}
          >
            {state.isPlaying ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
          </button>
          <button className="icon-btn" onClick={() => dispatch({ type: 'next' })} aria-label="下一首">
            <NextIcon size={17} />
          </button>
          <button
            className="icon-btn"
            onClick={() => dispatch({ type: 'cycleRepeat' })}
            aria-pressed={state.repeat !== 'off'}
            aria-label={repeatLabelText}
            title={repeatLabelText}
          >
            <RepeatIcon size={15} />
            {state.repeat === 'one' && <span aria-hidden="true" style={{ fontSize: 9, marginLeft: -3 }}>1</span>}
          </button>
        </div>

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
      </div>

      <div className="bar-right">
        <div className="volume">
          <button
            className="icon-btn"
            onClick={() => dispatch({ type: 'toggleMute' })}
            aria-label={state.muted ? '取消静音' : '静音'}
          >
            {state.muted || state.volume === 0 ? <MuteIcon size={16} /> : <VolumeIcon size={16} />}
          </button>
          <Scrubber
            value={state.muted ? 0 : state.volume}
            max={1}
            step={0.05}
            onSeek={(v) => dispatch({ type: 'setVolume', volume: v })}
            label="音量"
          />
        </div>
        <button
          className="icon-btn"
          onClick={onToggleQueue}
          aria-pressed={queueOpen}
          aria-label="播放队列"
        >
          <QueueIcon size={17} />
        </button>
      </div>
    </footer>
  )
}
