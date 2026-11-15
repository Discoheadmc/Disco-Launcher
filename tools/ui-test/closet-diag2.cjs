/* Diag2: verify the mock reaches the renderer's windowController binding. */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const fs = require('fs')
const PORT = 9777
let id = 0
const pending = new Map()
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', (c) => { d += c }); res.on('end', () => resolve(JSON.parse(d))) }).on('error', reject)
  })
}
function send(ws, method, params = {}) {
  const msg = { id: ++id, method, params }
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject })
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 25000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`)
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.on('open', r))
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
    }
  })
  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) return 'EVAL-ERR: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)
    return r.result.value
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')

  // inspect what windowController is in the page
  const inspect = await evaluate(`(() => {
    const wc = window.windowController
    return {
      exists: !!wc,
      hasShowOpen: !!(wc && wc.showOpenDialog),
      ownProps: wc ? Object.keys(wc).slice(0, 10) : [],
      ctorName: wc ? wc.constructor.name : ''
    }
  })()`)
  console.log('windowController in page:', JSON.stringify(inspect))

  // try patching + verify
  const patch = await evaluate(`(() => {
    const before = windowController.showOpenDialog
    windowController.showOpenDialog = async () => { window.__mockCalled = true; return { canceled: false, filePaths: ['C:/test.png'] } }
    const after = windowController.showOpenDialog
    return { changed: before !== after, sameRef: before === after }
  })()`)
  console.log('patch result:', JSON.stringify(patch))

  // The problem: contextBridge exposes a read-only frozen object. Vue components
  // destructure at setup: const { showOpenDialog } = windowController — they keep
  // a reference to the ORIGINAL function. Patching the property may fail silently
  // (frozen) or not affect already-captured refs. Report both.
  const frozen = await evaluate(`(() => { const d = Object.getOwnPropertyDescriptor(windowController, 'showOpenDialog'); return { writable: d ? d.writable : 'n/a', configurable: d ? d.configurable : 'n/a', frozen: Object.isFrozen(windowController) } })()`)
  console.log('descriptor:', JSON.stringify(frozen))
  const mockCalled = await evaluate(`window.__mockCalled === true`)
  console.log('mock was invoked anywhere:', mockCalled)

  ws.close()
  process.exit(0)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
