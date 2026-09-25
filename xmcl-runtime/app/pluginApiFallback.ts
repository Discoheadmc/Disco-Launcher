import type { LauncherAppPlugin } from './LauncherAppPlugin'
import type { Handler } from './LauncherProtocolHandler'

// Disco Launcher: the xmcl.org signaling fallback (multiplayer relay auth) was
// removed with the P2P multiplayer feature. This plugin now only injects the
// CurseForge API key for direct api.curseforge.com requests routed through the
// launcher protocol.
export const pluginApiFallback: LauncherAppPlugin = (app) => {
  const handler: Handler = ({ request }) => {
    if (request.url.host === 'api.curseforge.com') {
      request.headers['x-api-key'] = process.env.CURSEFORGE_API_KEY || ''
    }
  }
  app.protocol.registerHandler('https', handler)
}
