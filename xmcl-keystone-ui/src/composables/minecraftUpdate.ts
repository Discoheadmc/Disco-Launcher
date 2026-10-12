import type { Instance } from '@xmcl/instance'
import { InstanceServiceKey } from '@xmcl/runtime-api'
import { computed } from 'vue'
import { kInstances } from '@/composables/instances'
import { useService } from '@/composables/service'
import { injection } from '@/util/inject'
import { useMinecraftVersions } from './version'

/**
 * Parse a plain Minecraft version id into numeric segments.
 *
 * Only dotted numeric ids are comparable ("1.21.4"). Snapshots ("25w31a") and
 * pre-releases ("1.21.5-pre1") have no meaningful ordering against a release,
 * so they are rejected and never compared.
 */
function parseSegments(version: string): number[] | undefined {
  if (!/^\d+(\.\d+)*$/.test(version)) return undefined
  return version.split('.').map(Number)
}

/**
 * Compare two plain Minecraft version ids.
 *
 * Missing segments count as zero so "1.21" and "1.21.0" are the same version.
 * Returns 0 when either side is not a plain version id.
 */
export function compareMinecraftVersion(a: string, b: string): number {
  const left = parseSegments(a)
  const right = parseSegments(b)
  if (!left || !right) return 0
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}

/**
 * The latest stable Minecraft release, plus the refresh/loading state.
 *
 * The version metadata service caches to disk and revalidates in the
 * background, so this is cheap to call from more than one view.
 */
export function useLatestMinecraftRelease() {
  const { release, isValidating, mutate } = useMinecraftVersions()
  const latest = computed(() => release.value?.id)
  return { latest, isValidating, refresh: mutate }
}

/** Whether `latest` is a newer plain release than `current`. */
export function isMinecraftUpdateAvailable(latest: string | undefined, current: string | undefined) {
  if (!latest || !current) return false
  if (latest === current) return false
  return compareMinecraftVersion(latest, current) > 0
}

/** Whether the instance runs a mod loader, so a version bump can break mods. */
export function isModdedInstance(instance: Pick<Instance, 'runtime'> | undefined) {
  const runtime = instance?.runtime
  return !!(runtime && (runtime.forge || runtime.fabricLoader || runtime.quiltLoader || runtime.neoForged))
}

/**
 * Update suggestion for the instance currently open in the settings view.
 *
 * Applying only rewrites `runtime.minecraft`; reinstalling the new game files
 * is handled by the regular instance install path, the same way the server
 * upstream applies its suggestion.
 */
export function useInstanceMinecraftUpdate(instance: () => Instance | undefined) {
  const { latest, isValidating, refresh } = useLatestMinecraftRelease()
  const { editInstance } = useService(InstanceServiceKey)

  const current = computed(() => instance()?.runtime.minecraft)
  const hasUpdate = computed(() => isMinecraftUpdateAvailable(latest.value, current.value))
  const isModded = computed(() => isModdedInstance(instance()))

  async function applyUpdate() {
    const target = instance()
    if (!target || !latest.value) return
    await editInstance({
      instancePath: target.path,
      runtime: { ...target.runtime, minecraft: latest.value },
    })
  }

  return { latest, current, hasUpdate, isModded, isValidating, refresh, applyUpdate }
}

/**
 * Paths of the instances that are behind the latest release, mapped to that
 * release. Drives the update badge on the instance grid.
 */
export function useInstanceMinecraftUpdateMap() {
  const { latest, isValidating, refresh } = useLatestMinecraftRelease()
  const { instances } = injection(kInstances)

  const pending = computed(() => {
    const map = new Map<string, string>()
    if (!latest.value) return map
    for (const instance of instances.value) {
      if (isMinecraftUpdateAvailable(latest.value, instance.runtime.minecraft)) {
        map.set(instance.path, latest.value)
      }
    }
    return map
  })

  return { latest, pending, isValidating, refresh }
}
