/* Service köprüsünden LocalSkinService.getState probe (kısa timeout ile) */
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('to ' + method)) } }, 25000)
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
  const evWithTimeout = async (expression, ms) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: ms })
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }
  await evWithTimeout(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`, 10000)
  await sleep(2500)

  const probe = await Promise.race([
    evWithTimeout(`(async () => {
      const ch = window.serviceChannels.open('LocalSkinService')
      const st = await Promise.race([ch.call('getState'), new Promise((_, rej) => setTimeout(() => rej(new Error('svc timeout')), 6000))])
      return { skins: st.skins.length, equipped: Object.keys(st.equippedSkinIds || {}).length }
    })()`, 9000),
    sleep(9500).then(() => 'HUNG'),
  ])
  console.log('SERVICE PROBE:', JSON.stringify(probe))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
