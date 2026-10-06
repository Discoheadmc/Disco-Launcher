import { LocalStroageCache } from '@/util/localStorageCache'
import { IConfig } from 'swrv'
import { InjectionKey } from 'vue'

export const kSWRVConfig: InjectionKey<ReturnType<typeof useSWRVConfig>> = Symbol('swrvConfig')

/**
 * D4: How long a market (Modrinth/CurseForge) search result page stays
 * fresh before a background revalidation is triggered.
 *
 * The old value was 30s, which meant navigating away from the store and
 * back re-fetched every page. 5 minutes keeps the catalogue snappy while
 * still picking up newly-published projects on a normal browse session.
 * The user can always force a refresh via the store's refresh button
 * (`mutate`), which bypasses this TTL.
 */
export const MARKET_CACHE_TTL_MS = 5 * 60 * 1000

export function useSWRVConfig() {
  return {
    cache: new LocalStroageCache('/cache'),
    shouldRetryOnError: true,
    revalidateOnFocus: false,
    revalidateDebounce: 1500,
    errorRetryInterval: 5000,
    errorRetryCount: 5,
    dedupingInterval: 1000 * 60 * 10,
    ttl: 1000 * 60 * 60 * 24,
  }
}

export function useOverrideSWRVConfig(override: IConfig): IConfig {
  const config = inject(kSWRVConfig)
  if (config) {
    return {
      ...config,
      ...override,
    }
  }
  return override
}
