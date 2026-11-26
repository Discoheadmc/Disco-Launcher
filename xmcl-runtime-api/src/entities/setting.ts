import { type InvalidDirectoryErrorCode } from '../services/BaseService'
import { type SettingSchema } from './setting.schema'
import { type ReleaseInfo } from './update'

/**
 * The basic setting of the launcher.
 *
 * It also contains the some state properties of the launcher.
 */
export class Settings implements SettingSchema {
  globalDisableAuthlibInjector = false
  globalDisableElyByAuthlib = false
  globalMinMemory = 0
  globalMaxMemory = 0
  globalAssignMemory: 'auto' | boolean = false
  globalJava: string = ''
  globalVmOptions: string[] = []
  globalMcOptions: string[] = []
  globalPrependCommand: string = ''
  globalPreExecuteCommand: string = ''
  globalFastLaunch = false
  globalHideLauncher = false
  globalShowLog = false
  globalEnv: Record<string, string> = {}
  globalResolution: { width?: number; height?: number; fullscreen?: boolean; monitor?: string } = {}
  discordPresence = false
  developerMode = false
  // Disco Launcher: gates the experimental layout features (inventory theme,
  // new home). Off by default; an install that predates betaMode is migrated
  // in the settings loader (xmcl-runtime/settings/pluginSettings.ts). The
  // field stays undefined until then/on a fresh install.
  betaMode: boolean | undefined = false
  // Disco Launcher: telemetry off by default.
  disableTelemetry = true
  linuxTitlebar = false
  windowTranslucent = false
  quickActionShortcut = ''

  // Disco: UI identity. The inventory layout replaces the top menu bar and
  // the left icon bar with a bottom hotbar, square instance slots and a
  // tooltip detail panel. The new lobby replaces the instance grid with a
  // large "last played" card plus a compact list. Both are independent.
  // Defaults are ON (see setting.schema.ts); a missing key in an existing
  // setting.json is filled with the default by the zod `.catch(true)`.
  inventoryTheme = true
  dashboardHome = true

  locale = ''

  theme = 'dark' as 'dark' | 'light' | 'system'
  /**
   * All supported languages of the launcher
   */
  locales: {
    /**
     * The i18n locale key
     */
    locale: string
    /**
     * The human readable name of the locale
     */
    name: string
  }[] = []

  updateInfo: ReleaseInfo | null = null
  updateStatus: 'ready' | 'none' | 'pending' = 'none'
  allowPrerelease = false
  autoInstallOnAppQuit = false
  autoDownload = false
  enableDedicatedGPUOptimization = true
  apiSetsPreference: 'mojang' | 'bmcl' | '' = ''
  apiSets = [{ name: 'bmcl', url: 'https://bmclapi2.bangbang93.com' }]
  /**
   * Is current environment connecting to internet?
   */
  online = false
  replaceNatives: 'all' | 'legacy-only' | false = 'legacy-only'

  httpProxy = ''

  httpProxyEnabled = false

  /** User-provided CurseForge API key (Settings > Network > API Keys). */
  curseforgeApiKey = ''

  maxSockets = 0

  maxAPISockets = 0

  diskFullError = false

  databaseReady = false

  /**
   * Number of resource DB rows whose curseforge/modrinth metadata was
   * detected as corrupted (e.g. a file path leaked into modrinth.versionId)
   * during the startup sweep. The rows have already been healed
   * (offending fields nulled); this count is purely a UI hint so the
   * user knows some resource attribution was lost.
   */
  corruptedResourceCount = 0

  invalidGameDataPath: InvalidDirectoryErrorCode = undefined

  config(config: SettingSchema) {
    this.locale = config.locale
    this.autoDownload = config.autoDownload || false
    this.autoInstallOnAppQuit = config.autoInstallOnAppQuit || false
    this.allowPrerelease = config.allowPrerelease || false
    this.apiSetsPreference = config.apiSetsPreference
    this.httpProxy = config.httpProxy
    this.httpProxyEnabled = config.httpProxyEnabled
    this.curseforgeApiKey = config.curseforgeApiKey ?? ''
    this.maxSockets = config.maxSockets ?? 16
    this.maxAPISockets = config.maxAPISockets ?? 0
    this.theme = config.theme
    this.globalMinMemory = config.globalMinMemory
    this.globalMaxMemory = config.globalMaxMemory
    this.globalAssignMemory = config.globalAssignMemory
    this.globalJava = config.globalJava
    this.globalVmOptions = config.globalVmOptions
    this.globalMcOptions = config.globalMcOptions
    this.globalFastLaunch = config.globalFastLaunch
    this.globalPrependCommand = config.globalPrependCommand
    this.globalHideLauncher = config.globalHideLauncher
    this.globalShowLog = config.globalShowLog
    this.globalDisableElyByAuthlib = config.globalDisableElyByAuthlib
    this.globalDisableAuthlibInjector = config.globalDisableAuthlibInjector
    this.globalPreExecuteCommand = config.globalPreExecuteCommand
    this.globalEnv = config.globalEnv
    this.discordPresence = config.discordPresence
    this.developerMode = config.developerMode
    this.betaMode = config.betaMode
    this.disableTelemetry = config.disableTelemetry
    this.linuxTitlebar = config.linuxTitlebar
    this.windowTranslucent = config.windowTranslucent
    this.enableDedicatedGPUOptimization = config.enableDedicatedGPUOptimization
    this.replaceNatives = config.replaceNatives
    this.globalResolution = config.globalResolution
    this.quickActionShortcut = config.quickActionShortcut ?? ''
    this.inventoryTheme = config.inventoryTheme ?? true
    this.dashboardHome = config.dashboardHome ?? true
  }

