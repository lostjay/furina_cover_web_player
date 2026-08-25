import { useState } from 'react'
import { usePlayer } from '../state/PlayerProvider'
import { CloseIcon, TrashIcon } from './icons'

/**
 * 播放队列。Reordering works by pointer drag and, for keyboard users,
 * alt+ArrowUp / alt+ArrowDown on a focused row.
 */
export function QueuePanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch, library, artworkFor } = usePlayer()
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  if (!library) return null

  const move = (from: number, to: number) => {
    if (to < 0 || to >= state.order.length) return
    dispatch({ type: 'moveInQueue', from, to })
  }

  return (
    <aside className="queue-panel" aria-label="播放队列">
      <div className="queue-head">
        <h2>播放队列</h2>
        <button className="icon-btn" onClick={onClose} aria-label="关闭播放队列">
          <CloseIcon size={17} />
        </button>
      </div>

      {state.order.length === 0 ? (
        <div className="empty">播放队列是空的。</div>
      ) : (
        <ul className="queue-list">
          {state.order.map((id, i) => {
            const track = library.tracks.get(id)
            if (!track) return null
            const classes = [
              'queue-item',
              i === state.index ? 'is-current' : '',
              i === dragFrom ? 'is-dragging' : '',
              i === dragOver && dragFrom !== null && i !== dragFrom ? 'is-drop-target' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <li key={`${id}-${i}`}>
                <div
                  className={classes}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(i)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragFrom !== null) move(dragFrom, i)
                    setDragFrom(null)
                    setDragOver(null)
                  }}
                  onDragEnd={() => {
                    setDragFrom(null)
                    setDragOver(null)
                  }}
                  onKeyDown={(e) => {
                    if (!e.altKey) return
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      move(i, i - 1)
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      move(i, i + 1)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${track.title} — 第 ${i + 1} 首，共 ${state.order.length} 首。按住 Alt 加方向键可调整顺序。`}
                  onClick={() => dispatch({ type: 'jumpTo', index: i })}
                >
                  <img className="queue-art" src={artworkFor(track)} alt="" />
                  <span style={{ minWidth: 0 }}>
                    <span className="queue-title">{track.title}</span>
                    <span className="queue-artist">{track.artist}</span>
                  </span>
                  <button
                    className="icon-btn"
                    style={{ width: 26, height: 26 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'removeAt', index: i })
                    }}
                    aria-label={`将 ${track.title} 移出播放队列`}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
