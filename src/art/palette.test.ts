import { describe, expect, it } from 'vitest'
import { hsl, hueDistance, quantize, rgbToHsl, seedPalette, toPalette } from './palette'

/** Build RGBA pixel data from a list of [r,g,b] repeated `times` each. */
function pixels(...runs: [[number, number, number], number][]): Uint8ClampedArray {
  const total = runs.reduce((n, [, times]) => n + times, 0)
  const data = new Uint8ClampedArray(total * 4)
  let i = 0
  for (const [[r, g, b], times] of runs) {
    for (let n = 0; n < times; n++) {
      data[i++] = r
      data[i++] = g
      data[i++] = b
      data[i++] = 255
    }
  }
  return data
}

describe('rgbToHsl', () => {
  it('reads the primaries off the hue wheel', () => {
    expect(rgbToHsl(255, 0, 0).h).toBeCloseTo(0)
    expect(rgbToHsl(0, 255, 0).h).toBeCloseTo(120)
    expect(rgbToHsl(0, 0, 255).h).toBeCloseTo(240)
  })

  it('reports greys as unsaturated', () => {
    expect(rgbToHsl(128, 128, 128).s).toBe(0)
    expect(rgbToHsl(0, 0, 0).s).toBe(0)
    expect(rgbToHsl(255, 255, 255).s).toBe(0)
  })

  it('keeps lightness in 0..1', () => {
    expect(rgbToHsl(0, 0, 0).l).toBe(0)
    expect(rgbToHsl(255, 255, 255).l).toBe(1)
    expect(rgbToHsl(255, 0, 0).l).toBeCloseTo(0.5)
  })
})

describe('hueDistance', () => {
  it('measures the short way round the wheel', () => {
    expect(hueDistance(10, 350)).toBe(20)
    expect(hueDistance(350, 10)).toBe(20)
    expect(hueDistance(0, 180)).toBe(180)
    expect(hueDistance(90, 90)).toBe(0)
  })
})

describe('quantize', () => {
  it('finds the dominant hue of a solid image', () => {
    const out = quantize(pixels([[30, 90, 220], 100]))
    expect(out).toHaveLength(1)
    expect(out[0]!.h).toBeCloseTo(rgbToHsl(30, 90, 220).h, 0)
    expect(out[0]!.weight).toBe(1)
  })

  it('separates distinct hues and orders them by prominence', () => {
    // Two thirds blue, one third orange — both vivid, so population decides.
    const out = quantize(pixels([[30, 90, 220], 200], [[230, 130, 30], 100]))
    expect(out.length).toBeGreaterThanOrEqual(2)
    expect(out[0]!.h).toBeGreaterThan(180) // blue leads
    expect(out[1]!.h).toBeLessThan(60) // orange follows
  })

  it('ignores near-black, near-white and grey pixels', () => {
    const out = quantize(
      pixels(
        [[4, 5, 7], 500], // shadow
        [[252, 253, 255], 500], // highlight
        [[130, 130, 130], 500], // grey
        [[30, 90, 220], 50], // the only real colour
      ),
    )
    expect(out).toHaveLength(1)
    expect(out[0]!.h).toBeCloseTo(rgbToHsl(30, 90, 220).h, 0)
    // Weight is a share of the *colourful* pixels, not of every pixel.
    expect(out[0]!.weight).toBe(1)
  })

  it('lets a vivid area outrank a slightly larger washed-out one', () => {
    // A pale-blue sky with a 1.3x population edge over saturated crimson. The
    // saturation term is worth about 1.6x here, so the crimson still leads —
    // but the boost is deliberately bounded, and a sky several times larger
    // would and should win on population alone.
    const out = quantize(pixels([[168, 190, 214], 130], [[214, 22, 60], 100]))
    expect(out.length).toBeGreaterThanOrEqual(2)
    expect(hueDistance(out[0]!.h, rgbToHsl(214, 22, 60).h)).toBeLessThan(24)
  })

  it('still lets population win when the area difference is decisive', () => {
    const out = quantize(pixels([[168, 190, 214], 400], [[214, 22, 60], 100]))
    expect(hueDistance(out[0]!.h, rgbToHsl(168, 190, 214).h)).toBeLessThan(24)
  })

  it('merges hues that sit within one cluster', () => {
    // Three barely-different blues should collapse to a single swatch.
    const out = quantize(pixels([[30, 90, 220], 100], [[34, 96, 224], 100], [[26, 84, 216], 100]))
    expect(out).toHaveLength(1)
  })

  it('averages hues correctly across the red seam', () => {
    // 355ish and 5ish must average to red, not to cyan.
    const out = quantize(pixels([[220, 30, 50], 100], [[220, 50, 30], 100]))
    expect(out).toHaveLength(1)
    expect(hueDistance(out[0]!.h, 0)).toBeLessThan(20)
  })

  it('returns nothing for an image with no usable colour', () => {
    expect(quantize(pixels([[0, 0, 0], 100]))).toEqual([])
    expect(quantize(pixels([[255, 255, 255], 100]))).toEqual([])
    expect(quantize(pixels([[120, 120, 120], 100]))).toEqual([])
    expect(quantize(new Uint8ClampedArray(0))).toEqual([])
  })

  it('skips transparent pixels', () => {
    const data = new Uint8ClampedArray(8)
    // One opaque blue pixel, one transparent orange one.
    data.set([30, 90, 220, 255], 0)
    data.set([230, 130, 30, 0], 4)
    const out = quantize(data)
    expect(out).toHaveLength(1)
    expect(out[0]!.h).toBeGreaterThan(180)
  })
})

