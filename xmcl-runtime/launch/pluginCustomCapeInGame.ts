import { MinecraftFolder } from '@xmcl/core'
import { ensureDir, existsSync, remove, writeFile } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { InstanceService } from '~/instance'
import {
  FABRIC_API_JAR_NAME,
  MOD_FABRIC_LOADER,
  MOD_JAVA,
  MOD_MINECRAFT,
  WSKINLOADER_JAR_NAME,
  installWSkinLoaderMods,
} from '~/instance/wskinloader'
import { VersionInstallService } from '~/install/InstallService'
import { LaunchService } from '~/launch'
import { LocalCapeService } from '~/user/LocalCapeService'

/**
 * Disco custom cape → in-game visibility (client-side only, local-only).
 *
 * The launcher-local custom cape (LocalCapeService) is launcher-only by
 * design: the PNG lives in the closet and no Mojang request is ever made.
 * Vanilla Minecraft cannot *add* a cape to a profile that has none (a
 * resource pack can only replace an existing cape texture), so in-game
 * visibility is implemented with a small client-side fabric mod instead.
 *
 * This is OPT-IN per instance: only instances created with the
 * "WSkinLoader (custom cape in-game)" option checked (the `wskinLoader`
 * instance flag, a fabric-only feature) are managed here. Unflagged
 * instances are never touched — no fabric install, no mod files, nothing.
 *
 * On every client launch of a FLAGGED fabric instance (when the bundled mod
 * chain supports it):
 *   1. the launched version is swapped in-memory to the instance's fabric
 *      version when needed (`LaunchOption.version` accepts a version id
 *      string, which `@xmcl/core` resolves at spawn time, after the
 *      middlewares; the instance json on disk stays untouched);
 *   2. the bundled jars (written at instance creation time) are re-verified;
 *   3. `config/wskinloader.json` points the mod at the launcher's local cape
 *      endpoint `http://localhost:<port>/disco/cape?account=<key>&name=%name%`
 *      served by `LocalCapeService.registerProtocolHandler()`. `%name%` is
 *      filled by the mod with the launching player's name, so only this
 *      player's cape resolves locally. The config is refreshed on every
 *      launch because it embeds the launching account; it is removed again
 *      when the account has no custom cape (the mod stays inert).
 *
 * Everything is idempotent, cosmetic and never fails the launch.
 */

