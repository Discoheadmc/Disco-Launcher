import { kSurfaceTokens, SurfaceTokens } from './surfaceTokens'
import type { SurfaceColorSet } from './theme'
import { useTheme as useVuetifyTheme } from 'vuetify'
import { computed, watch } from 'vue'

/**
 * The Vuetify theme instance. Kept as a type for callers that still capture
 * it during setup (Vuetify's useTheme() throws when called outside a setup
 * context).
 */
export type VuetifyThemeInstance = ReturnType<typeof useVuetifyTheme>

/**
 * Disco: gray surface colors for the "Yüzey Renkleri" editor.
 *
 * Defaults reproduce today's look exactly: the page background comes from the
 * theme's own background color (Vuetify's `background`, #121212 in dark /
 * #FFFFFF in light), cards and input fields are Vuetify's `surface`
 * (#212121 / #FFFFFF) and borders are grey — so "reset" and an absent stored
 * block both render the pre-feature appearance.
 */
export const DEFAULT_SURFACE_COLORS = {
  dark: { background: '#121212', card: '#212121', input: '#212121', border: '#424242' },
  light: { background: '#FFFFFF', card: '#FFFFFF', input: '#FFFFFF', border: '#E0E0E0' },
} as const

/**
 * Disco: preset swatches offered in the editor, per mode. Dark grays for the
 * dark theme, light grays for the light theme — no brand colors, no accents.
 */
export const PRESET_SURFACE_COLORS = {
  dark: ['#0d0d0d', '#121212', '#181818', '#1f1f1f', '#212121', '#282828', '#303030', '#3a3a3a', '#424242', '#4f4f4f'],
  light: ['#ffffff', '#fafafa', '#f5f5f5', '#eeeeee', '#e0e0e0', '#d6d6d6', '#cccccc', '#c2c2c2', '#b8b8b8', '#adadad'],
} as const

/** Disco: how many recently used colors the editor remembers per mode. */
export const RECENT_COLORS_LIMIT = 6

const RECENTS_STORAGE_KEY = 'surface-colors-recents'

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

/** Disco: the last used colors, newest first, normalized to `#RRGGBB`. */
export function readRecentColors(): string[] {
  const store = safeLocalStorage()
  if (!store) return []
  try {
    const parsed = JSON.parse(store.getItem(RECENTS_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((v): v is string => typeof v === 'string' && parseHex(v) !== undefined)
      .slice(0, RECENT_COLORS_LIMIT)
      .map(v => toSurfaceHex(v) as string)
  } catch {
    return []
  }
}

/** Disco: record a color as the most recently used one. */
export function rememberRecentColor(hex: string): string[] {
  const normalized = toSurfaceHex(hex)
  if (!normalized) return readRecentColors()
  const next = [normalized, ...readRecentColors().filter(c => c !== normalized)].slice(0, RECENT_COLORS_LIMIT)
  const store = safeLocalStorage()
  store?.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next))
  return next
}

/** Parse #RGB / #RRGGBB / #RRGGBBAA into components; null when unparseable. */
export function parseHex(hex: string): { r: number; g: number; b: number; a: number } | undefined {
  if (typeof hex !== 'string') return undefined
  let h = hex.startsWith('#') ? hex.slice(1) : hex
  if (h.length === 3 || h.length === 4) {
    h = h.split('').map(c => c + c).join('')
  }
  if (h.length !== 6 && h.length !== 8) return undefined
  const int = Number.parseInt(h, 16)
  if (Number.isNaN(int)) return undefined
  // 8-digit hex carries the alpha in the high byte; unsigned shifts keep the
  // sign bit out of the channels.
  const r = h.length === 8 ? (int >>> 24) & 0xFF : (int >>> 16) & 0xFF
  const g = h.length === 8 ? (int >>> 16) & 0xFF : (int >>> 8) & 0xFF
  const b = h.length === 8 ? (int >>> 8) & 0xFF : int & 0xFF
  const a = h.length === 8 ? int & 0xFF : 255
  return { r, g, b, a }
}

function hexToRgbaString(hex: string, alpha: number) {
  const c = parseHex(hex)
  if (!c) return hex
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`
}

/**
 * Normalize whatever `v-color-picker` emits (hex string, rgb()/rgba() string
 * or an {r,g,b,a} object) into a plain `#RRGGBB` hex string.
 */
export function toSurfaceHex(value: any): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('#')) {
      const c = parseHex(trimmed)
      if (c) return toHexColor(c)
    }
    const m = trimmed.match(/^rgba?\(([^)]+)\)$/i)
    if (m) {
      const parts = m[1].split(',').map(p => Number.parseFloat(p))
      if (parts.length >= 3) {
        return toHexColor({ r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 255 })
      }
    }
    return undefined
  }
  if (value && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
    return toHexColor({ r: value.r, g: value.g, b: value.b, a: value.a ?? 255 })
  }
  return undefined
}

