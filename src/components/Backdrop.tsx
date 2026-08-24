import { useEffect, useState } from 'react'
import { BackgroundRender } from '@applemusic-like-lyrics/react'

/**
 * The full-screen artwork backdrop.
 *
 * AMLL's BackgroundRender draws the Apple Music-style fluid wash, but it needs
 * WebGL. Rather than let a missing context take the whole full-screen view
 * down, probe once and fall back to the original CSS blur, which still looks
 * respectable on machines without hardware acceleration.
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

/**
 * Can the background renderer actually read this image?
 *
 * AMLL loads the album art with `fetch(url).blob()` and an
 * `img.crossOrigin = "anonymous"`, so a cross-origin host must send a valid
 * `Access-Control-Allow-Origin`. When it does not, AMLL retries five times and
 * then renders nothing at all — indistinguishable from a broken player. Probing
 * with the same constraint lets us substitute something readable instead.
 *
 * Same-origin and data: URLs skip the probe entirely.
 */
const readableCache = new Map<string, boolean>()

function isReadableForWebGL(url: string): Promise<boolean> {
  if (url.startsWith('data:') || url.startsWith('blob:')) return Promise.resolve(true)
  try {
    if (new URL(url, window.location.href).origin === window.location.origin) {
      return Promise.resolve(true)
    }
  } catch {
    return Promise.resolve(false)
  }

  const cached = readableCache.get(url)
  if (cached !== undefined) return Promise.resolve(cached)

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const settle = (value: boolean) => {
      readableCache.set(url, value)
      resolve(value)
    }
    img.onload = () => settle(true)
    img.onerror = () => {
      console.warn(
        `[backdrop] ${url} is not readable cross-origin (needs Access-Control-Allow-Origin); ` +
          'falling back to the generated cover for the background.',
      )
      settle(false)
    }
    img.src = url
  })
}

/**
 * Resolve the image handed to BackgroundRender: the real artwork when it is
 * readable, otherwise the generated cover, rasterised either way.
 */
function useBackdropImage(artwork: string, fallback: string): string | null {
  const [resolved, setResolved] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void isReadableForWebGL(artwork)
      .then((readable) => rasterizeSvg(readable ? artwork : fallback))
      .then((url) => {
        if (live) setResolved(url)
      })
    return () => {
      live = false
    }
  }, [artwork, fallback])

  return resolved
}

interface Props {
  artwork: string
  /** Generated cover, used when `artwork` cannot be read cross-origin. */
  fallbackArtwork: string
  playing: boolean
  hasLyrics: boolean
}

export function Backdrop({ artwork, fallbackArtwork, playing, hasLyrics }: Props) {
  const album = useBackdropImage(artwork, fallbackArtwork)

  if (!hasWebGL()) {
    return (
      <div className="fs-backdrop" aria-hidden="true">
        <img src={artwork} alt="" />
      </div>
    )
  }

  // Nothing to draw until rasterisation settles; one frame of empty backdrop is
  // preferable to handing the renderer an image it cannot decode.
  if (album === null) return null

  return (
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
  )
}
