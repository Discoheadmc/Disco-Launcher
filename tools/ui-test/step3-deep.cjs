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
  const ev = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }
  await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  await sleep(3000)
  // gardırop aç
  await ev(`(() => { const p = document.querySelector('.me-profile-panel'); const b = [...p.querySelectorAll('button')].find(x => /gardırop/i.test(x.innerText)); b.click(); return 1 })()`)
  await sleep(3000)
  // Canlı: overlay içi canvas + profile textures state
  const deep = await ev(`(() => {
    const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const ovs = [...document.querySelectorAll('.v-overlay--active, [role=dialog], .v-overlay')]
    const d = ovs.find(o => norm(o.innerText || '').includes('gardırop') || norm(o.innerText || '').includes('cilt'))
    const info = { overlayCount: ovs.length, dlgFound: !!d }
    if (d) {
      info.canvas = d.querySelectorAll('canvas').length
      info.hasPlaceholder = norm(d.innerText).includes('onizlemesi yok') || norm(d.innerText).includes('önizlemesi yok')
      // tüm canvas'lar document'te nerede?
      info.docCanvases = document.querySelectorAll('canvas').length
      // v-dialog aktif mi (display:none değil)?
      info.dlgVisible = d.offsetParent !== null || getComputedStyle(d).display !== 'none'
    }
    return info
  })()`)
  console.log('DEEP:', JSON.stringify(deep, null, 2))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
