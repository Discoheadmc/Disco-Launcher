import { LocalCapeService as ILocalCapeService, LocalCapeServiceKey, LocalCapeState, SetLocalCapeOptions } from '@xmcl/runtime-api'
import { writeFile as writeAtomically } from 'atomically'
import { copyFile, ensureDir, remove, writeFile } from 'fs-extra'
import { createReadStream, existsSync } from 'fs'
import { isAbsolute, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'

const LOCAL_CAPE_LOCK = 'local-cape-service'

/**
 * Stores a launcher-only "custom cape" PNG per account key
 * (`userId:gameProfileId`). This is completely independent from Mojang's
 * official cape system: no network request is ever made to Mojang, the file
 * lives in the launcher's closet directory, and it is only consumed by this
 * launcher's own renderers (and any in-game display path we ship ourselves).
 */
@ExposeServiceKey(LocalCapeServiceKey)
export class LocalCapeService extends AbstractService implements ILocalCapeService {
  private readonly closetPath: string
  private readonly statePath: string
  private state: LocalCapeState = { capes: {} }

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
  ) {
    super(app, async () => {
      await ensureDir(this.closetPath)
      this.state = await this.loadState()
      // Serve capes over the launcher's local HTTP server as soon as this
      // service exists (the service is created lazily, so this cannot be
      // done at plugin bootstrap time).
      this.registerProtocolHandler()
    })
    this.closetPath = this.getAppDataPath('closet')
    this.statePath = join(this.closetPath, 'capes.json')
  }

  private async loadState(): Promise<LocalCapeState> {
    try {
      const { readFile } = await import('fs-extra')
      const parsed = JSON.parse(await readFile(this.statePath, 'utf-8')) as Partial<LocalCapeState>
      return {
        capes: parsed.capes && typeof parsed.capes === 'object' ? parsed.capes : {},
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.warn(`Fail to load ${this.statePath}`)
        this.warn(e as Error)
      }
      return { capes: {} }
    }
  }

  private async saveState() {
    await writeAtomically(this.statePath, JSON.stringify(this.state, null, 2))
  }

  private getLocalSource(source: string): string | undefined {
    if (source.startsWith('file:')) {
      return fileURLToPath(source)
    }
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const url = new URL(source)
      if (url.host === 'launcher' && url.pathname === '/media') {
        return url.searchParams.get('path') || undefined
      }
      return undefined
    }
    return source
  }

  private getMediaUrl(path: string) {
    const url = new URL('http://launcher/media')
    url.searchParams.set('path', path)
    return url.toString()
  }

  private async persistSource(source: string, target: string) {
    const localSource = this.getLocalSource(source)
    if (localSource) {
      const { fileTypeFromFile } = await import('file-type')
      const fileType = await fileTypeFromFile(localSource)
      if (fileType?.mime !== 'image/png') {
        throw new Error('The local cape must be a PNG image')
      }
      await copyFile(localSource, target)
      return
    }

    const response = await this.app.fetch(source)
    if (!response.ok) {
      throw new Error(`Cannot download cape from ${source}`)
    }
    const content = Buffer.from(await response.arrayBuffer())
    const { fileTypeFromBuffer } = await import('file-type')
    const fileType = await fileTypeFromBuffer(content)
    if (fileType?.mime !== 'image/png') {
      throw new Error('The remote cape must be a PNG image')
    }
    await writeFile(target, content)
  }

  async getState(): Promise<LocalCapeState> {
    await this.initialize()
    return structuredClone(this.state)
  }

  /** Non-exposed helper for main-process launch hooks. */
  async hasCape(account: string): Promise<boolean> {
    await this.initialize()
    return Boolean(this.state.capes[account])
  }

  async setCape(options: SetLocalCapeOptions): Promise<string> {
    await this.initialize()
    if (!options?.account) throw new Error('Account key is required to set a custom cape')
    return this.mutex.of(LOCAL_CAPE_LOCK).runExclusive(async () => {
      const target = join(this.closetPath, `cape-${Buffer.from(options.account).toString('base64url')}.png`)
      await this.persistSource(options.source, target)
      const url = this.getMediaUrl(target)
      const original = this.state.capes[options.account]
      this.state.capes[options.account] = url
      try {
        await this.saveState()
      } catch (e) {
        if (original) this.state.capes[options.account] = original
        else delete this.state.capes[options.account]
        await remove(target).catch(() => undefined)
        throw e
      }
      return url
    })
  }

  async removeCape(account: string): Promise<void> {
    await this.initialize()
    await this.mutex.of(LOCAL_CAPE_LOCK).runExclusive(async () => {
      const url = this.state.capes[account]
      if (!url) return
      delete this.state.capes[account]
      try {
        await this.saveState()
      } catch (e) {
        this.state.capes[account] = url
        throw e
      }
      const localSource = this.getLocalSource(url)
      const relativePath = localSource ? relative(this.closetPath, localSource) : undefined
      if (localSource && relativePath && !relativePath.startsWith('..') && !isAbsolute(relativePath)) {
        await remove(localSource).catch(() => undefined)
      }
    })
  }

  /**
   * Serve a cape texture over the launcher's local HTTP server so the game
   * (or a client-side skin mod) can fetch it in-process: no Mojang request
   * is involved and the file never leaves the machine unless the local
   * server serves it to the local game.
   */
  /**
   * Registers the `/disco/cape` route so both request paths reach it:
   *
   * - The game (and any local process) hits the launcher's Node HTTP server
   *   at `http://localhost:<port>/disco/cape`. That server re-bases every
   *   request to `xmcl://launcher<path>` (`LauncherApp.createServer`), so the
   *   route must be registered under the `xmcl` protocol with host
   *   `launcher`.
   * - Browser/renderer requests go through the Electron session bridge as
   *   real `http://localhost:<port>/...` URLs, hence the `http` registration
   *   matching any localhost port.
   *
   * Idempotent: the service initializer runs at most once per instance.
   */
  registerProtocolHandler() {
    const serveCape = async ({ request, response }: { request: { url: URL }; response: { status?: number; headers: Record<string, any>; body?: unknown } }) => {
      const account = request.url.searchParams.get('account')
      if (!account) {
        response.status = 400
        return
      }
      try {
        await this.initialize()
        const url = this.state.capes[account]
        if (!url) {
          response.status = 404
          return
        }
        const localSource = this.getLocalSource(url)
        if (!localSource || !existsSync(localSource)) {
          response.status = 404
          return
        }
        response.status = 200
        response.headers = { 'content-type': 'image/png' }
        response.body = createReadStream(localSource)
      } catch (e) {
        this.warn('Failed to serve local cape')
        this.warn(e as Error)
        response.status = 500
      }
    }

    this.app.protocol.registerHandler('xmcl', async ({ request, response }) => {
      if (request.url.host !== 'launcher' || request.url.pathname !== '/disco/cape') return
      await serveCape({ request, response })
    })
    this.app.protocol.registerHandler('http', async ({ request, response }) => {
      if (!request.url.host.startsWith('localhost') || request.url.pathname !== '/disco/cape') return
      await serveCape({ request, response })
    })
  }
}
