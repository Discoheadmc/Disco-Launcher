/**
 * This file is used specifically and only for development. It installs
 * `electron-debug` & `vue-devtools`. There shouldn't be any need to
 *  modify this file, but it can be used to extend your development
 *  environment.
 */

// Set environment for development

/**
 * Prevent infinite EPIPE log loop: when a pipe/socket breaks (e.g. DevTools
 * WebSocket disconnects), Node's console.warn tries to write to the broken
 * pipe, gets EPIPE, logs that error, which tries to write again → infinite loop.
 * Wrap console.warn/error to detect EPIPE and suppress re-entry.
 */
const _originalWarn = console.warn.bind(console)
const _originalError = console.error.bind(console)
let _inEpipeHandler = false
function _isEpipe(err: any): boolean {
  return err && (err.code === 'EPIPE' || err.message?.includes?.('EPIPE') || err.message?.includes?.('broken pipe'))
}
console.warn = (...args: any[]) => {
  const epipe = args.some(_isEpipe)
  if (epipe && _inEpipeHandler) return
  if (epipe) {
    _inEpipeHandler = true
    try { _originalWarn('[suppressed EPIPE]', ...args.filter((a) => !_isEpipe(a))) } finally { _inEpipeHandler = false }
    return
  }
  _originalWarn(...args)
}
console.error = (...args: any[]) => {
  const epipe = args.some(_isEpipe)
  if (epipe && _inEpipeHandler) return
  if (epipe) {
    _inEpipeHandler = true
    try { _originalError('[suppressed EPIPE]', ...args.filter((a) => !_isEpipe(a))) } finally { _inEpipeHandler = false }
    return
  }
  _originalError(...args)
}

import { app, session } from 'electron'
import { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import { downloadChromeExtension } from 'electron-devtools-installer/dist/downloadChromeExtension'
import 'source-map-support/register'
import './index'

console.log(`Process id=${process.pid}`)

app.on('browser-window-created', (event, w) => {
  w.webContents.openDevTools({ mode: 'detach' })
})

app.on('web-contents-created', (event, contents) => {
  contents.on('update-target-url', (event, url) => {
    if (url.startsWith('http://localhost')) {
      contents.openDevTools({ mode: 'detach' })
    }
  })
})

app.whenReady().then(async () => {
  // Reimplement `electron-devtools-installer`'s install using the non-deprecated
  // `session.extensions` API. The published package still calls the deprecated
  // `session.getAllExtensions`/`session.loadExtension`, which prints trace warnings.
  try {
    const extensions = session.defaultSession.extensions
    const installed = extensions.getAllExtensions().find((e) => e.id === VUEJS_DEVTOOLS.id)
    if (installed) {
      console.log(`Vue devtool already loaded ${installed.name}`)
      return
    }
    const extensionFolder = await downloadChromeExtension(VUEJS_DEVTOOLS.id, {})
    const ext = await extensions.loadExtension(extensionFolder)
    console.log(`Installed vue devtool ${ext.name}`)
  } catch (e) {
    console.error('Fail to install vue devtool')
    console.error(e)
  }
})