function compareVersions(a: string, b: string) {
  const pa = a.split('.').map(n => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => Number.parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

const WSkinLoaderConfig = {
  skinApis: [] as Array<{ url: string; alias: string }>,
  capeApis: [] as Array<{ url: string; alias: string }>,
  skinUrls: [] as string[],
  capeUrls: [] as string[],
  enableTabListHeads: true,
  skipDuplicateTabHead: true,
  enableNameTagLabel: true,
  enableChatFaces: false,
  premiumFirst: true,
  keepPremiumWhenUnavailable: true,
  playerOverrides: {} as Record<string, unknown>,
}

export const pluginCustomCapeInGame: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('CustomCapeInGame')

  // `registry.get()` never CREATES a service — an uncreated service would
  // leave the promise pending forever and silently disable the plugin (and
  // everything after it). `getOrCreate` guarantees the instance exists; all
  // other services are resolved lazily inside the middleware.
  app.registry.getOrCreate(LaunchService).then((launchService) => {
    launchService.registerMiddleware({
      name: 'disco-custom-cape',
      async onBeforeLaunch(input, payload) {
        if (payload.side !== 'client') return

        const user = input.user
        const gameProfile = user && user.profiles[user.selectedProfile]
        if (!user || !gameProfile) return

        const instanceService = await app.registry.getOrCreate(InstanceService)
        await instanceService.initialize()
        const instancePath = input.gameDirectory
        const instance = instanceService.state.all[instancePath]
        if (!instance) return

        // OPT-IN: only instances created with the WSkinLoader option are managed.
        if (!instance.wskinLoader) return

        const mc = MinecraftFolder.from(instancePath)

        try {
          // Resolved lazily: the service (and its /disco/cape endpoint) may
          // not exist until the renderer used the cape screen once.
          const capeService = await app.registry.getOrCreate(LocalCapeService)
          await capeService.initialize()
          const account = `${user.id}:${gameProfile.id}`
          const hasCape = await capeService.hasCape(account)

          const configDir = join(instancePath, 'config')
          const configFile = join(configDir, 'wskinloader.json')

          if (!hasCape) {
            // No custom cape on this account → the config would only point
            // the mod at a 404. Remove it; the mod (if present) stays inert
            // with default (api-less) configuration.
            if (existsSync(configFile)) {
              await remove(configFile)
              logger.log(`Custom cape: removed wskinloader config (no custom cape) for ${instancePath}`)
            }
            return
          }

          if (instance.runtime.minecraft !== MOD_MINECRAFT) {
            // The bundled mod chain is built for this minecraft version only.
            logger.log(`Custom cape in-game skipped (minecraft ${instance.runtime.minecraft} unsupported) for ${instancePath}`)
            return
          }
          if (instance.runtime.forge || instance.runtime.neoForged || instance.runtime.quiltLoader) {
            // The flag is fabric-only; never mix the mod into other loaders.
            logger.log(`Custom cape in-game skipped (loader is not fabric) for ${instancePath}`)
            return
          }

          // Java gate (the mod needs java >= 25).
          const javaMajor = Number.parseInt(
            instance.java?.match(/(?:java-|jdk-)?(\d+)(?:\.\d+)*$/i)?.[1] ?? '',
            10,
          )
          if (Number.isFinite(javaMajor) && javaMajor < MOD_JAVA) {
            logger.log(`Custom cape in-game skipped (java ${javaMajor} < ${MOD_JAVA}) for ${instancePath}`)
            return
          }

          // Defensive: an old flagged instance without a fabric runtime can
          // still get one silently (the user explicitly opted in).
          if (!instance.runtime.fabricLoader) {
            try {
              const installService = await app.registry.getOrCreate(VersionInstallService)
              const result = await installService.install({
                type: 'instance',
                instancePath,
                runtime: { minecraft: instance.runtime.minecraft, fabricLoader: MOD_FABRIC_LOADER },
              })
              if (result?.version) {
                payload.options.version = result.version
                logger.log(`Custom cape: installed fabric runtime ${result.version} (${instancePath})`)
              }
            } catch (e) {
              logger.warn(`Failed to ensure fabric runtime for custom cape: ${e}`)
              return
            }
          }

          // 1. Ensure the launched version can run the mod chain (fabric
          //    loader >= 0.19.5). A newer user-chosen fabric build for the
          //    same minecraft version is kept; anything else is swapped
          //    in-memory to the instance's fabric version. The instance json
          //    keeps its own id; only this launch is affected.
          const fabricVersionId = `${instance.runtime.minecraft}-fabric${instance.runtime.fabricLoader || MOD_FABRIC_LOADER}`
          const current = payload.options.version
          const currentId = typeof current === 'string' ? current : current.id
          if (currentId !== fabricVersionId) {
            const fabricPrefix = `${instance.runtime.minecraft}-fabric`
            const currentLoader = currentId.startsWith(fabricPrefix)
              ? currentId.slice(fabricPrefix.length)
              : undefined
            const needSwap = !currentLoader || compareVersions(currentLoader, MOD_FABRIC_LOADER) < 0
            if (needSwap) {
              payload.options.version = fabricVersionId
              logger.log(`Custom cape: launching ${fabricVersionId} instead of ${currentId}`)
            }
          }

          // 2. Mod jars in place (they may have been removed manually; only
          //    our exact file names are ever written).
          await installWSkinLoaderMods(instancePath, (m) => logger.log(m))
          logger.log(`Custom cape: verified ${WSKINLOADER_JAR_NAME} + ${FABRIC_API_JAR_NAME} in ${mc.mods}`)

          // 3. Mod config → local cape endpoint (refreshed every launch; it
          //    embeds the launching account).
          const port = await app.serverPort
          const config = {
            ...WSkinLoaderConfig,
            capeApis: [
              {
                url: `http://localhost:${port}/disco/cape?account=${encodeURIComponent(account)}&name=%name%`,
                alias: 'disco-local-cape',
              },
            ],
          }
          await ensureDir(configDir)
          await writeFile(configFile, JSON.stringify(config, null, 2), 'utf-8')
          logger.log(`Custom cape in-game prepared for ${account} (${instancePath})`)
        } catch (e) {
          // Cosmetic feature: never fail the launch over it.
          logger.warn(`Failed to prepare custom cape in-game for ${instancePath}`)
          logger.warn(e as Error)
        }
      },
    })

    logger.log('Custom cape in-game plugin ready')
  }).catch((e) => {
    logger.warn('Failed to initialize custom cape in-game plugin')
    logger.warn(e as Error)
  })
}
