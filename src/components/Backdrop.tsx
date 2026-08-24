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
 * Resolve the image handed to BackgroundRender, rasterised if it is an SVG.
 *
 * AMLL loads the album art with `fetch(url).blob()` and
 * `img.crossOrigin = "anonymous"`, so it needs the URL to be readable
 * cross-origin. By the time `artwork` reaches this component it has already
 * been resolved to a direct, CORS-correct CDN URL (see
 * `src/media/resolveMediaUrl.ts`) or is a same-origin generated cover, so no
 * separate readability probe is needed here.
 */
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

interface Props {
  artwork: string
  playing: boolean
  hasLyrics: boolean
}

export function Backdrop({ artwork, playing, hasLyrics }: Props) {
  const album = useBackdropImage(artwork)

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
