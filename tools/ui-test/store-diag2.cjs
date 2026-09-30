/* Route + store DOM kontrolü */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
let id = 0
const pending = new Map()
function send (ws, method, params = {}) {
  const msg = { id: ++id, method, params }
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject })
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('to ' + method)) } }, 30000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function getJson (url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.on('error', reject)
  })
}
async function main () {
  const targets = await getJson('http://127.0.0.1:9777/json/list')
  const page = targets.find((t) => t.type === 'page' && t.url.includes('disco.runtime'))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.on('open', r))
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p.reject(new Error(msg.error.message))
      else p.resolve(msg.result)
    }
  })
  const ev = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }
  const out = await ev(`(() => {
    const app = document.querySelector('#app')
    const router = app && app.__vue_app__ ? app.__vue_app__.config.globalProperties.$router : null
    return {
      hash: location.hash,
      hasStoreContent: !!document.getElementById('store-content'),
      hasSearch: !!document.getElementById('store-search'),
      bodyClasses: document.body.className.slice(0, 80),
      appChildCount: app ? app.children.length : 0,
      routeMatched: router ? router.currentRoute.value.fullPath : 'no-router',
      dataTestids: [...document.querySelectorAll('[data-testid]')].slice(0, 12).map(e => e.getAttribute('data-testid'))
    }
  })()`)
  console.log(JSON.stringify(out, null, 2))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
