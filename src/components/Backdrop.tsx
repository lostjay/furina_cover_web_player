import { useEffect, useState } from 'react'
import { BackgroundRender } from '@applemusic-like-lyrics/react'

/**
 * The full-screen artwork backdrop.
 *
 * Two layers, and the order matters:
 *
 *  1. `.fs-aurora` — drifting blobs painted from the palette sampled off the
 *     cover (see `src/art/palette.ts`). Pure CSS, so it always renders, and it
 *     alone guarantees the screen carries the album's colour.
 *  2. AMLL's `BackgroundRender` — the Apple Music-style fluid wash. It needs
 *     WebGL and has to decode the artwork, either of which can fail, so it sits
 *     on top of the aurora as an enhancement rather than as the whole backdrop.
 *     Previously it *was* the whole backdrop, which is why a machine without a
 *     working WebGL context saw nothing but the scrim.
 */

let webglSupported: boolean | null = null

function hasWebGL(): boolean {
  if (webglSupported !== null) return webglSupported
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    webglSupported = gl !== null
    // Release the probe context immediately; browsers cap how many can exist.
    if (gl) {
      const lose = gl.getExtension('WEBGL_lose_context')
      lose?.loseContext()
    }
  } catch {
    webglSupported = false
  }
  return webglSupported
}

/**
 * Turn an SVG data URI into a PNG one.
 *
 * The generated placeholder covers are inline SVG, and Chromium's
 * `createImageBitmap` — which the background renderer uses to upload the
 * texture — rejects SVG outright with "The source image could not be decoded".
 * Drawing it to a canvas first sidesteps that. Anything that is not an SVG data
 * URI is passed straight through.
 */
const rasterCache = new Map<string, string>()

function rasterizeSvg(url: string): Promise<string> {
  if (!url.startsWith('data:image/svg+xml')) return Promise.resolve(url)
  const cached = rasterCache.get(url)
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const size = 512
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(url)
        ctx.drawImage(img, 0, 0, size, size)
        const png = canvas.toDataURL('image/png')
        rasterCache.set(url, png)
        resolve(png)
      } catch {
        resolve(url)
      }
    }
    img.onerror = () => resolve(url)
    img.src = url
  })
}

/** Resolve the image handed to BackgroundRender, rasterised if it is an SVG. */
function useBackdropImage(artwork: string): string | null {
  const [resolved, setResolved] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void rasterizeSvg(artwork).then((url) => {
      if (live) setResolved(url)
    })
    return () => {
      live = false
    }
  }, [artwork])

  return resolved
}

/** Blob count must match the `--art-N` properties the provider publishes. */
const BLOBS = [1, 2, 3, 4, 5]

/**
 * Drifting motes — Fontaine is a nation of water, and a few slow bubbles give
 * the backdrop depth that a pure gradient cannot.
 *
 * Positions are fixed rather than random so the layout is stable across
 * re-renders and identical between reloads; a shuffle on every mount would make
 * the backdrop visibly twitch whenever the player reopened.
 */
const MOTES = [
  { left: 8, size: 7, dur: 26, delay: 0, drift: 3, peak: 0.5 },
  { left: 19, size: 4, dur: 34, delay: -12, drift: -4, peak: 0.34 },
  { left: 27, size: 11, dur: 41, delay: -22, drift: 5, peak: 0.28 },
  { left: 38, size: 5, dur: 29, delay: -6, drift: -2, peak: 0.42 },
  { left: 46, size: 8, dur: 37, delay: -17, drift: 4, peak: 0.3 },
  { left: 55, size: 3, dur: 24, delay: -3, drift: -3, peak: 0.5 },
  { left: 63, size: 13, dur: 46, delay: -28, drift: 6, peak: 0.22 },
  { left: 71, size: 6, dur: 31, delay: -9, drift: -5, peak: 0.38 },
  { left: 79, size: 9, dur: 39, delay: -20, drift: 3, peak: 0.3 },
  { left: 88, size: 4, dur: 27, delay: -14, drift: -3, peak: 0.44 },
  { left: 94, size: 7, dur: 43, delay: -33, drift: 5, peak: 0.26 },
  { left: 3, size: 5, dur: 35, delay: -25, drift: 4, peak: 0.36 },
]

interface Props {
  artwork: string
  playing: boolean
  hasLyrics: boolean
}

export function Backdrop({ artwork, playing, hasLyrics }: Props) {
  const album = useBackdropImage(artwork)
  const webgl = hasWebGL()

  return (
    <>
      <div className={`fs-aurora${playing ? ' is-playing' : ''}`} aria-hidden="true">
        {BLOBS.map((n) => (
          <span key={n} className={`fs-blob fs-blob-${n}`} />
        ))}
      </div>

      {/* One frame of aurora-only is preferable to handing the renderer an
          image it cannot decode. */}
      {webgl && album !== null && (
        <BackgroundRender
          className="fs-bg-render"
          album={album}
          playing={playing}
          hasLyric={hasLyrics}
          fps={30}
          // Half-resolution rendering; the result is blurred beyond recognition
          // anyway, and it roughly quarters the fill cost.
          renderScale={0.5}
          aria-hidden="true"
        />
      )}

      {/* Vignette and a bottom-weighted scrim. Deliberately light: the point is
          to seat the text, not to flatten the artwork's colour into grey. */}
      <div className="fs-veil" aria-hidden="true" />

      <div className="fs-motes" aria-hidden="true">
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="fs-mote"
            style={
              {
                left: `${m.left}%`,
                width: m.size,
                height: m.size,
                '--dur': `${m.dur}s`,
                '--delay': `${m.delay}s`,
                '--drift': `${m.drift}vw`,
                '--peak': m.peak,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </>
  )
}
