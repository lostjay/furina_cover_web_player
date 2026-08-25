/**
 * Album-artwork colour extraction.
 *
 * The full-screen player is painted from the cover's own colours rather than a
 * fixed theme, so a blue Fontaine cover washes the screen in blue and a warm
 * one goes warm. Everything here is deliberately cheap: the cover is drawn once
 * into a small offscreen canvas and the pixels are bucketed by hue, which is
 * enough to pull the colours that characterise an illustration out of it.
 *
 * `quantize` and the colour helpers are pure so they can be unit-tested without
 * a DOM; only `extractPalette` touches canvas.
 */

import { coverPalette } from './generateCover'

export interface Palette {
  /** Most prominent first. CSS colour strings, always at least one entry. */
  swatches: string[]
  /** The single most representative colour — the backdrop's centre of gravity. */
  dominant: string
  /** Accent that stays legible on a light surface. */
  onLight: string
  /** Accent that stays legible on a dark surface. */
  onDark: string
}

export interface Swatch {
  /** Degrees, 0..360. */
  h: number
  /** 0..1. */
  s: number
  /** 0..1. */
  l: number
  /** Share of the sampled pixels this swatch stands for, 0..1. */
  weight: number
}

/** Edge length of the square the cover is downsampled to before sampling. */
const SAMPLE_SIZE = 96

/** 15-degree slices. Fine enough to separate teal from blue, coarse enough to group. */
const HUE_BUCKETS = 24

/** How many swatches a palette carries. */
const SWATCH_COUNT = 5

/**
 * Smallest share of the coloured pixels a secondary swatch may hold.
 *
 * An illustration scatters a few dozen stray pixels across most of the wheel —
 * a lens flare, an eye highlight, JPEG ringing. Left in, those score as real
 * swatches and paint the backdrop with colours that are nowhere in the cover.
 * The leading swatch is always kept regardless.
 */
const MIN_SHARE = 0.02

// --- colour maths ------------------------------------------------------

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min

  if (d === 0) return { h: 0, s: 0, l }

  // Saturation is measured against distance from mid-grey, so a very dark or
  // very light pixel can still register as strongly coloured.
  const s = d / (1 - Math.abs(2 * l - 1))

  let h: number
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4

  h *= 60
  if (h < 0) h += 360
  return { h, s, l }
}

export function hsl(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360
  const sat = Math.round(clamp01(s) * 100)
  const lum = Math.round(clamp01(l) * 100)
  return `hsl(${Math.round(hue)} ${sat}% ${lum}%)`
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/**
 * Mean of a set of angles.
 *
 * Averaging hues arithmetically is wrong across the 360/0 seam — 350° and 10°
 * average to 180° (cyan) rather than 0° (red). Summing unit vectors and taking
 * the resulting angle gives the right answer everywhere.
 */
function meanHue(sinSum: number, cosSum: number): number {
  const deg = (Math.atan2(sinSum, cosSum) * 180) / Math.PI
  return deg < 0 ? deg + 360 : deg
}

// --- quantisation ------------------------------------------------------

/**
 * Reduce RGBA pixel data to a handful of representative swatches, most
 * prominent first.
 *
 * Pixels that carry no usable colour are dropped before bucketing: fully
 * transparent ones, near-black and near-white ones (an illustration's sky and
 * shadows would otherwise outvote everything), and greys. What survives is
 * grouped by hue, and each group scores on population weighted by how saturated
 * it is, so a small area of vivid colour can beat a large muted one.
 */
export function quantize(data: Uint8ClampedArray): Swatch[] {
  const count = new Float64Array(HUE_BUCKETS)
  const sinSum = new Float64Array(HUE_BUCKETS)
  const cosSum = new Float64Array(HUE_BUCKETS)
  const satSum = new Float64Array(HUE_BUCKETS)
  const lumSum = new Float64Array(HUE_BUCKETS)

  let considered = 0
  let colourful = 0

  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3]!
    if (alpha < 128) continue
    considered++

    const { h, s, l } = rgbToHsl(data[i]!, data[i + 1]!, data[i + 2]!)
    if (l < 0.12 || l > 0.93 || s < 0.16) continue
    colourful++

    const bucket = Math.min(HUE_BUCKETS - 1, Math.floor((h / 360) * HUE_BUCKETS))
    const rad = (h * Math.PI) / 180
    count[bucket]! += 1
    sinSum[bucket]! += Math.sin(rad)
    cosSum[bucket]! += Math.cos(rad)
    satSum[bucket]! += s
    lumSum[bucket]! += l
  }

  if (considered === 0 || colourful === 0) return []

  const swatches: (Swatch & { score: number })[] = []
  for (let b = 0; b < HUE_BUCKETS; b++) {
    const n = count[b]!
    if (n === 0) continue
    const s = satSum[b]! / n
    swatches.push({
      h: meanHue(sinSum[b]!, cosSum[b]!),
      s,
      l: lumSum[b]! / n,
      weight: n / colourful,
      // The saturation term is what stops a huge expanse of washed-out sky from
      // burying the small, vivid areas that actually characterise a cover.
      score: (n / colourful) * (0.35 + s),
    })
  }

  swatches.sort((a, b) => b.score - a.score)

  // Neighbouring buckets often describe the same colour. Keep the strongest of
  // each cluster so the palette reads as distinct hues rather than a gradient.
  const picked: Swatch[] = []
  for (const s of swatches) {
    if (picked.some((p) => hueDistance(p.h, s.h) < 24)) continue
    if (picked.length > 0 && s.weight < MIN_SHARE) continue
    picked.push({ h: s.h, s: s.s, l: s.l, weight: s.weight })
    if (picked.length === SWATCH_COUNT) break
  }
  return picked
}

