/* Picker konum doğrulaması: menü topacın ALTINDA mı? */
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
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 150))
    return r.result.value
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')

  // ayarlara git
  await evaluate(`(() => { if (!location.hash.includes('/setting')) location.hash = '#/setting'; return location.hash })()`)
  await send(ws, 'Page.reload')
  await sleep(6000)

  // renk satırını bekle
  for (let i = 0; i < 15; i++) {
    const ok = await evaluate(`document.querySelectorAll('.color-theme-row .color-button').length >= 7`)
    if (ok) break
    await sleep(700)
  }

  // primary topacına tıkla
  await evaluate(`(() => { const d = [...document.querySelectorAll('.color-theme-row .color-button')]; d[2].click(); return true })()`)
  await sleep(2000)

  // geometri ölç
  const geo = await evaluate(`(() => {
    const dot = document.querySelectorAll('.color-theme-row .color-button')[2]
    const ov = [...document.querySelectorAll('.v-overlay--active')].find(o => o.getBoundingClientRect().height > 30)
    if (!dot || !ov) return { error: 'not-open' }
    const d = dot.getBoundingClientRect()
    const o = ov.getBoundingClientRect()
    return {
      dotBottom: Math.round(d.bottom),
      overlayTop: Math.round(o.top),
      below: o.top >= d.bottom - 2,
      fitsInViewport: o.bottom <= window.innerHeight + 2
    }
  })()`)
  console.log('GEOMETRY:', JSON.stringify(geo))
  console.log(geo.below && geo.fitsInViewport ? 'SONUÇ: PASS — menü topacın altında ve ekrana sığıyor' : 'SONUÇ: FAIL')
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
