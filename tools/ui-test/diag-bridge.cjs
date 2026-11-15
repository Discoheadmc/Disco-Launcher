/* Minimal: does serviceChannels.call resolve at all? */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 20000)
  })
}
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
    if (r.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }
  await send(ws, 'Runtime.enable')

  console.log('open channel:', await evaluate(`(() => { window.__c = window.serviceChannels.open('LocalSkinService'); return 'opened' })()`))
  console.log('call getState (10s race):', await evaluate(`Promise.race([
    window.__c.call('getState').then(r => JSON.stringify(r).slice(0, 150)),
    new Promise(res => setTimeout(() => res('HUNG after 10s'), 10000))
  ])`))
  console.log('call getState again:', await evaluate(`Promise.race([
    window.__c.call('getState').then(r => 'ok skins=' + r.skins.length),
    new Promise(res => setTimeout(() => res('HUNG'), 10000))
  ])`))
  ws.close()
  process.exit(0)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
