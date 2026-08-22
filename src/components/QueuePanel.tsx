import { useState } from 'react'
import { usePlayer } from '../state/PlayerProvider'
import { CloseIcon, TrashIcon } from './icons'

/**
 * "Playing Next". Reordering works by pointer drag and, for keyboard users,
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
    <aside className="queue-panel" aria-label="Playing next">
      <div className="queue-head">
        <h2>Playing Next</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close queue">
          <CloseIcon size={17} />
        </button>
      </div>

      {state.order.length === 0 ? (
        <div className="empty">The queue is empty.</div>
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
                  aria-label={`${track.title} — position ${i + 1} of ${state.order.length}. Alt with arrow keys to reorder.`}
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
                    aria-label={`Remove ${track.title} from queue`}
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
