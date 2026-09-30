import { MinecraftFolder } from '@xmcl/core'
// @ts-ignore binary import (esbuild `.jar` → binary loader)
import wskinloaderJar from '../launch/cape-mods/wskinloader-1.6.2.jar'
// @ts-ignore binary import (esbuild `.jar` → binary loader)
import fabricApiJar from '../launch/cape-mods/fabric-api-0.161.0_26.3.jar'
import { ensureDir, existsSync, remove, writeFile } from 'fs-extra'
import { join } from 'path'

/**
 * Disco: bundled WSkinLoader client mod (fabric) — the opt-in way to make the
 * launcher-local custom cape visible in-game.
 *
 * The mod chain is bundled with the launcher (`cape-mods/`) and written into
 * an instance's `mods/` folder only when the user opted in (the
 * `wskinLoader` instance flag, chosen on the create-instance screen). A
 * flagged vanilla instance is switched to fabric at launch time by
 * `pluginCustomCapeInGame`; unflagged instances are never touched.
 *
 * - `wskinloader-1.6.2.jar` (minecraft ~26.3, fabricloader >= 0.19.5,
 *   fabric-api, java >= 25) resolves player textures client-side. With
 *   `premiumFirst: true` official Mojang textures stay authoritative and the
 *   mod only consults our endpoint when the profile has NO cape — exactly
 *   the "own view only" behaviour chosen for this feature.
 * - `fabric-api-0.161.0_26.3.jar` is wskinloader's hard dependency.
 */

export const WSKINLOADER_JAR_NAME = 'wskinloader-1.6.2.jar'
export const FABRIC_API_JAR_NAME = 'fabric-api-0.161.0_26.3.jar'

/** Mirrors wskinloader-1.6.2 `fabric.mod.json` depends. */
export const MOD_MINECRAFT = '26.3'
export const MOD_FABRIC_LOADER = '0.19.5'
export const MOD_JAVA = 25

const BUNDLED_JARS: Array<{ name: string; data: Buffer }> = [
  { name: WSKINLOADER_JAR_NAME, data: wskinloaderJar as unknown as Buffer },
  { name: FABRIC_API_JAR_NAME, data: fabricApiJar as unknown as Buffer },
]

/**
 * Write the bundled WSkinLoader mod jars into the instance `mods/` folder.
 * Idempotent: existing files (ours or same-named user files) are left alone.
 */
export async function installWSkinLoaderMods(instancePath: string, log?: (message: string) => void): Promise<void> {
  const mc = MinecraftFolder.from(instancePath)
  await ensureDir(mc.mods)
  for (const jar of BUNDLED_JARS) {
    const dest = join(mc.mods, jar.name)
    if (existsSync(dest)) continue
    await writeFile(dest, jar.data)
    log?.(`Installed ${jar.name} into ${instancePath}`)
  }
}

/**
 * Remove the bundled WSkinLoader mod jars from the instance `mods/` folder.
 * Only our exact file names are touched — user mods are never removed.
 */
export async function removeWSkinLoaderMods(instancePath: string, log?: (message: string) => void): Promise<void> {
  const mc = MinecraftFolder.from(instancePath)
  let removed = false
  for (const jar of BUNDLED_JARS) {
    const dest = join(mc.mods, jar.name)
    if (!existsSync(dest)) continue
    await remove(dest)
    removed = true
  }
  if (removed) log?.(`Removed WSkinLoader mods from ${instancePath}`)
}
