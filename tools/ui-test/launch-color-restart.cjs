/* Restart kalıcılık: theme.json'daki launchButtonColor uygulama açılışında butona uygulanmalı */
const http = require('http')
const path = require('path')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const PORT = parseInt(process.env.CDP_PORT || '9777', 10)
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout')) } }, 20000)
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
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 300))
    return r.result.value
  }
  await send(ws, 'Runtime.enable')
  await sleep(1000)
  // Panel Home'a özel; router Home'a yönlendir ve butonun gelmesini bekle
  await evaluate(`(() => {
    try {
      const app = document.querySelector('#app').__vue_app__
      const router = app && app.config.globalProperties.$router
      if (router) { router.push('/'); return 'router' }
    } catch (e) { /* fallthrough */ }
    location.hash = '#/'
    return 'hash'
  })()`)
  let bg = 'NO-BUTTON'
  for (let i = 0; i < 20; i++) {
    await sleep(600)
    bg = await evaluate(`(() => {
      const b = document.querySelector('.instance-actions-panel .action-btn--primary')
      return b ? getComputedStyle(b).backgroundColor : 'NO-BUTTON'
    })()`)
    if (bg !== 'NO-BUTTON') break
  }
  console.log('ACILIS-DURUMU: bg=' + bg)
  const expected = process.env.EXPECTED_RGB || 'rgb(200, 85, 85)'
  process.exit(bg === expected ? 0 : 1)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