/** Shortest angular distance between two hues, in degrees (0..180). */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Turn raw swatches into the palette the UI consumes.
 *
 * Sampled colours come out muddier than the cover looks. A bucket's saturation
 * is the mean over a whole hue family — the Fontaine cover's blues average to
 * about 0.37 even though the dress and gemstones that give it its character are
 * far more vivid — so a faithful reading produces a backdrop that sulks.
 * Saturation is therefore lifted and lightness pushed into a mid band; the
 * accents are then clamped separately for light and dark surfaces, where
 * legibility beats fidelity.
 */
export function toPalette(swatches: Swatch[], seed: string): Palette {
  if (swatches.length === 0) return seedPalette(seed)

  const lead = swatches[0]!
  return {
    swatches: harmonize(swatches),
    dominant: hsl(lead.h, Math.min(0.9, lead.s * 1.1 + 0.24), clampRange(lead.l, 0.4, 0.6)),
    // Dark enough to read as text/tint on white, light enough to read on near-black.
    onLight: hsl(lead.h, Math.min(0.85, lead.s * 1.05 + 0.26), clampRange(lead.l, 0.32, 0.46)),
    onDark: hsl(lead.h, Math.min(0.88, lead.s * 1.05 + 0.26), clampRange(lead.l, 0.6, 0.74)),
  }
}

/**
 * Expand however many swatches survived into exactly SWATCH_COUNT colours.
 *
 * Most covers are dominated by a single hue family — the Fontaine artwork is
 * about 90% one blue — so honest sampling usually yields one or two swatches,
 * and a backdrop built from one flat colour is the black-and-white slab this
 * whole module exists to avoid. The shortfall is filled by rotating the leading
 * hue a little either way and stepping the lightness, which reads as depth in
 * the same colour family rather than as invented colours.
 */
function harmonize(swatches: Swatch[]): string[] {
  const out: string[] = []
  const lead = swatches[0]!
  // Alternating rotations, widening as they go: 0, +22, -22, +40, -40.
  const rotations = [0, 22, -22, 40, -40]

  for (let i = 0; i < SWATCH_COUNT; i++) {
    const real = swatches[i]
    if (real) {
      out.push(hsl(real.h, Math.min(0.92, real.s * 1.15 + 0.28), clampRange(real.l, 0.42, 0.68)))
      continue
    }
    const step = i - swatches.length + 1
    const rotation = rotations[Math.min(rotations.length - 1, step)]!
    // Alternate lighter and darker so consecutive derived blobs stay distinct.
    const lift = step % 2 === 0 ? 0.1 : -0.08
    out.push(
      hsl(
        lead.h + rotation,
        Math.min(0.92, lead.s * 1.15 + 0.28),
        clampRange(lead.l + lift, 0.36, 0.72),
      ),
    )
  }
  return out
}

const clampRange = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n)

/**
 * The palette used when the cover cannot be sampled — a missing artwork URL, a
 * decode failure, or a canvas the browser refuses to read back. Derived from
 * the same deterministic seed as the generated placeholder cover, so the two
 * always agree.
 */
export function seedPalette(seed: string): Palette {
  const { from, to, dominant } = coverPalette(seed)
  return {
    swatches: [from, dominant, to, from, dominant],
    dominant,
    onLight: to,
    onDark: from,
  }
}

// --- extraction --------------------------------------------------------

const cache = new Map<string, Promise<Palette>>()

/**
 * Sample an image URL down to a palette, memoised per URL.
 *
 * `crossOrigin = "anonymous"` is required: without it a remote cover loads and
 * displays fine but taints the canvas, and `getImageData` throws. The media
 * host serves `Access-Control-Allow-Origin` on both the resolution endpoint and
 * the object-storage URL it hands back, so the request succeeds. Anything that
 * does fail — offline, a host without the header, a decode error — falls back
 * to the seed palette rather than leaving the UI colourless.
 */
export function extractPalette(url: string, seed: string): Promise<Palette> {
  const cached = cache.get(url)
  if (cached) return cached

  const promise = new Promise<Palette>((resolve) => {
    if (typeof document === 'undefined') return resolve(seedPalette(seed))

    const img = new Image()
    // A data: URI is already same-origin; setting crossOrigin on one is
    // harmless, but skipping it avoids a needless mode switch.
    if (!url.startsWith('data:')) img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = SAMPLE_SIZE
        canvas.height = SAMPLE_SIZE
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(seedPalette(seed))
        // Nearest-neighbour, deliberately. Smoothed downscaling averages
        // neighbouring pixels, and averaging colours pulls them toward grey —
        // sampling this cover with smoothing on reported 33% saturation for a
        // blue that is really about 60%, which is what makes an extracted
        // palette look washed out. Point-sampling returns colours that are
        // actually present in the image.
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
        resolve(toPalette(quantize(data), seed))
      } catch (err) {
        console.warn(`[palette] could not sample ${url}; using the seed palette`, err)
        resolve(seedPalette(seed))
      }
    }
    img.onerror = () => resolve(seedPalette(seed))
    img.src = url
  })

  cache.set(url, promise)
  return promise
}

// Dev-only handle so the e2e suite can drive extraction against a known image
// and check that canvas sampling really works in a browser — the unit tests can
// only cover the pure maths. The `window` guard matters: this module is
// imported under Node by those tests.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__extractPalette = extractPalette
}
