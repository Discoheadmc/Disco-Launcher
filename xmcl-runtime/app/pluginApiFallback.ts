import type { LauncherAppPlugin } from './LauncherAppPlugin'
import type { Handler } from './LauncherProtocolHandler'
import { CurseforgeV1Client } from '@xmcl/curseforge'
import { kSettings } from '~/settings/settings'

// Disco Launcher: the xmcl.org signaling fallback (multiplayer relay auth) was
// removed with the P2P multiplayer feature. This plugin now only injects the
// CurseForge API key for direct api.curseforge.com requests routed through the
// launcher protocol.
//
// The key comes from user settings (Settings > Network > API Keys). It is
// never bundled with the launcher: the legacy build-time `CURSEFORGE_API_KEY`
// env var is only used as a fallback while the user has not entered a key.
// The shared `CurseforgeV1Client` (market provider / install pipeline) is
// registered later by `pluginMarketProvider`; `register()` resolves any
// pending `get()`, so mutating its public `headers` afterwards covers both
// request paths with the same key.
export const pluginApiFallback: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('ApiFallback')

  const applyKey = (key: string) => {
    const trimmed = (key || '').trim()
    if (!trimmed) return
    // Renderer/store requests to api.curseforge.com go through the launcher
    // protocol; stamp the user key unless the request already carries one.
    const handler: Handler = ({ request }) => {
      if (request.url.host === 'api.curseforge.com') {
        request.headers['x-api-key'] = request.headers['x-api-key'] || trimmed
      }
    }
    app.protocol.registerHandler('https', handler)

    // Shared client used by the market provider (project details, files,
    // install flows). `headers` is read on every request.
    app.registry.get(CurseforgeV1Client).then((client) => {
      client.headers['x-api-key'] = trimmed
    }).catch(() => undefined)
  }

  const fallback = process.env.CURSEFORGE_API_KEY || ''
  if (fallback) {
    applyKey(fallback)
  }

  app.registry.get(kSettings).then((state) => {
    let last = ''
    const sync = () => {
      const key = state.curseforgeApiKey || ''
      if (key === last) return
      last = key
      if (key) {
        logger.log('Applied user CurseForge API key from settings')
        applyKey(key)
      }
    }
    sync()
    state.subscribeAll(sync)
  }).catch((e) => {
    logger.warn('Failed to watch settings for the CurseForge API key')
    logger.warn(e as Error)
  })
}
