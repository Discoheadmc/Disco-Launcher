import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

/**
 * A single, launcher-wide favorite of Minecraft `options.txt` values that the
 * user can re-apply to other instances. It lives in the launcher's own renderer
 * config (localStorage), never inside an instance folder.
 */
export interface McSettingsFavorite {
  /** Instance path the favorite was captured from. */
  sourcePath: string
  /** Display name of the source instance at capture time. */
  sourceName: string
  /** The captured settings, with instance-specific keys already stripped. */
  settings: Record<string, any>
  /** Unix timestamp of the last capture. */
  updatedAt: number
}

/**
 * Keys that must never be part of a shareable favorite because they either pin
 * the target instance to the source Minecraft version, reference instance-local
 * files, or store per-instance session/onboarding state.
 *
 * This list is surfaced to the user for approval before it is treated as final.
 */
export const MC_FAVORITE_EXCLUDED_KEYS: readonly string[] = [
  'version',
  'resourcePacks',
  'incompatibleResourcePacks',
  'lastServer',
  'tutorialStep',
  'onboarding',
  'shaderPack',
  'shaderPackWarn',
]

const STORAGE_KEY = 'mc-settings-favorite'

// Module-scope singleton so the right-panel indicator and the dialog observe the
// same ref within the same renderer. `useLocalStorage` falls back to an
// in-memory ref when there is no `window` (tests / SSR).
const favorite = useLocalStorage<McSettingsFavorite | undefined>(STORAGE_KEY, undefined, {
  deep: true,
  writeDefaults: false,
  // Explicit JSON serializer: the `undefined` initial value would otherwise make
  // VueUse pick its `any` serializer, which stores the object as "[object Object]".
  serializer: StorageSerializers.object,
})

export function isExcludedFromFavorite(key: string) {
  return MC_FAVORITE_EXCLUDED_KEYS.includes(key) || key.startsWith('key_') || key.startsWith('modelPart_')
}

/** Strip everything that must not travel between instances. */
export function toFavoriteSettings(settings: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(settings)) {
    if (isExcludedFromFavorite(key)) continue
    result[key] = value
  }
  return result
}

export function useMcSettingsFavorite() {
  const hasFavorite = computed(
    () => !!favorite.value && Object.keys(favorite.value.settings ?? {}).length > 0,
  )

  function isFavoriteOf(path: string) {
    return !!path && hasFavorite.value && favorite.value?.sourcePath === path
  }

  function saveFavorite(payload: Omit<McSettingsFavorite, 'updatedAt'>) {
    favorite.value = { ...payload, updatedAt: Date.now() }
  }

  function removeFavorite() {
    favorite.value = undefined
  }

  return {
    favorite,
    hasFavorite,
    isFavoriteOf,
    saveFavorite,
    removeFavorite,
  }
}
