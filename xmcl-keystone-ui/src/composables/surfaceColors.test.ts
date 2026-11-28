import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SURFACE_COLORS,
  PRESET_SURFACE_COLORS,
  RECENT_COLORS_LIMIT,
  applySurfaceColors,
  parseHex,
  readRecentColors,
  rememberRecentColor,
  surfaceContrastRatio,
  toSurfaceHex,
} from './surfaceColors'
import { useSurfaceTokens } from './surfaceTokens'

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
  it('mirrors the pre-feature look', () => {
    // The page background is Vuetify/theme `background` (darker than cards).
    expect(DEFAULT_SURFACE_COLORS.dark.background).toBe('#121212')
    expect(DEFAULT_SURFACE_COLORS.dark.card).toBe('#212121')
    expect(DEFAULT_SURFACE_COLORS.light.background).toBe('#FFFFFF')
    // A dark border must stay visible against the dark surface.
    expect(surfaceContrastRatio(DEFAULT_SURFACE_COLORS.dark.border, true)).toBeGreaterThan(1.5)
  })
})

describe('PRESET_SURFACE_COLORS', () => {
  it('offers only valid, mode-fitting grays', () => {
    for (const mode of ['dark', 'light'] as const) {
      const colors = PRESET_SURFACE_COLORS[mode]
      expect(colors.length).toBeGreaterThanOrEqual(8)
      for (const color of colors) {
        expect(toSurfaceHex(color)).toBe(color)
      }
    }
  })
})

describe('recent colors', () => {
  // The unit environment is node (no DOM): give the composable a minimal
  // in-memory Storage for this block only.
  const store = new Map<string, string>()
  beforeAll(() => {
    ;(globalThis as any).localStorage = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage
  })
  beforeEach(() => store.clear())

  it('remembers the newest color first, deduped', () => {
    rememberRecentColor('#111111')
    rememberRecentColor('#222222')
    rememberRecentColor('#111111')
    expect(readRecentColors()).toEqual(['#111111', '#222222'])
  })

  it('caps the list at the limit', () => {
    for (let i = 0; i < RECENT_COLORS_LIMIT + 4; i++) {
      rememberRecentColor(`#${(i + 10).toString(16).padStart(6, '0')}`)
    }
    const recents = readRecentColors()
    expect(recents.length).toBe(RECENT_COLORS_LIMIT)
    // Newest is the last one written.
    expect(recents[0]).toBe(`#${(RECENT_COLORS_LIMIT + 13).toString(16).padStart(6, '0')}`)
  })

  it('ignores junk and keeps the existing list', () => {
    rememberRecentColor('#123456')
    rememberRecentColor('not-a-color')
    expect(readRecentColors()).toEqual(['#123456'])
  })

  it('survives corrupted storage', () => {
    store.set('surface-colors-recents', '{not json')
    expect(readRecentColors()).toEqual([])
  })
})

describe('applySurfaceColors', () => {
  function tokens() { return useSurfaceTokens() }

  it('writes the page background to the theme colors, not Vuetify surface', () => {
    const t = tokens()
    const theme = { colors: { darkBackground: '#121212A5', lightBackground: '#FFFFFF' } }
    applySurfaceColors({ background: '#0d0d0d', card: '#212121', input: '#212121', border: '#424242' }, true, t, theme)
    expect(theme.colors.darkBackground).toBe('#0d0d0d')
    expect(theme.colors.lightBackground).toBe('#FFFFFF')
  })

  it('restores the pre-override background when the set has none', () => {
    const t = tokens()
    const theme = { colors: { darkBackground: '#123456', lightBackground: '#FFFFFF' } }
    applySurfaceColors({ card: '#212121' }, true, t, theme, '#121212')
    expect(theme.colors.darkBackground).toBe('#121212')
  })

  it('leaves the theme background untouched without an override or fallback', () => {
    const t = tokens()
    const theme = { colors: { darkBackground: '#123456', lightBackground: '#FFFFFF' } }
    applySurfaceColors(undefined, true, t, theme)
    expect(theme.colors.darkBackground).toBe('#123456')
  })

  it('pushes card/input/border onto the surface tokens', () => {
    const t = tokens()
    applySurfaceColors({ card: '#010203', input: '#040506', border: '#070809' }, true, t)
    expect(t.cardBg.value).toBe('#010203')
    expect(t.cardSubsectionBg.value).toBe('#010203')
    expect(t.cardRowBg.value).toBe('#010203')
    expect(t.inputBg.value).toBe('#040506')
    expect(t.border.value).toBe('1px solid #070809')
  })

  it('falls back to the mode defaults for missing fields', () => {
    const t = tokens()
    applySurfaceColors(undefined, true, t)
    expect(t.cardBg.value).toBe(DEFAULT_SURFACE_COLORS.dark.card)
    expect(t.inputBg.value).toBe(DEFAULT_SURFACE_COLORS.dark.input)
    expect(t.border.value).toBe(`1px solid ${DEFAULT_SURFACE_COLORS.dark.border}`)
  })
})