  developerModeSet(developerMode: boolean) {
    this.developerMode = developerMode
  }

  betaModeSet(enabled: boolean) {
    this.betaMode = enabled
  }

  quickActionShortcutSet(shortcut: string) {
    this.quickActionShortcut = shortcut
  }

  inventoryThemeSet(enabled: boolean) {
    this.inventoryTheme = enabled
  }

  dashboardHomeSet(enabled: boolean) {
    this.dashboardHome = enabled
  }

  discordPresenceSet(presence: boolean) {
    this.discordPresence = presence
  }

  themeSet(theme: 'dark' | 'light' | 'system') {
    this.theme = theme
  }

  localeSet(language: string) {
    this.locale = language
  }

  enableDedicatedGPUOptimizationSet(enabled: boolean) {
    this.enableDedicatedGPUOptimization = enabled
  }

  localesSet(languages: {
    /**
     * The i18n locale key
     */
    locale: string
    /**
     * The human readable name of the locale
     */
    name: string
  }[]) {
    this.locales = languages
  }

  httpProxySet(proxy: string) {
    this.httpProxy = proxy
  }

  curseforgeApiKeySet(key: string) {
    this.curseforgeApiKey = key
  }

  httpProxyEnabledSet(enabled: boolean) {
    this.httpProxyEnabled = enabled
  }

  allowPrereleaseSet(allowPrerelease: boolean) {
    if (typeof allowPrerelease === 'boolean') { this.allowPrerelease = allowPrerelease }
  }

  autoInstallOnAppQuitSet(autoInstallOnAppQuit: boolean) {
    if (typeof autoInstallOnAppQuit === 'boolean') this.autoInstallOnAppQuit = autoInstallOnAppQuit
  }

  updateStatusSet(updateStatus: 'ready' | 'none' | 'pending') {
    this.updateStatus = updateStatus
  }

  autoDownloadSet(autoDownload: boolean) {
    if (typeof autoDownload === 'boolean') this.autoDownload = autoDownload
  }

  updateInfoSet(updateInfo: ReleaseInfo) {
    if (typeof updateInfo === 'object') this.updateInfo = updateInfo
  }

  apiSetsPreferenceSet(apiSetsPreference: 'mojang' | 'bmcl' | '') {
    this.apiSetsPreference = apiSetsPreference
  }

  apiSetsSet(sets: { name: string; url: string }[]) {
    this.apiSets = sets
  }

  onlineSet(online: boolean) {
    this.online = online
  }

  maxSocketsSet(val: number) {
    this.maxSockets = Number(val)
  }

  maxAPISocketsSet(val: number) {
    this.maxAPISockets = val
  }

  disableTelemetrySet(disable: boolean) {
    this.disableTelemetry = disable
  }

  linuxTitlebarSet(enabled: boolean) {
    this.linuxTitlebar = enabled
  }

  windowTranslucentSet(enabled: boolean) {
    this.windowTranslucent = enabled
  }

  replaceNativesSet(replace: 'all' | 'legacy-only' | false) {
    this.replaceNatives = replace
  }

  globalResolutionSet(resolution: { width?: number; height?: number; fullscreen?: boolean; monitor?: string }) {
    this.globalResolution = resolution
  }

  diskFullErrorSet(diskFullError: boolean) {
    this.diskFullError = diskFullError
  }

  databaseReadySet(ready: boolean) {
    this.databaseReady = ready
  }

  corruptedResourceCountSet(count: number) {
    this.corruptedResourceCount = count
  }

  invalidGameDataPathSet(invalid: InvalidDirectoryErrorCode) {
    this.invalidGameDataPath = invalid
  }

  globalInstanceSetting(settings: {
    globalMinMemory: number
    globalMaxMemory: number
    globalAssignMemory: boolean | 'auto'
    globalJava: string
    globalVmOptions: string[]
    globalMcOptions: string[]
    globalFastLaunch: boolean
    globalHideLauncher: boolean
    globalShowLog: boolean
    globalDisableAuthlibInjector: boolean
    globalDisableElyByAuthlib: boolean
    globalPrependCommand: string
    globalPreExecuteCommand: string
    globalEnv: Record<string, string>
    globalResolution: { width?: number; height?: number; fullscreen?: boolean; monitor?: string }
  }) {
    this.globalMinMemory = settings.globalMinMemory
    this.globalMaxMemory = settings.globalMaxMemory
    this.globalAssignMemory = settings.globalAssignMemory
    this.globalJava = settings.globalJava
    this.globalVmOptions = settings.globalVmOptions
    this.globalMcOptions = settings.globalMcOptions
    this.globalFastLaunch = settings.globalFastLaunch
    this.globalHideLauncher = settings.globalHideLauncher
    this.globalShowLog = settings.globalShowLog
    this.globalDisableAuthlibInjector = settings.globalDisableAuthlibInjector
    this.globalDisableElyByAuthlib = settings.globalDisableElyByAuthlib
    this.globalPrependCommand = settings.globalPrependCommand
    this.globalPreExecuteCommand = settings.globalPreExecuteCommand
    this.globalEnv = settings.globalEnv
    this.globalResolution = settings.globalResolution
  }
}
