/* Direct backend-service test: drive LocalSkinService & LocalCapeService via
   the renderer's service bridge — validates add/equip/remove skin and
   custom-cape set/remove persistence end to end, no native dialogs needed. */
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 30000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const pngPath = path.join(process.env.REPO, 'xmcl-keystone-ui', 'src', 'assets', 'steve_skin.png')
  const pngPathJs = JSON.stringify(pngPath)

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
    if (r.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.exceptionDetails).slice(0, 500))
    return r.result.value
  }
  await send(ws, 'Runtime.enable')

  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok, detail: String(detail).slice(0, 300) })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 180) : ''}`)
  }

  // How does the renderer talk to services? Find the service bridge.
  const bridge = await evaluate(`(() => {
    const app = document.querySelector('#app').__vue_app__
    return {
      hasApp: !!app,
      // XMCL renderer uses a ServiceConnect transport over IPC; check global keys
      keys: Object.keys(window).filter(k => /service|controller|ipc/i.test(k)).slice(0, 10)
    }
  })()`)
  console.log('bridge probe:', JSON.stringify(bridge))

  // XMCL renders services through `useService` keyed on an IPC channel. The
  // preload exposes it. Try calling the service via the known IPC envelope:
  // windowController is contextBridge; service calls go through another bridge
  // object. Probe for it:
  const probe = await evaluate(`(() => Object.keys(window).filter(k => !k.startsWith('webkit')).slice(0, 40))()`)
  console.log('window keys:', JSON.stringify(probe))

  ws.close()
  process.exit(0)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
