/* README ekran görüntülerini tazele: home / appearance (picker açık) / store (grid yüklü) */
const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const PORT = parseInt(process.env.CDP_PORT || '9777', 10)
const OUT = 'C:/Projeler/Discock/Github/Disco-Launcher/docs/images'
let id = 0
const pending = new Map()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 250))
    return r.result.value
  }
  const nav = async (route) => {
    await evaluate(`(() => {
      const app = document.querySelector('#app').__vue_app__
      const router = app && app.config.globalProperties.$router
      if (router) { router.push(${JSON.stringify(route)}); return 'router' }
      location.hash = ${JSON.stringify('#' + route)}
      return 'hash'
    })()`)
  }
  const waitSel = async (sel, ms) => {
    const deadline = Date.now() + ms
    while (Date.now() < deadline) {
      if (await evaluate(`!!document.querySelector('${sel}')`)) return true
      await sleep(500)
    }
    return false
  }
  const shot = async (name) => {
    const r = await send(ws, 'Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'))
    console.log('OK', name)
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
  await sleep(800)

  // 1) Home
  await nav('/')
  if (await waitSel('.instance-actions-panel', 15000)) {
    await sleep(1500)
    await shot('home.png')
  } else { console.log('HOME panel gelmedi') }

  // 2) Appearance + picker açık
  await nav('/setting')
  if (await waitSel('.color-theme-row', 15000)) {
    await sleep(600)
    await evaluate(`(() => { const r = document.querySelector('.color-theme-row'); r.scrollIntoView({ block: 'center' }); return true })()`)
    await sleep(800)
    await evaluate(`(() => { const d = [...document.querySelectorAll('.color-theme-row .color-button')]; if (d[7]) d[7].click(); return true })()`)
    await sleep(2200)
    await shot('appearance.png')
    await evaluate(`(() => { document.body.click(); return true })()`)
    await sleep(500)
  } else { console.log('SETTING color-row gelmedi') }

  // 3) Store — kart grid'ini bekle
  await nav('/store')
  if (await waitSel('.store-entry', 15000)) {
    let cards = 0
    for (let i = 0; i < 20; i++) {
      await sleep(1500)
      cards = await evaluate(`document.querySelectorAll('.store-entry img').length`)
      if (cards >= 8) break
    }
    console.log('store img cards:', cards)
    await sleep(1500)
    await shot('store.png')
  } else { console.log('STORE gelmedi') }

  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
