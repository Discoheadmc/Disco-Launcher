/* Görev 1 teşhis: Store sayfasında latest-Minecraft bölümü + boş alan durumunu ölç */
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
async function waitCdp (maxSec = 60) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxSec * 1000) {
    try { return await getJson('http://127.0.0.1:9777/json/list') } catch { await sleep(2000) }
  }
  throw new Error('CDP unreachable')
}
async function main () {
  const targets = await waitCdp()
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
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }
  await send(ws, 'Page.enable')
  await sleep(5000)

  // /store'a git (hidrasyon tamamlanmadan yapılan push kaybolabilir → retry)
  for (let i = 0; i < 6; i++) {
    await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/store').catch(() => {})`)
    await sleep(2000)
    const route = await ev(`location.hash`)
    if (route.includes('store')) break
  }
  await sleep(4000)

  const state = await ev(`(() => {
    const content = document.getElementById('store-content')
    const sections = content ? content.querySelectorAll(':scope > section') : []
    const sec0 = sections[0]
    const sec1 = sections[1]
    const h2 = sec0 ? sec0.querySelector('h2') : null
    const cards0 = sec0 ? sec0.querySelectorAll('.v-card, a, [role=button]').length : 0
    const rect0 = sec0 ? sec0.getBoundingClientRect() : null
    const rect1 = sec1 ? sec1.getBoundingClientRect() : null
    // section yükseklikleri vs içerdikleri kart alanı
    const grid0 = sec0 ? sec0.querySelector('[role=group]') : null
    const gridRect0 = grid0 ? grid0.getBoundingClientRect() : null
    return {
      sectionCount: sections.length,
      sec0Exists: !!sec0,
      sec0Height: rect0 ? Math.round(rect0.height) : 0,
      sec0GridHeight: gridRect0 ? Math.round(gridRect0.height) : 0,
      sec0Heading: h2 ? h2.innerText.trim().replace(/\\n/g, ' ') : (sec0.querySelector('.latest-bar__text') || {}).innerText || '',
      sec0Cards: cards0,
      sec1Height: rect1 ? Math.round(rect1.height) : 0,
      sec1MinHeight: sec1 ? getComputedStyle(sec1).minHeight : '',
      discoverCards: sec1 ? sec1.querySelectorAll('img').length : 0,
      viewportH: window.innerHeight
    }
  })()`)
  console.log(JSON.stringify(state, null, 2))

  const fs = require('fs')
  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '50-store-before.png'), Buffer.from(shot.data, 'base64'))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
