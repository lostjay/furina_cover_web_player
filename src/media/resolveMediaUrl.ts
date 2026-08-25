import type { Library, Track } from '../types'

/**
 * Resolve `/public/…` manifest URLs to their real object-storage location.
 *
 * The media host does not serve these paths directly. A plain GET
 * 302-redirects to a presigned URL; asking for the same path with
 * `Accept: application/json` instead answers `{ "url": "<direct URL>" }` with
 * HTTP 200. Resolving up front means every consumer — `<audio>`, the lyric
 * fetch, artwork `<img>` tags, colour sampling — talks to object storage in a
 * single hop, with no redirect in the middle.
 *
 * Scoped to `/public/…` paths specifically, so a manifest entry pointing at
 * some other host's direct file URL is left completely alone: no extra
 * request, no assumption that the host understands this convention.
 */

const cache = new Map<string, Promise<string>>()

function isIndirectMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url, typeof window === 'undefined' ? undefined : window.location.href)
    return /^https?:$/.test(parsed.protocol) && parsed.pathname.startsWith('/public/')
  } catch {
    return false
  }
}

export function resolveMediaUrl(url: string): Promise<string> {
  if (!isIndirectMediaUrl(url)) return Promise.resolve(url)

  const cached = cache.get(url)
  if (cached) return cached

  const promise = (async () => {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) return url
      if (!(res.headers.get('content-type') ?? '').includes('application/json')) return url
      const body: unknown = await res.json()
      const resolved =
        typeof body === 'object' && body !== null && typeof (body as { url?: unknown }).url === 'string'
          ? (body as { url: string }).url
          : undefined
      return resolved || url
    } catch (err) {
      console.warn(`[media] could not resolve ${url}; using it as-is`, err)
      return url
    }
  })()

  cache.set(url, promise)
  return promise
}

/** Resolve one optional URL field, passing `undefined` through untouched. */
function resolveOptional(url: string | undefined): Promise<string | undefined> {
  return url ? resolveMediaUrl(url) : Promise.resolve(undefined)
}

/** Resolve every `/public/…` URL in a parsed library up front. */
export async function resolveLibraryUrls(library: Library): Promise<Library> {
  const albums = await Promise.all(
    library.albums.map(async (album) => ({
      ...album,
      artworkUrl: await resolveOptional(album.artworkUrl),
    })),
  )

  const trackEntries = await Promise.all(
    Array.from(library.tracks.entries()).map(async ([id, track]) => {
      const [audioUrl, artworkUrl, ttmlUrl, lrcUrl] = await Promise.all([
        resolveMediaUrl(track.audioUrl),
        resolveOptional(track.artworkUrl),
        resolveOptional(track.ttmlUrl),
        resolveOptional(track.lrcUrl),
      ])
      const resolved: Track = { ...track, audioUrl, artworkUrl, ttmlUrl, lrcUrl }
      return [id, resolved] as const
    }),
  )

  return { albums, tracks: new Map(trackEntries), order: library.order }
}
