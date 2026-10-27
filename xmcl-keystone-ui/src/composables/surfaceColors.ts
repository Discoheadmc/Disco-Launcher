import { kSurfaceTokens, SurfaceTokens } from './surfaceTokens'
import type { SurfaceColorSet } from './theme'
import { useTheme as useVuetifyTheme } from 'vuetify'
import { computed, watch } from 'vue'

/**
 * The Vuetify theme instance. Must be captured during component setup —
 * Vuetify's useTheme() injects through the current instance and throws
 * "Cannot find Symbol(theme) to inject" when called from a watcher callback
 * that runs outside the setup context. Callers therefore capture it once
 * and pass it into {@link applySurfaceColors}.
 */
export type VuetifyThemeInstance = ReturnType<typeof useVuetifyTheme>

/**
 * Disco: gray surface colors for the "Yüzey Renkleri" editor.
 *
 * Defaults reproduce today's look exactly: Vuetify's own palette (dark
 * #212121, light #FFFFFF surfaces, grey borders) — so "reset" and an absent
 * stored block both render the pre-feature appearance.
 */
export const DEFAULT_SURFACE_COLORS = {
  dark: { background: '#212121', card: '#212121', input: '#212121', border: '#424242' },
  light: { background: '#FFFFFF', card: '#FFFFFF', input: '#FFFFFF', border: '#E0E0E0' },
} as const

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
 * Push one surface color set onto the live UI: Vuetify's surface color for
 * the background, the surface tokens for cards/panels/inputs/borders. Absent
 * fields fall back to the defaults matching today's look.
 *
 * Nothing here persists anything — the caller decides (the app-level sync
 * applies stored theme data, the editor previews and persists on save).
 */
export function applySurfaceColors(set: SurfaceColorSet | undefined, dark: boolean, tokens: SurfaceTokens, framework: VuetifyThemeInstance) {
  const defaults = dark ? DEFAULT_SURFACE_COLORS.dark : DEFAULT_SURFACE_COLORS.light

  // Background → Vuetify runtime surface color. Runtime-only: persistence
  // goes through theme.surfaceColors, never through Vuetify's theme object.
  const themeName = framework.global.name.value
  const themeColors = framework.themes.value[themeName]?.colors as Record<string, string> | undefined
  if (themeColors) {
    themeColors.surface = set?.background || defaults.background
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
export function useSurfaceColorsSync(theme: ReturnType<typeof import('./theme')['useTheme']>, tokens: SurfaceTokens) {
  // Capture during setup — see VuetifyThemeInstance.
  const framework = useVuetifyTheme()
  watch(
    [computed(() => theme.currentTheme.value?.surfaceColors), theme.isDark],
    () => {
      const dark = theme.isDark.value
      const set = theme.currentTheme.value?.surfaceColors?.[dark ? 'dark' : 'light']
      applySurfaceColors(set, dark, tokens, framework)
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
