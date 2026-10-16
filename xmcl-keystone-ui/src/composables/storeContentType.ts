import { CurseforgeBuiltinClassId } from '@/composables/curseforge'

/**
 * The content type the store (#/store) is browsing. The market used to be
 * modpack-only; the type selector turns it into a three-type browser while
 * keeping `modpack` the default so the screen opens exactly as before.
 */
export type StoreContentType = 'modpack' | 'mod' | 'resourcepack'

export const STORE_CONTENT_TYPES: readonly StoreContentType[] = ['modpack', 'mod', 'resourcepack'] as const

export function isStoreContentType(value: string | undefined | null): value is StoreContentType {
  return value === 'modpack' || value === 'mod' || value === 'resourcepack'
}

/** Anything unknown falls back to `modpack` — the pre-selector behaviour. */
export function normalizeStoreContentType(value: string | undefined | null): StoreContentType {
  return isStoreContentType(value) ? value : 'modpack'
}

/**
 * The Modrinth `project_type` facet value. Modrinth uses these exact strings,
 * so the store content type maps 1:1.
 */
export function getModrinthProjectType(type: StoreContentType): string {
  return type
}

/** The CurseForge classId to search for the content type. */
export function getCurseforgeClassId(type: StoreContentType): CurseforgeBuiltinClassId {
  switch (type) {
    case 'mod': return CurseforgeBuiltinClassId.mod
    case 'resourcepack': return CurseforgeBuiltinClassId.resourcePack
    // case 'modpack':
    default: return CurseforgeBuiltinClassId.modpack
  }
}
