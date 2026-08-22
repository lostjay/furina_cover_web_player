import { readJson, writeJson } from './storage'

export interface Playlist {
  id: string
  name: string
  trackIds: string[]
  createdAt: number
}

const KEY = 'playlists'

function isPlaylist(v: unknown): v is Playlist {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    Array.isArray(p.trackIds) &&
    p.trackIds.every((t) => typeof t === 'string') &&
    typeof p.createdAt === 'number'
  )
}

/** Drops anything that no longer matches the shape rather than throwing. */
export function loadPlaylists(): Playlist[] {
  const raw = readJson<unknown>(KEY, [])
  if (!Array.isArray(raw)) return []
  return raw.filter(isPlaylist)
}

export function savePlaylists(playlists: Playlist[]): void {
  writeJson(KEY, playlists)
}

export function createPlaylist(name: string): Playlist {
  return {
    id: `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    trackIds: [],
    createdAt: Date.now(),
  }
}
