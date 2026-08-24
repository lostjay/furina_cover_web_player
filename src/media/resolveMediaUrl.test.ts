import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveMediaUrl, resolveLibraryUrls } from './resolveMediaUrl'
import type { Library } from '../types'

function jsonResponse(body: unknown, init?: { ok?: boolean; contentType?: string }) {
  return {
    ok: init?.ok ?? true,
    headers: { get: () => init?.contentType ?? 'application/json' },
    json: async () => body,
  } as unknown as Response
}

describe('resolveMediaUrl', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Each case uses its own URL: resolveMediaUrl caches by URL at module
  // scope (by design, so a shared artworkUrl is only ever fetched once), and
  // that cache persists across these tests.

  it('resolves a /public/… URL to the "url" field of its JSON response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ url: 'https://cdn.example.com/real.jpg' }))
    const resolved = await resolveMediaUrl('https://lostjay.xyz/public/case-1/cover.jpeg')
    expect(resolved).toBe('https://cdn.example.com/real.jpg')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://lostjay.xyz/public/case-1/cover.jpeg',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('leaves a URL outside /public/… untouched, with no network call', async () => {
    const resolved = await resolveMediaUrl('https://example.com/song.mp3')
    expect(resolved).toBe('https://example.com/song.mp3')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to the original URL when the response is not JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { contentType: 'image/jpeg' }))
    const url = 'https://lostjay.xyz/public/case-3/cover.jpeg'
    expect(await resolveMediaUrl(url)).toBe(url)
  })

  it('falls back to the original URL on a non-ok response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false }))
    const url = 'https://lostjay.xyz/public/case-4/cover.jpeg'
    expect(await resolveMediaUrl(url)).toBe(url)
  })

  it('falls back to the original URL when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const url = 'https://lostjay.xyz/public/case-5/cover.jpeg'
    expect(await resolveMediaUrl(url)).toBe(url)
  })

  it('caches by URL, so the same path is only ever fetched once', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ url: 'https://cdn.example.com/real.jpg' }))
    const url = 'https://lostjay.xyz/public/case-6/cover.jpeg'
    await Promise.all([resolveMediaUrl(url), resolveMediaUrl(url)])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('resolveLibraryUrls', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        jsonResponse({ url: `${url}?resolved=1` }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves every /public/… field across albums and tracks', async () => {
    const library: Library = {
      albums: [
        {
          id: 'curtain',
          title: 'Album',
          artist: 'Artist',
          artworkUrl: 'https://lostjay.xyz/public/cover.jpg',
          trackIds: ['t1'],
        },
      ],
      tracks: new Map([
        [
          't1',
          {
            id: 't1',
            title: 'Track',
            artist: 'Artist',
            albumId: 'curtain',
            albumTitle: 'Album',
            audioUrl: 'https://lostjay.xyz/public/track.mp3',
            artworkUrl: 'https://lostjay.xyz/public/cover.jpg',
            lrcUrl: 'https://lostjay.xyz/public/track.lrc',
          },
        ],
      ]),
      order: ['t1'],
    }

    const resolved = await resolveLibraryUrls(library)
    expect(resolved.albums[0]?.artworkUrl).toBe('https://lostjay.xyz/public/cover.jpg?resolved=1')
    const track = resolved.tracks.get('t1')
    expect(track?.audioUrl).toBe('https://lostjay.xyz/public/track.mp3?resolved=1')
    expect(track?.artworkUrl).toBe('https://lostjay.xyz/public/cover.jpg?resolved=1')
    expect(track?.lrcUrl).toBe('https://lostjay.xyz/public/track.lrc?resolved=1')
    expect(track?.ttmlUrl).toBeUndefined()
  })
})