function toHexColor(c: { r: number; g: number; b: number; a: number }) {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const hex = (v: number) => clamp(v).toString(16).padStart(2, '0')
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`
}

/**
 * Push one surface color set onto the live UI: the theme's own background
 * color for the page, the surface tokens for cards/panels/inputs/borders.
 * Absent fields fall back to the defaults matching today's look.
 *
 * Nothing here persists anything — the caller decides (the app-level sync
 * applies stored theme data, the editor previews and persists on save).
 *
 * @param theme When given, the "background" row writes the theme's own
 *   background color (`colors.darkBackground` / `colors.lightBackground`),
 *   which is what actually paints `html, body` (see theme.ts). Vuetify's
 *   `surface` is deliberately NOT touched: it paints dialogs and menus, which
 *   belong to the card/panel row's domain.
 * @param backgroundWithoutOverride Value to restore when the set carries no
 *   background entry (the editor uses it to undo a preview). When omitted and
 *   the set has no background entry, the theme's current color is left alone.
 */
export function applySurfaceColors(
  set: SurfaceColorSet | undefined,
  dark: boolean,
  tokens: SurfaceTokens,
  theme?: { colors: Record<string, string> },
  backgroundWithoutOverride?: string,
) {
  const defaults = dark ? DEFAULT_SURFACE_COLORS.dark : DEFAULT_SURFACE_COLORS.light

  // Page background → the theme's own background color (drives --color-bg).
  if (theme) {
    const key = dark ? 'darkBackground' : 'lightBackground'
    theme.colors[key] = set?.background || backgroundWithoutOverride || theme.colors[key]
  }

  // Card / panel — one color drives every card tier; panels get the same
  // hue at a low alpha like the built-in frosted-panel look.
  const card = set?.card || defaults.card
  tokens.cardBg.value = card
  tokens.cardSubsectionBg.value = card
  tokens.cardRowBg.value = card
  tokens.cardClickableBg.value = card
  tokens.panelBg.value = hexToRgbaString(card, 0.06)

  // Input fields.
  tokens.inputBg.value = set?.input || defaults.input

  // Borders — one color composed into every border string. Hover variants
  // stay primary-tinted and are deliberately left alone.
  const border = set?.border || defaults.border
  tokens.border.value = `1px solid ${border}`
  tokens.cardSubsectionBorder.value = `1px solid ${border}`
  tokens.cardRowBorder.value = `1px solid ${border}`
  tokens.cardClickableBorder.value = `1px solid ${border}`
  tokens.panelBorder.value = `1px solid ${border}`
}

/**
 * App-level wiring: apply whatever the stored theme carries, and re-apply
 * when the theme loads, the theme data changes (editor save) or the
 * dark/light mode flips. Provided once from the app root.
 *
 * Takes the theme context and tokens as parameters instead of injecting
 * them: it is called from the Context component's own setup, and Vue's
 * inject() looks at the PARENT's provides — a component cannot inject what
 * it provides itself, so injection(kTheme) would throw here even though
 * provide(kTheme) runs a few lines earlier.
 */
/**
 * One-time migration for the row/target fix: the "background" row used to
 * write Vuetify's `surface` color, whose default equals the card color. A
 * stored block that simply repeats that default is therefore an accidental
 * save (or the old default), not a chosen page color — re-point it to the
 * theme's own background color so the page does not change for those users.
 * Runs once per stored block; afterwards the value no longer matches the
 * legacy signature. Explicitly chosen values that differ from the card
 * default are left alone.
 */
function migrateLegacyBackground(set: SurfaceColorSet | undefined, dark: boolean): SurfaceColorSet | undefined {
  if (!set || !set.background) return set
  if (set.background !== DEFAULT_SURFACE_COLORS[dark ? 'dark' : 'light'].card) return set
  return { ...set }
}

export function useSurfaceColorsSync(theme: ReturnType<typeof import('./theme')['useTheme']>, tokens: SurfaceTokens) {
  watch(
    [computed(() => theme.currentTheme.value?.surfaceColors), theme.isDark],
    () => {
      const dark = theme.isDark.value
      const mode = dark ? 'dark' : 'light'
      const current = theme.currentTheme.value
      let set = current?.surfaceColors?.[mode]
      const legacy = migrateLegacyBackground(set, dark)
      if (current && legacy && set?.background) {
        const themeBackground = current.colors[dark ? 'darkBackground' : 'lightBackground']
        if (themeBackground && themeBackground !== legacy.background) {
          legacy.background = themeBackground
          if (!current.surfaceColors) current.surfaceColors = {}
          current.surfaceColors[mode] = legacy
          set = legacy
          // Persist the corrected block; saveCurrentTheme writes theme.json.
          try {
            theme.saveCurrentTheme()
          } catch {
            // Non-fatal: the in-memory value is already correct.
          }
        }
      }
      // The theme object is passed so a stored background override is applied
      // to the theme's own background color at boot; when the set carries no
      // background entry the theme's current color is left untouched.
      applySurfaceColors(set, dark, tokens, current ?? undefined)
    },
    { immediate: true, deep: true },
  )
}

// ── Contrast ──────────────────────────────────────────────────────────

/** WCAG relative luminance of a hex color. */
function relativeLuminance(hex: string): number | undefined {
  const c = parseHex(hex)
  if (!c) return undefined
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
}

/**
 * WCAG contrast ratio between a surface color and the theme's body text
 * (near-white in dark mode, near-black in light mode). Undefined when the
 * color cannot be parsed.
 */
export function surfaceContrastRatio(hex: string, dark: boolean): number | undefined {
  const l1 = relativeLuminance(hex)
  const l2 = relativeLuminance(dark ? '#FFFFFF' : '#212121')
  if (l1 === undefined || l2 === undefined) return undefined
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  return Math.round(ratio * 100) / 100
}
