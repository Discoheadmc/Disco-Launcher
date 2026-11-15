import { computed, Ref, shallowRef } from 'vue'
import { LocalCapeServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'

/**
 * Launcher-local custom cape, independent from Mojang's official cape system.
 * The PNG never leaves the machine — it is stored in the launcher's closet
 * directory and keyed by `userId:gameProfileId`, so each account (Microsoft or
 * offline) carries its own cape. It only affects renders owned by this
 * launcher; it never calls any Mojang API.
 *
 * The cape map is a module-level shared ref: every consumer (profile panel,
 * dialogs, closet previews) reads and writes the same store, so all 3D
 * previews stay in sync after an apply/remove from any surface.
 */
const capes = shallowRef<Record<string, string>>({})
let refreshPromise: Promise<void> | undefined

export function useUserCape() {
  const service = useService(LocalCapeServiceKey)

  async function refresh() {
    if (refreshPromise) return refreshPromise
    refreshPromise = (async () => {
      try {
        const state = await service.getState()
        capes.value = state.capes
      } catch {
        // Keep the previous snapshot on transient backend failures.
      } finally {
        refreshPromise = undefined
      }
    })()
    return refreshPromise
  }

  // Re-fetch on each consumer mount so externally-applied changes
  // (e.g. another window) are picked up cheaply.
  void refresh()

  function capeFor(accountKey: Ref<string>) {
    return computed(() => capes.value[accountKey.value] || '')
  }

  async function setCape(accountKey: Ref<string>, source: string) {
    const url = await service.setCape({ account: accountKey.value, source })
    capes.value = { ...capes.value, [accountKey.value]: url }
    return url
  }

  async function removeCape(accountKey: Ref<string>) {
    await service.removeCape(accountKey.value)
    const next = { ...capes.value }
    delete next[accountKey.value]
    capes.value = next
  }

  return { capes, refresh, capeFor, setCape, removeCape }
}

/**
 * Convenience wrapper for a single account key ref (used by panels bound to
 * the currently selected account).
 */
export function useAccountCustomCape(accountKey: Ref<string>) {
  const { capes, refresh, capeFor, setCape, removeCape } = useUserCape()
  const capeUrl = capeFor(accountKey)
  return {
    capeUrl,
    refresh,
    setCape: (source: string) => setCape(accountKey, source),
    removeCape: () => removeCape(accountKey),
  }
}
