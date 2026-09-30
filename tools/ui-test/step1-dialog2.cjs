/* Dialog açılışını norm-aware kontrol et + ekran görüntüsü */
const fs = require('fs')
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('to ' + method)) } }, 20000)
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
  const ev = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 250))
    return r.result.value
  }
  await send(ws, 'Page.enable')
  await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  await sleep(2500)
  // özel pelerin butonuna tıkla
  await ev(`(() => { const p = document.querySelector('.me-profile-panel'); const th = [...p.querySelectorAll('.cape-thumb')]; th[th.length - 1].click(); return 'ok' })()`)
  await sleep(1500)
  const out = await ev(`(() => {
    const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
    const ovs = [...document.querySelectorAll('.v-overlay--active, [role=dialog]')]
    const dlg = ovs.find(o => norm(o.innerText || '').includes('ozel pelerin'))
    return {
      overlays: ovs.length,
      open: !!dlg,
      text: dlg ? dlg.innerText.slice(0, 220) : null,
      buttons: dlg ? [...dlg.querySelectorAll('button')].map(b => b.innerText.trim() || b.getAttribute('aria-label')) : []
    }
  })()`)
  console.log(JSON.stringify(out, null, 2))
  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '21-step1-dialog.png'), Buffer.from(shot.data, 'base64'))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
