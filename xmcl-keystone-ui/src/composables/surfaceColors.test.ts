import { describe, expect, it } from 'vitest'
import { DEFAULT_SURFACE_COLORS, parseHex, surfaceContrastRatio, toSurfaceHex } from './surfaceColors'

describe('parseHex', () => {
  it('parses 6-digit hex', () => {
    expect(parseHex('#212121')).toEqual({ r: 33, g: 33, b: 33, a: 255 })
  })

  it('parses 8-digit hex keeping the alpha', () => {
    expect(parseHex('#121212A5')).toEqual({ r: 18, g: 18, b: 18, a: 165 })
  })

  it('expands 3-digit shorthand', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 255 })
  })

  it('returns undefined for junk', () => {
    expect(parseHex('red')).toBeUndefined()
    expect(parseHex('')).toBeUndefined()
    expect(parseHex('#12')).toBeUndefined()
  })
})

describe('toSurfaceHex', () => {
  it('normalizes 6-digit hex', () => {
    expect(toSurfaceHex('#F44336')).toBe('#f44336')
  })

  it('drops the alpha from 8-digit hex', () => {
    expect(toSurfaceHex('#121212A5')).toBe('#121212')
  })

  it('converts rgb() strings', () => {
    expect(toSurfaceHex('rgb(244, 67, 54)')).toBe('#f44336')
  })

  it('converts rgba() strings ignoring the alpha', () => {
    expect(toSurfaceHex('rgba(18, 18, 18, 0.65)')).toBe('#121212')
  })

  it('converts color objects', () => {
    expect(toSurfaceHex({ r: 244, g: 67, b: 54, a: 1 })).toBe('#f44336')
  })

  it('returns undefined for unparseable values', () => {
    expect(toSurfaceHex('not-a-color')).toBeUndefined()
    expect(toSurfaceHex(null)).toBeUndefined()
  })
})

describe('surfaceContrastRatio', () => {
  it('gives a high ratio for white text on dark surfaces', () => {
    expect(surfaceContrastRatio('#212121', true)).toBeGreaterThan(10)
  })

  it('flags near-white backgrounds in dark mode as low contrast', () => {
    expect(surfaceContrastRatio('#F5F5F5', true)).toBeLessThan(3)
  })

  it('flags near-black backgrounds in light mode as low contrast', () => {
    expect(surfaceContrastRatio('#111111', false)).toBeLessThan(3)
  })

  it('returns undefined for unparseable colors', () => {
    expect(surfaceContrastRatio('junk', true)).toBeUndefined()
  })
})

describe('DEFAULT_SURFACE_COLORS', () => {
  it('mirrors the pre-feature look (Vuetify palette)', () => {
    expect(DEFAULT_SURFACE_COLORS.dark.background).toBe('#212121')
    expect(DEFAULT_SURFACE_COLORS.light.background).toBe('#FFFFFF')
    // A dark border must stay visible against the dark surface.
    expect(surfaceContrastRatio(DEFAULT_SURFACE_COLORS.dark.border, true)).toBeGreaterThan(1.5)
  })
})
