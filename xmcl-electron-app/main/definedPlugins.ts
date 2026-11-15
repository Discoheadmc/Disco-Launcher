import { pluginIconProtocol } from './pluginIconProtocol'
import { pluginDiscreteGPULinux } from './pluginDiscreteGPULinux'
import { pluginLinuxDisplay } from './pluginLinuxDisplay'
import { pluginPowerMonitor } from './pluginPowerMonitor'

import { pluginApiFallback } from '@xmcl/runtime/app/pluginApiFallback'
import { pluginCommonProtocol } from '@xmcl/runtime/app/pluginCommonProtocol'
import { pluginMediaProtocol } from '@xmcl/runtime/app/pluginMediaProtocol'
import { pluginCli } from '@xmcl/runtime/commands/pluginCli'
import { pluginCommandHost } from '@xmcl/runtime/commands/pluginCommandHost'
import { pluginEncodingWorker } from '@xmcl/runtime/encoding/pluginEncodingWorker'
import {
  pluginClientToken,
  pluginFlights,
  pluginGFW,
  pluginImageStorage,
  pluginLogConsumer,
  pluginTasks,
  pluginUncaughtError,
} from '@xmcl/runtime/infra/plugins'
import { pluginLaunchPrecheck } from '@xmcl/runtime/launch/pluginLaunchPrecheck'
import { pluginMarketProvider } from '@xmcl/runtime/market/pluginMarketProvider'
import { pluginNativeReplacer } from '@xmcl/runtime/nativeReplacer/pluginNativeReplacer'
import { pluginNetworkInterface } from '@xmcl/runtime/network/pluginNetworkInterface'
import { pluginUndiciLogger } from '@xmcl/runtime/network/pluginUndiciLogger'
import { pluginUserPlaytime } from '@xmcl/runtime/playTime/pluginUserPlaytime'
import { pluginResourceWorker } from '@xmcl/runtime/resource/pluginResourceWorker'
import { pluginCustomCapeInGame } from '@xmcl/runtime/launch/pluginCustomCapeInGame'
import { pluginResourcePackLink } from '@xmcl/runtime/resourcePack/pluginResourcePackLink'
import { pluginSaveWorker } from '@xmcl/runtime/save/pluginSaveWorker'
import { pluginServicesHandler } from '@xmcl/runtime/service/pluginServicesHandler'
import { pluginSettings } from '@xmcl/runtime/settings/pluginSettings'
import { pluginSetup } from '@xmcl/runtime/setup/pluginSetup'
import { pluginModrinthAccess } from '@xmcl/runtime/user/pluginModrinthAccess'
import { pluginOfficialUserApi } from '@xmcl/runtime/user/pluginOfficialUserApi'
import { pluginOffineUser } from '@xmcl/runtime/user/pluginOfflineUser'
import { pluginLocalYggdrasilHandler } from '@xmcl/runtime/user/pluginLocalYggdrasilHandler'
import { pluginUserTokenStorage } from '@xmcl/runtime/user/pluginUserTokenStorage'

import { LauncherAppPlugin } from '~/app'
import { definedServices } from './definedServices'

/**
 * A1: Heavy plugin'ler (worker thread spawn edenler) constructor'ı bloke etmesin
 * diye `app.whenReady()` sonrasına ertelenir. Factory henüz çağrılmaz — plugin
 * fonksiyonu Electron hazır olduğunda çalışır. Bu sayede main process'te
 * constructor sync/bitmemiş kalır; ağır spawn/sync IO'lar UI bloklamadan önce
 * tamamlanabilir.
 */
function deferredPlugin(name: string, plugin: LauncherAppPlugin): LauncherAppPlugin {
  return (app, manifest) => {
    app.getLogger('DeferredPlugins').log(`Deferred plugin: ${name} (runs after app.whenReady)`)
    app.waitEngineReady().then(() => plugin(app, manifest))
  }
}

export const definedPlugins: LauncherAppPlugin[] = [
  pluginCommandHost({ services: definedServices }),
  pluginCli,
  pluginPowerMonitor,
  pluginIconProtocol,
  pluginApiFallback,
  // A1: Worker-spawn'layan heavy plugin'ler deferred — spawn/main thread spawn
  // penceresi UI bloklamamalı.
  deferredPlugin('pluginResourceWorker', pluginResourceWorker),
  deferredPlugin('pluginEncodingWorker', pluginEncodingWorker),
  deferredPlugin('pluginSaveWorker', pluginSaveWorker),
  pluginSetup,
  pluginLaunchPrecheck,
  pluginLinuxDisplay,
  pluginDiscreteGPULinux,
  pluginUncaughtError,
  pluginNativeReplacer,
  pluginMarketProvider,

  pluginMediaProtocol,
  pluginResourcePackLink,
  pluginCustomCapeInGame,
  pluginUserPlaytime,
  pluginClientToken,
  pluginServicesHandler(definedServices),
  // Disco Launcher: telemetry disabled — faster startup and less background
  // network/CPU overhead on low-end machines.
  pluginLogConsumer,
  pluginSettings,
  pluginGFW,
  pluginTasks,
  pluginImageStorage,
  pluginFlights,
  pluginNetworkInterface,
  pluginUserTokenStorage,
  pluginOfficialUserApi,
  pluginOffineUser,
  pluginLocalYggdrasilHandler,
  pluginUndiciLogger,

  pluginModrinthAccess,

  pluginCommonProtocol,
]
