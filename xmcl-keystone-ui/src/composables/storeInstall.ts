import type { File, FileModLoaderType } from '@xmcl/curseforge'
import type { ProjectVersion } from '@xmcl/modrinth'
import type { DialogKey } from './dialog'
import type { StoreContentType } from './storeContentType'

/**
 * The market content types that install into an existing instance instead of
 * creating a new one. Modpacks keep the dedicated create-instance flow.
 */
export type InstallableStoreContentType = Exclude<StoreContentType, 'modpack'>

/**
 * Payload for the "install to which instance?" dialog. Only identifiers are
 * passed; the dialog resolves the concrete version per instance so it can
 * show compatibility before anything is downloaded.
 */
export interface StoreInstallTargetsPayload {
  /** Which market the project belongs to. */
  market: 'modrinth' | 'curseforge'
  /** Modrinth project id, or the CurseForge mod id as a string. */
  projectId: string
  /** Project icon, shown in the dialog header. */
  icon?: string
  /** Project title, shown in the dialog header. */
  title: string
  contentType: InstallableStoreContentType
}

export const StoreInstallTargetsDialogKey: DialogKey<StoreInstallTargetsPayload> = 'store-install-targets'

/**
 * Why a given instance cannot take the project right now. `loader-mismatch`
 * only ever applies to mods — resource packs ignore the loader entirely.
 */
export type StoreTargetPickStatus = 'ok' | 'no-version' | 'loader-mismatch'

export interface StoreTargetPickOk<T> {
  status: 'ok'
  target: T
}
export interface StoreTargetPickFailed {
  status: Exclude<StoreTargetPickStatus, 'ok'>
}

/**
 * Pick the newest version of the project that fits one instance, from the
 * full (newest-first) version list.
 *
 * - `no-version`: nothing supports the instance's Minecraft version at all.
 * - `loader-mismatch`: versions exist for that Minecraft version but none
 *   carry the instance's mod loader (mods only; vanilla instances have no
 *   loader, so every mod lands here too).
 */
export function pickModrinthVersion(
  versions: ProjectVersion[],
  minecraft: string,
  loaders: string[],
  contentType: InstallableStoreContentType,
): StoreTargetPickOk<ProjectVersion> | StoreTargetPickFailed {
  const compatible = versions.filter(v => !minecraft || v.game_versions.includes(minecraft))
  if (compatible.length === 0) {
    return { status: 'no-version' }
  }
  if (contentType === 'resourcepack') {
    return { status: 'ok', target: compatible[0] }
  }
  const matched = compatible.find(v => loaders.some(l => v.loaders.includes(l)))
  return matched ? { status: 'ok', target: matched } : { status: 'loader-mismatch' }
}

/**
 * Pick the newest CurseForge file that fits one instance, from the
 * (newest-first) file list already filtered by the instance's Minecraft
 * version server-side. Mirrors {@link pickModrinthVersion}'s statuses.
 */
export function pickCurseforgeFile(
  files: File[],
  loaderType: FileModLoaderType | undefined,
  contentType: InstallableStoreContentType,
  hasModLoaderTypes: (file: File) => Set<FileModLoaderType>,
): StoreTargetPickOk<File> | StoreTargetPickFailed {
  if (files.length === 0) {
    return { status: 'no-version' }
  }
  if (contentType === 'resourcepack') {
    return { status: 'ok', target: files[0] }
  }
  if (!loaderType) {
    return { status: 'loader-mismatch' }
  }
  const matched = files.find(f => hasModLoaderTypes(f).has(loaderType))
  return matched ? { status: 'ok', target: matched } : { status: 'loader-mismatch' }
}
