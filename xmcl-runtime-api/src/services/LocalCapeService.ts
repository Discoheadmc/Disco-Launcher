import { ServiceKey } from './Service'

export interface LocalCapeState {
  /** accountKey (`userId:gameProfileId`) -> http://launcher/media URL of the cape png */
  capes: Record<string, string>
}

export interface SetLocalCapeOptions {
  account: string
  /** A local file path, `http://launcher/media?path=...` url or remote url */
  source: string
}

export interface LocalCapeService {
  getState(): Promise<LocalCapeState>
  setCape(options: SetLocalCapeOptions): Promise<string>
  removeCape(account: string): Promise<void>
}

export const LocalCapeServiceKey: ServiceKey<LocalCapeService> = 'LocalCapeService'
