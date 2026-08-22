/**
 * Domain model + manifest parsing.
 *
 * The manifest (public/tracks.json) is hand-edited by the repo owner, so parsing
 * is deliberately forgiving: a malformed track is dropped with a console warning
 * rather than failing the whole load and leaving the user with an empty library.
 */

export interface LyricLine {
  /** Seconds from track start. */
  t: number
  text: string
}

export interface Track {
  id: string
  title: string
  artist: string
  albumId: string
  albumTitle: string
  audioUrl: string
  /** Undefined until `loadedmetadata` supplies the real value. */
  durationSec?: number
  artworkUrl?: string
  lyrics?: LyricLine[]
  lrcUrl?: string
}

export interface Album {
  id: string
  title: string
  artist: string
  year?: number
  artworkUrl?: string
  trackIds: string[]
}

export interface Library {
  albums: Album[]
  /** Every track, keyed by id — the single source of truth for track lookups. */
  tracks: Map<string, Track>
  /** Stable display order, matching album order then track order. */
  order: string[]
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined

function parseLyrics(v: unknown): LyricLine[] | undefined {
  if (!Array.isArray(v)) return undefined
  const lines: LyricLine[] = []
  for (const raw of v) {
    if (!isObj(raw)) continue
    const t = num(raw.t)
    const text = typeof raw.text === 'string' ? raw.text : undefined
    if (t === undefined || text === undefined) continue
    lines.push({ t, text })
  }
  if (lines.length === 0) return undefined
  // Timestamps may be authored out of order; downstream lookup binary-searches.
  lines.sort((a, b) => a.t - b.t)
  return lines
}

/**
 * Build a Library from raw manifest JSON. Never throws: anything unusable is
 * skipped and reported, so one bad entry cannot break the whole player.
 */
export function parseLibrary(raw: unknown): Library {
  const albums: Album[] = []
  const tracks = new Map<string, Track>()
  const order: string[] = []

  const warn = (msg: string) => console.warn(`[manifest] ${msg}`)

  if (!isObj(raw)) {
    warn('manifest root is not an object; library is empty')
    return { albums, tracks, order }
  }
  if (!Array.isArray(raw.albums)) {
    warn('manifest has no "albums" array; library is empty')
    return { albums, tracks, order }
  }

  for (const [ai, rawAlbum] of raw.albums.entries()) {
    if (!isObj(rawAlbum)) {
      warn(`album #${ai} is not an object; skipped`)
      continue
    }
    const albumId = str(rawAlbum.id)
    const albumTitle = str(rawAlbum.title)
    if (!albumId || !albumTitle) {
      warn(`album #${ai} is missing "id" or "title"; skipped`)
      continue
    }
    if (albums.some((a) => a.id === albumId)) {
      warn(`duplicate album id "${albumId}"; skipped`)
      continue
    }
    const albumArtist = str(rawAlbum.artist) ?? 'Unknown Artist'
    const albumArtwork = str(rawAlbum.artworkUrl)
    const trackIds: string[] = []

    const rawTracks = Array.isArray(rawAlbum.tracks) ? rawAlbum.tracks : []
    for (const [ti, rawTrack] of rawTracks.entries()) {
      if (!isObj(rawTrack)) {
        warn(`${albumId} track #${ti} is not an object; skipped`)
        continue
      }
      const id = str(rawTrack.id)
      const title = str(rawTrack.title)
      const audioUrl = str(rawTrack.audioUrl)
      if (!id || !title || !audioUrl) {
        warn(`${albumId} track #${ti} needs "id", "title" and "audioUrl"; skipped`)
        continue
      }
      if (tracks.has(id)) {
        warn(`duplicate track id "${id}"; skipped`)
        continue
      }
      const track: Track = {
        id,
        title,
        artist: str(rawTrack.artist) ?? albumArtist,
        albumId,
        albumTitle,
        audioUrl,
      }
      const duration = num(rawTrack.durationSec)
      if (duration) track.durationSec = duration
      const art = str(rawTrack.artworkUrl) ?? albumArtwork
      if (art) track.artworkUrl = art
      const lyrics = parseLyrics(rawTrack.lyrics)
      if (lyrics) track.lyrics = lyrics
      const lrcUrl = str(rawTrack.lrcUrl)
      if (lrcUrl) track.lrcUrl = lrcUrl

      tracks.set(id, track)
      trackIds.push(id)
      order.push(id)
    }

    if (trackIds.length === 0) {
      warn(`album "${albumId}" has no usable tracks; skipped`)
      continue
    }

    const album: Album = { id: albumId, title: albumTitle, artist: albumArtist, trackIds }
    const year = num(rawAlbum.year)
    if (year) album.year = year
    if (albumArtwork) album.artworkUrl = albumArtwork
    albums.push(album)
  }

  return { albums, tracks, order }
}
