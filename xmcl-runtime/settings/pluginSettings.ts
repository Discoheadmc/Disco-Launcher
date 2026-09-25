import { SettingSchema, Settings } from '@xmcl/runtime-api'
import { AggregateExecutor } from '@xmcl/utils'
import { readJson, writeJson } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { ServiceStateManager } from '~/service'
import { kSettings } from './settings'

export const pluginSettings: LauncherAppPlugin = async (app) => {
  const stateManager = await app.registry.get(ServiceStateManager)
  const state = stateManager.registerStatic(new Settings(), 'settings')
  const logger = app.getLogger('Settings')
  const settingJsonPath = join(app.appDataPath, 'setting.json')

  const saver = new AggregateExecutor<void, void>(() => { }, async () => {
    const data = SettingSchema.parse(state)
    try {
      await writeJson(settingJsonPath, data, { spaces: 2 })
    } catch (e) {
      // Best-effort: do NOT propagate as an unhandled rejection.
      // This saver runs on every state change; if writeJson fails
      // (EPERM/EBUSY/EROFS because of OneDrive sync, antivirus,
      // read-only mount on Linux, ...), reporting every retry as a
      // trackException creates a per-user storm and we still cannot
      // recover from the underlying environment issue. The next state
      // change re-triggers the saver, so transient locks self-heal.
      logger.warn(`Fail to save ${settingJsonPath}`)
      logger.warn(e as Error)
    }
  }, 1000)

  app.registryDisposer(async () => {
    return saver.flush()
  })

  // Disco Launcher defaults to Turkish on first launch. A locale explicitly
  // saved from Settings > General > Language always wins. E2E runs keep
  // English so Playwright text assertions stay deterministic.
  const DEFAULT_LOCALE = 'tr'

  const normalizeLocale = (locale: string) => {
    if (!locale) {
      return process.env.XMCL_E2E ? 'en' : DEFAULT_LOCALE
    }
    if (locale.startsWith('en')) {
      locale = 'en'
    }
    return locale
  }

  readJson(settingJsonPath).catch(() => ({})).then((rawData) => {
    // SettingSchema uses .catch() for each field, so invalid fields fallback to defaults automatically
    const data = SettingSchema.parse(rawData)
    data.locale = normalizeLocale(data.locale)
    state.config(data)
  }).catch((e) => {
    logger.error(e)
    // Still normalize locale with defaults when everything fails
    const data = SettingSchema.parse({})
    data.locale = normalizeLocale(data.locale)
    state.config(data)
  }).finally(() => {
    app.registry.register(kSettings, state)
    state.subscribeAll(() => {
      saver.push()
    })
  })
}
