/* _context.provides üzerinden modül-seviyesi store'u ve provides zincirini oku.
   Alternatif: renderer tarafında global bir sınama kancası ekleyemeyiz (prod);
   ama provides config.globalProperties ile aynı — bileşen ağacına ihtiyaç yok. */
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
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }

  // Strateji: DOM tabanlı doğrulama. Diyalog placeholder'dan canvas'a geçti mi?
  // + Panel CustomCapeDialog canvas'ı (adım 2'de çalıştı) → benzer yapı closet'ta da çalışmalı.
  // Önce diyalogu aç, 8sn bekle ( suspense fetch ), sonra canvas/placeholder kontrol et.
  await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  await sleep(3000)
  await ev(`(() => { const p = document.querySelector('.me-profile-panel'); const b = [...p.querySelectorAll('button')].find(x => /gardırop/i.test(x.innerText)); if (b) b.click(); return 1 })()`)
  for (const ms of [2000, 5000, 8000]) {
    await sleep(ms === 2000 ? 2000 : 3000)
    const snap = await ev(`(() => {
      const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
      const ovs = [...document.querySelectorAll('.v-overlay')]
      const dlg = ovs.find(o => norm(o.innerText || '').includes('gardırop'))
      if (!dlg) return { open: false }
      return {
        open: true,
        canvas: dlg.querySelectorAll('canvas').length,
        placeholder: norm(dlg.innerText).includes('onizlemesi yok')
      }
    })()`)
    console.log(`t+${ms}s:`, JSON.stringify(snap))
    if (snap.open && snap.canvas > 0) break
  }

  // panel — me-profile-panel canvas'ı hâlâ render ediyor mu (özel pelerin watch'ı bozmadı mı)?
  const panelCanvas = await ev(`(() => {
    const p = document.querySelector('.me-profile-panel')
    return { canvas: p ? p.querySelectorAll('canvas').length : -1 }
  })()`)
  console.log('PANEL canvas:', JSON.stringify(panelCanvas))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
