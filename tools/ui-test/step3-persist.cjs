/* Sayfayı tazele → /me → gardırop aç → placeholder mı canvas mı izle */
const path = require('path')
const fs = require('fs')
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
  await send(ws, 'Page.reload')
  await sleep(10000)
  // /me zaten aktif hash (reload öncesi /me'deydi)
  let mounted = false
  for (let i = 0; i < 12; i++) {
    await sleep(1000)
    if (await ev(`!!document.querySelector('.me-profile-panel')`)) { mounted = true; break }
  }
  if (!mounted) { console.log('PANEL STILL NOT MOUNTED'); ws.close(); process.exit(1) }
  console.log('panel mounted')
  await sleep(2000)
  await ev(`(() => { const p = document.querySelector('.me-profile-panel'); const b = [...p.querySelectorAll('button')].find(x => /gardırop/i.test(x.innerText)); if (b) b.click(); return 1 })()`)
  let last = null
  for (let i = 0; i < 6; i++) {
    await sleep(2500)
    last = await ev(`(() => {
      const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
      const ovs = [...document.querySelectorAll('.v-overlay')]
      const dlg = ovs.find(o => norm(o.innerText || '').includes('gardırop'))
      if (!dlg) return { open: false }
      return { open: true, canvas: dlg.querySelectorAll('canvas').length, placeholder: norm(dlg.innerText).includes('onizlemesi yok') }
    })()`)
    console.log(`probe ${i}:`, JSON.stringify(last))
    if (last.open && last.canvas > 0) break
  }
  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '25-step3-after.png'), Buffer.from(shot.data, 'base64'))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
