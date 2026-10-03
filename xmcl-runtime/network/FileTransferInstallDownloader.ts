import {
  downloadMultiple,
  type DownloadBaseOptions,
  type DownloadController,
} from '@xmcl/file-transfer'
import type { InstallFileDownloader } from '~/install/InstallManifestService'

export function createFileTransferInstallDownloader(
  options: DownloadBaseOptions,
  adaptiveController?: DownloadController,
): InstallFileDownloader {
  // B3: Module-level in-flight dedup map — prevents the same file being
  // downloaded twice concurrently (e.g. dependency collision in modpacks).
  // Once the promise settles it self-evicts via the finally() in getOrCreate.
  const inFlightDownloads = new Map<string, Promise<void>>()

  return {
    async download(files, context = {}) {
      const uniqueFiles = files.filter((file) => {
        const key = file.path
        if (inFlightDownloads.has(key)) return false
        return true
      })
      if (uniqueFiles.length === 0) return

      const downloadTask = downloadMultiple({
        options: uniqueFiles.map((file) => {
          const isBmcl = file.urls.some((url) => {
            try {
              return new URL(url).hostname === 'bmclapi2.bangbang93.com'
            } catch { return false }
          })
          return {
            url: file.urls,
            destination: file.path,
            expectedTotal: file.size,
            controller: adaptiveController, // 🟢 B3+D1: her host'ta adaptive controller
          }
        }),
        ...options,
        signal: context.signal,
        tracker: context.tracker,
      })

      // Register in-flight keys before awaiting so concurrent callers dedup
      for (const file of uniqueFiles) {
        const key = file.path
        const wrappedPromise = downloadTask.then(() => undefined, () => undefined) as Promise<void>
        inFlightDownloads.set(key, wrappedPromise)
      }

      try {
        const results = await downloadTask
        const failures = results.flatMap((result, index) => {
          if (result.status !== 'rejected') return []
          const file = uniqueFiles[index]
          const reason = result.reason
          const message = reason instanceof Error ? reason.message : String(reason)
          const error = new Error(`Failed to download ${file.path}: ${message}`, {
            cause: reason,
          })
          error.name = 'InstallFileDownloadError'
          Object.assign(error, {
            path: file.path,
            urls: file.urls,
            code: reason && typeof reason === 'object' && 'code' in reason ? reason.code : undefined,
          })
          return [error]
        })
        if (failures.length > 0) throw new AggregateError(failures)
      } finally {
        for (const file of uniqueFiles) inFlightDownloads.delete(file.path)
      }
    },
  }
}
