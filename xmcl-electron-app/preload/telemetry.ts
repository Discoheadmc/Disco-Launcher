import type { RendererTelemetryChannel } from '@xmcl/runtime-api'
import { contextBridge } from 'electron'

// Disco Launcher: telemetry is disabled. Expose no-op implementations so the
// renderer keeps working without the main-process telemetry handlers.
const telemetry: RendererTelemetryChannel = {
  trackException() {
    return Promise.resolve()
  },
  flush() {
    return Promise.resolve()
  },
  startAction() {
    return Promise.resolve(undefined)
  },
  endAction() {
    return Promise.resolve(false)
  },
}

contextBridge.exposeInMainWorld('rendererTelemetry', telemetry)