describe('toPalette', () => {
  it('falls back to the seed palette when nothing was sampled', () => {
    expect(toPalette([], 'chiling')).toEqual(seedPalette('chiling'))
  })

  it('lifts a dim sample into a usable range', () => {
    // A dark navy: colourful enough to sample, far too dark to wash a backdrop.
    const dim = quantize(pixels([[40, 52, 86], 100]))
    expect(dim[0]!.l).toBeLessThan(0.3)
    const lightness = Number(/(\d+)%\)$/.exec(toPalette(dim, 'chiling').dominant)![1])
    expect(lightness).toBeGreaterThanOrEqual(40)
    expect(lightness).toBeLessThanOrEqual(60)
  })

  it('drops pixels too desaturated to read as a colour', () => {
    // s = 0.14, under the 0.16 cut — a near-grey must not seed the palette.
    expect(quantize(pixels([[96, 104, 128], 100]))).toEqual([])
  })

  it('keeps the light accent dark and the dark accent light', () => {
    const palette = toPalette(quantize(pixels([[30, 90, 220], 100])), 'chiling')
    const lightnessOf = (c: string) => Number(/(\d+)%\)$/.exec(c)![1])
    expect(lightnessOf(palette.onLight)).toBeLessThan(lightnessOf(palette.onDark))
    expect(lightnessOf(palette.onLight)).toBeLessThanOrEqual(46)
    expect(lightnessOf(palette.onDark)).toBeGreaterThanOrEqual(60)
  })

  it('always fills a full set of backdrop colours, even from one swatch', () => {
    const single = toPalette(quantize(pixels([[30, 90, 220], 100])), 'x')
    expect(single.swatches).toHaveLength(5)
    // Derived colours must stay in the leading hue family, not invent new ones.
    const hues = single.swatches.map((c) => Number(/^hsl\((\d+)/.exec(c)![1]))
    for (const h of hues) expect(hueDistance(h, hues[0]!)).toBeLessThanOrEqual(40)
    // ...and must not all be the same flat colour.
    expect(new Set(single.swatches).size).toBeGreaterThan(1)

    expect(toPalette([], 'x').swatches).toHaveLength(5)
  })

  it('keeps every genuinely distinct swatch it was given', () => {
    const two = quantize(pixels([[30, 90, 220], 200], [[230, 130, 30], 150]))
    expect(two.length).toBeGreaterThanOrEqual(2)
    const palette = toPalette(two, 'x')
    const hues = palette.swatches.map((c) => Number(/^hsl\((\d+)/.exec(c)![1]))
    expect(hueDistance(hues[0]!, two[0]!.h)).toBeLessThan(2)
    expect(hueDistance(hues[1]!, two[1]!.h)).toBeLessThan(2)
  })
})

describe('quantize noise floor', () => {
  it('drops trace hues that are not really in the artwork', () => {
    // 96% blue with single-pixel specks of green and magenta, as a JPEG-ringed
    // illustration produces. Only the blue is a real colour.
    const out = quantize(pixels([[30, 90, 220], 500], [[40, 220, 60], 3], [[220, 40, 200], 3]))
    expect(out).toHaveLength(1)
  })

  it('keeps a secondary colour that holds a real share', () => {
    const out = quantize(pixels([[30, 90, 220], 500], [[40, 220, 60], 60]))
    expect(out).toHaveLength(2)
  })
})

describe('hsl', () => {
  it('wraps hues onto the wheel and clamps the rest', () => {
    expect(hsl(370, 0.5, 0.5)).toBe('hsl(10 50% 50%)')
    expect(hsl(-10, 0.5, 0.5)).toBe('hsl(350 50% 50%)')
    expect(hsl(180, 2, -1)).toBe('hsl(180 100% 0%)')
  })
})
