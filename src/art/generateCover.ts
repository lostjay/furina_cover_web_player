/**
 * Deterministic placeholder cover art.
 *
 * The manifest's `artworkUrl` is optional, so a track may have no artwork at
 * all; this fills the gap and keeps copyrighted images out of the repository.
 * It also backs `seedPalette` in ./palette.ts, which needs a usable set of
 * colours even when there is no cover to sample.
 *
 * The same track id always produces the same cover, so the library does not
 * reshuffle its colours between reloads.
 */

/** FNV-1a — small, stable, and good enough to spread ids across the hue wheel. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface CoverPalette {
  from: string
  to: string
  /** Representative colour for the full-screen backdrop wash. */
  dominant: string
}

/**
 * Fontaine-leaning palette: hues are constrained to the cyan → periwinkle arc
 * rather than the full wheel, so every generated cover still reads as one set.
 */
export function coverPalette(seed: string): CoverPalette {
  const h = hash(seed)
  const baseHue = 185 + (h % 65) // 185 (cyan) .. 250 (periwinkle)
  const spread = 18 + ((h >>> 8) % 26)
  const sat = 58 + ((h >>> 16) % 22)
  return {
    from: `hsl(${baseHue} ${sat}% 62%)`,
    to: `hsl(${(baseHue + spread) % 360} ${sat - 8}% 44%)`,
    dominant: `hsl(${baseHue + spread / 2} ${sat}% 52%)`,
  }
}

/**
 * An inline SVG data URI — no network, no CORS, usable as an <img> src and as
 * mediaSession artwork.
 */
export function generateCoverDataUri(seed: string, label: string): string {
  const { from, to } = coverPalette(seed)
  const h = hash(seed)
  const cx = 20 + (h % 60)
  const cy = 20 + ((h >>> 7) % 60)
  const glyph = escapeXml([...label][0] ?? '♪')

  // The explicit width/height matter: an SVG with only a viewBox has no
  // intrinsic size, and decodes to 0x0 when uploaded as a WebGL texture — which
  // is exactly what AMLL's BackgroundRender does with it.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
</linearGradient>
<radialGradient id="s" cx="${cx}%" cy="${cy}%" r="70%">
<stop offset="0" stop-color="#fff" stop-opacity=".45"/>
<stop offset="1" stop-color="#fff" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="100" height="100" fill="url(#g)"/>
<rect width="100" height="100" fill="url(#s)"/>
<path d="M-10 ${62 + (h % 12)} Q 25 ${48 + (h % 16)} 50 ${62 + (h % 10)} T 110 ${58 + (h % 14)} V110 H-10Z"
      fill="#fff" opacity=".14"/>
<path d="M-10 ${74 + (h % 10)} Q 30 ${60 + (h % 14)} 55 ${74 + (h % 8)} T 110 ${70 + (h % 12)} V110 H-10Z"
      fill="#fff" opacity=".10"/>
<text x="50" y="50" text-anchor="middle" dominant-baseline="central"
      font-family="system-ui, sans-serif" font-size="34" font-weight="600"
      fill="#fff" fill-opacity=".82">${glyph}</text>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\n\s*/g, ' '))}`
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&apos;',
  )
}
