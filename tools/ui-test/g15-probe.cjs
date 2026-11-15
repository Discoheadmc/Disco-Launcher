/* Probe: router erişim yolları */
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout')) } }, 30000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`)
  const page = targets.find((t) => t.type === 'page' && t.url.includes('disco.runtime'))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.on('open', r))
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id)
      if (msg.error) p.reject(new Error(msg.error.message)); else p.resolve(msg.result)
    }
  })
  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) return 'ERR: ' + JSON.stringify(r.exceptionDetails).slice(0, 200)
    return r.result.value
  }
  await send(ws, 'Runtime.enable')
  const probe = await evaluate(`JSON.stringify({
    hash: location.hash,
    winRouter: typeof window.$router,
    appVueApp: !!document.querySelector('#app')?.__vue_app__,
    appRouter: (() => { try { return !!document.querySelector('#app').__vue_app__.config.globalProperties.$router } catch (e) { return 'err:' + e.message } })(),
    allApps: document.querySelectorAll('#app, [data-v-app]').length
  })`)
  console.log('PROBE:', probe)
  // window.$router ile push dene
  const r1 = await evaluate(`(async () => {
    if (!window.$router) return 'no window.$router'
    await window.$router.push('/setting').catch(e => 'push-err:' + e.message)
    return window.$router.currentRoute.value.fullPath
  })()`)
  console.log('PUSH window.$router:', r1)
  await sleep(2500)
  const h = await evaluate('location.hash')
  console.log('HASH NOW:', h)
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
