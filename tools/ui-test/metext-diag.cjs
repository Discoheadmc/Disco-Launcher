/* final-test ile aynı akış: reload -> /me -> meText içinde özel pelerin var mı? */
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 25000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main () {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9777/json/list', (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
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
  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 250))
    return r.result.value
  }
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false })
  await send(ws, 'Page.reload')
  await sleep(8000)
  await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  await sleep(1500)
  const meText = await evaluate(`document.body.innerText`)
  const norm = (s) => s.normalize('NFD').replace(/\u0307/g, '').toLowerCase()
  const n = norm(meText)
  console.log('len:', meText.length)
  console.log('includes özel pelerin (norm):', n.includes('özel pelerin'))
  console.log('includes değiştir (norm):', n.includes('değiştir'))
  console.log('includes png seç (norm):', n.includes('png seç'))
  const idx = n.indexOf('pelerin')
  console.log('context:', JSON.stringify(idx >= 0 ? meText.slice(Math.max(0, idx - 60), idx + 120) : 'NOT FOUND'))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
