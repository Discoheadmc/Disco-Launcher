/* README ekran görüntüleri: Home / Görünüm(picker açık) / Mağaza → docs/images/*.png */
const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const PORT = parseInt(process.env.CDP_PORT || '9777', 10)
const OUT = path.join(__dirname, '..', '..', 'docs', 'images')
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
  fs.mkdirSync(OUT, { recursive: true })
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
  const shot = async (name) => {
    const r = await send(ws, 'Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'))
    console.log('OK', name)
  }
  const nav = async (route) => {
    await evaluate(`(() => {
      const app = document.querySelector('#app').__vue_app__
      const router = app && app.config.globalProperties.$router
      if (router) { router.push(${JSON.stringify(route)}); return 'router' }
      location.hash = ${JSON.stringify('#' + route)}
      return 'hash'
    })()`)
    await sleep(2500)
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
  await sleep(800)

  // 1) Home
  await nav('/')
  await sleep(1500)
  await shot('home.png')

  // 2) Görünüm — tema renkleri, Başlat butonu seçicisi açık
  await nav('/setting')
  const row = await evaluate(`(() => {
    const row = document.querySelector('.color-theme-row')
    if (!row) return 'no-row'
    row.scrollIntoView({ block: 'center' })
    const d = [...document.querySelectorAll('.color-theme-row .color-button')]
    return d.length
  })()`)
  console.log('color row:', row)
  await sleep(800)
  await evaluate(`(() => {
    const d = [...document.querySelectorAll('.color-theme-row .color-button')]
    if (d[7]) d[7].click()
    return true
  })()`)
  await sleep(1800)
  await shot('appearance.png')
  await evaluate(`(() => { document.body.click(); return true })()`)
  await sleep(500)

  // 3) Mağaza
  await nav('/store')
  await sleep(1500)
  await shot('store.png')

  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
