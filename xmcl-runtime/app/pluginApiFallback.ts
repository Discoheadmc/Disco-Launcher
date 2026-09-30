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

  // The protocol handler must be registered exactly once. Registering it per
  // key change leaked a handler on every settings write, and because
  // `LauncherProtocolHandler` runs handlers in registration order the oldest
  // (stale) key always won. Keep a single handler closing over a mutable key.
  let currentKey = ''
  const handler: Handler = ({ request }) => {
    if (currentKey && request.url.host === 'api.curseforge.com') {
      request.headers['x-api-key'] = request.headers['x-api-key'] || currentKey
    }
  }
  app.protocol.registerHandler('https', handler)

  const applyKey = (key: string) => {
    const trimmed = (key || '').trim()
    currentKey = trimmed

    // Shared client used by the market provider (project details, files,
    // install flows). `headers` is read on every request, so an empty key must
    // actively remove the header instead of leaving the previous one behind.
    app.registry.get(CurseforgeV1Client).then((client) => {
      if (trimmed) {
        client.headers['x-api-key'] = trimmed
      } else {
        delete client.headers['x-api-key']
      }
    }).catch(() => undefined)
  }

  const fallback = process.env.CURSEFORGE_API_KEY || ''
  if (fallback) {
    applyKey(fallback)
  }

  app.registry.get(kSettings).then((state) => {
    let last = ''
    const sync = () => {
      const key = (state.curseforgeApiKey || '').trim()
      if (key === last) return
      last = key
      // Apply unconditionally: clearing the key in settings must revoke the
      // previously stored one, otherwise requests keep the old credentials.
      if (key) {
        logger.log('Applied user CurseForge API key from settings')
      } else {
        logger.log('Cleared user CurseForge API key')
      }
      applyKey(key)
    }
    sync()
    state.subscribeAll(sync)
  }).catch((e) => {
    logger.warn('Failed to watch settings for the CurseForge API key')
    logger.warn(e as Error)
  })
}
