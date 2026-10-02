import { Client } from 'undici'
import { LauncherAppPlugin } from '~/app'
import { GFW, kGFW } from '../gfw'

export const pluginGFW: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('GFW')
  async function probe(client: Client): Promise<boolean> {
    try {
      const r = await client.request({
        method: 'HEAD',
        path: '/',
        connectTimeout: 5000,
        headersTimeout: 5000,
      })
      void r.body.dump()
      return true
    } catch {
      return false
    }
  }
  async function updateGFW() {
    const google = new Client('https://www.google.com')
    const taobao = new Client('https://registry.npmmirror.com')
    try {
      const [googleOk, taobaoOk] = await Promise.all([probe(google), probe(taobao)])
      // Inside the GFW, google.com is blocked while npmmirror stays reachable.
      // The old race (`Promise.any`) decided by whichever HEAD answered first,
      // and npmmirror's global CDN often wins outside China — wrongly forcing
      // bmcl mirrors for everyone. google reachable ⇒ definitively outside.
      const networkEnv = googleOk ? 'global' : (taobaoOk ? 'cn' : 'global')
      logger.log(
        networkEnv === 'cn'
          ? 'Detected current in Chinese Mainland.'
          : 'Detected current NOT in Chinese Mainland.',
      )
      return networkEnv
    } finally {
      google.close()
      taobao.close()
    }
  }
  app.registry.register(kGFW, new GFW(updateGFW()))
}