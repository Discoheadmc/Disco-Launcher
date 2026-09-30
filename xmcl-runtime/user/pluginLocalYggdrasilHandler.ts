import { AUTHORITY_DEV } from '@xmcl/runtime-api'
import { YggdrasilTexture, YggdrasilTexturesInfo } from '@xmcl/user'
import { Readable } from 'stream'
import { finished } from 'stream/promises'
import { LauncherAppPlugin } from '~/app'
import { UserService } from '~/user'

/**
 * Minimal yggdrasil-compatible endpoint for offline accounts. When the game
 * launches with an offline profile the authlib-injector agent points at
 * `http://localhost:<port>/yggdrasil`; this handler answers the session
 * server requests (hasJoined / profile textures) so the game can resolve the
 * offline player's locally selected skin and cape. Everything is served from
 * the launcher's local state — no Mojang request is involved.
 */
export const pluginLocalYggdrasilHandler: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('LocalYggdrasilServer')

  const getProfile = async (name: string) => {
    const userService = await app.registry.get(UserService)
    const offline = Object.values(userService.state.users).find(v => v.authority === AUTHORITY_DEV)
    if (offline) {
      const profiles = Object.values(offline.profiles)
      return profiles.find(p => p.name === name || p.id === name || p.id.replaceAll('-', '') === name)
    }
    return undefined
  }

  const queryProfile = async (id: string) => {
    const profile = await getProfile(id)
    if (!profile) return undefined

    const addr = `http://localhost:${await app.serverPort}/yggdrasil`
    const transformTexture = (text?: YggdrasilTexture) => {
      if (!text || !text.url) return undefined
      // Local closet images are served over http://launcher/media; leave them
      // untouched since the game can reach the local server directly. Remote
      // textures are proxied through /textures so offline mode still resolves.
      if (text.url.startsWith('http://launcher/media')) return text
      return { ...text, url: `${addr}/textures?href=${encodeURIComponent(text.url)}` }
    }

    const textures = profile.textures || ({} as Record<string, YggdrasilTexture | undefined>)
    const textureInfo: YggdrasilTexturesInfo = {
      timestamp: Date.now(),
      profileId: profile.id.replaceAll('-', ''),
      profileName: profile.name,
      textures: {
        SKIN: transformTexture(textures.SKIN),
        CAPE: transformTexture(textures.CAPE),
        ELYTRA: transformTexture(textures.ELYTRA),
      },
    }

    const textureString = Buffer.from(JSON.stringify(textureInfo)).toString('base64')
    return JSON.stringify({
      id: textureInfo.profileId,
      name: profile.name,
      properties: [
        { name: 'uploadableTextures', value: 'skin,cape' },
        { name: 'textures', value: textureString },
      ],
    })
  }

  app.protocol.registerHandler('http', async ({ request, response, handle }) => {
    if (request.url.host !== 'localhost' || !request.url.pathname.startsWith('/yggdrasil')) return
    if (response.status) return

    const pathname = request.url.pathname.substring('/yggdrasil'.length) || ''
    logger.log(`Process ${request.url.toString()}`)

    if (pathname === '/' || pathname === '') {
      response.status = 200
      response.headers['content-type'] = 'application/json'
      response.body = JSON.stringify({
        meta: {
          implementationName: 'disco-offline-server',
          implementationVersion: '0.0.1',
          serverName: 'Disco Offline Server',
        },
        skinDomains: ['localhost'],
      })
    } else if (pathname === '/sessionserver/session/minecraft/join' && request.method === 'POST') {
      if (request.body instanceof Readable) {
        request.body.resume()
        await finished(request.body)
      }
      response.status = 240
    } else if (pathname.startsWith('/sessionserver/session/minecraft/hasJoined') && request.method === 'GET') {
      const username = request.url.searchParams.get('username') || ''
      try {
        const payload = await queryProfile(username)
        if (payload) {
          response.status = 200
          response.headers['content-type'] = 'application/json'
          response.body = payload
        } else {
          response.status = 204
        }
      } catch {
        response.status = 204
      }
    } else if (pathname.startsWith('/sessionserver/session/minecraft/profile/')) {
      const uuid = pathname.substring(pathname.lastIndexOf('/') + 1)
      try {
        const payload = await queryProfile(uuid)
        if (payload) {
          response.status = 200
          response.headers['content-type'] = 'application/json'
          response.body = payload
        } else {
          response.status = 204
        }
      } catch {
        response.status = 204
      }
    } else if (pathname.startsWith('/textures')) {
      const target = request.url.searchParams.get('href')
      if (!target) {
        response.status = 400
      } else {
        // Delegate the texture fetch to the remaining protocol handlers
        // (launcher media handler for closet images, common proxy for remote).
        await handle({
          request: {
            headers: request.headers,
            body: request.body,
            method: request.method,
            url: new URL(target),
          },
          response,
          handle,
        })
      }
    } else {
      response.status = 404
    }
  })
}
