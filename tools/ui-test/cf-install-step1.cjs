/* CF kurulum keşif turu: SkyCreblock ara → projeye gir → butonları dump et */
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 25000)
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
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 200))
    return r.result.value
  }
  const push = (route) => evaluate(`(async () => {
    const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router
    await router.push('${route}').catch(() => {})
    return router.currentRoute.value.fullPath
  })()`)
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await sleep(2500)

  // doğrudan CF proje sayfasına git: hash + reload (bilinen güvenilir yol)
  await evaluate(`(() => { location.hash = '#/store/curseforge/899973'; return location.hash })()`)
  await send(ws, 'Page.reload')
  await sleep(5000)
  let ready = false
  for (let i = 0; i < 25 && !ready; i++) {
    ready = await evaluate(`(() => { try { return document.body.innerText.includes('SkyCreblock') } catch { return false } })()`)
    if (!ready) await sleep(800)
  }
  await sleep(2500)
  const detail = await evaluate(`(() => {
    const t = document.body.innerText.split(String.fromCharCode(10)).join(' | ')
    return {
      hash: location.hash,
      hasName: t.includes('SkyCreblock'),
      buttons: [...document.querySelectorAll('button')].map(b => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(x => x && x.length < 30).slice(0, 30),
      head: t.slice(0, 700)
    }
  })()`)
  console.log('DETAIL:', JSON.stringify(detail))
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
