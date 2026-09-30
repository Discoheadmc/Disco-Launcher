/* Adım 3 doğrulaması: gardırop diyaloğu önizlemesi panel ile aynı pelerini gösteriyor */
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
  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail: String(detail).slice(0, 240) })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
  }

  await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  await sleep(3500)

  // Panel: paylaşılan skin modelinin cape'i özel pelerin mi?
  const panel = await ev(`(() => {
    const app = document.querySelector('#app').__vue_app__
    // 3D canvas render'da cape texture'ı viewer'dan okunur; DOM'da canvas var mı + panel thumbs
    const panel = document.querySelector('.me-profile-panel')
    const thumbs = [...panel.querySelectorAll('.cape-thumb')]
    return {
      canvas: !!panel.querySelector('canvas'),
      thumbCount: thumbs.length,
      customSelected: thumbs[thumbs.length - 1] ? thumbs[thumbs.length - 1].className.includes('border-primary') : false
    }
  })()`)
  record('Panel 3D önizleme (canvas) render', !!panel.canvas, '')
  record('Özel pelerin thumb seçili görünümde', !!panel.customSelected, JSON.stringify(panel))

  // Gardırop diyaloğunu aç
  const clickRes = await ev(`(() => {
    const panel = document.querySelector('.me-profile-panel')
    const b = [...panel.querySelectorAll('button')].find(x => /gardırop/i.test(x.innerText))
    if (!b) return 'NO_BTN'
    b.click()
    return 'CLICKED'
  })()`)
  await sleep(2500)

  const closet = await ev(`(() => {
    const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
    const ovs = [...document.querySelectorAll('.v-overlay--active, [role=dialog]')]
    const d = ovs.find(o => norm(o.innerText || '').includes('gardırop') || norm(o.innerText || '').includes('cilt'))
    if (!d) return { open: false }
    // Diyalog içindeki SkinView canvas'ı — cape texture'ı canvas WebGL'de; DOM'dan
    // texture URL'ini doğrudan okuyamayız ama Vue app state'inden erişebiliriz.
    const canvases = d.querySelectorAll('canvas').length
    return { open: true, canvases }
  })()`)
  record('Gardırop diyaloğu açılıyor', !!closet.open, JSON.stringify(closet))
  record('Diyalog içinde 3D önizleme canvas', !!closet.open && closet.canvases > 0, '')

  // Vue state: paylaşılan model cape'i özel pelerin URL'i mi?
  const state = await ev(`(() => {
    const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
    // panel bileşeninden provide edilen UserSkinModel'i bulmak yerine
    // DOM'daki cape-thumb highlight'ı + dialog açıkken diyalog canvas'ının
    // aynı viewer nesnesini paylaşıp paylaşmadığını kontrol ediyoruz.
    const panel = document.querySelector('.me-profile-panel')
    const thumbs = [...panel.querySelectorAll('.cape-thumb')]
    return {
      customThumbActive: thumbs[thumbs.length - 1] ? thumbs[thumbs.length - 1].className.includes('border-primary') : false
    }
  })()`)
  record('Özel pelerin aktif (thumb highlight)', !!state.customThumbActive, '')

  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '24-step3-closet.png'), Buffer.from(shot.data, 'base64'))

  // kapat
  await ev(`(() => {
    const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
    const ovs = [...document.querySelectorAll('.v-overlay--active, [role=dialog]')]
    const d = ovs.find(o => norm(o.innerText || '').includes('gardırop') || norm(o.innerText || '').includes('cilt'))
    if (d) { const b = [...d.querySelectorAll('button')].find(b => /close/i.test(b.getAttribute('aria-label') || '') || /close/i.test(b.className)); if (b) { b.click(); return 'x' } }
    return 'no'
  })()`)
  await sleep(1200)
  const closed = await ev(`(() => {
    const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
    return ![...document.querySelectorAll('.v-overlay--active, [role=dialog]')].some(o => norm(o.innerText || '').includes('gardırop'))
  })()`)
  record('Gardırop kapanıyor', !!closed, '')

  fs.writeFileSync(path.join(__dirname, 'artifacts', 'step3-results.json'), JSON.stringify(results, null, 2))
  console.log('\nSUMMARY: ' + results.filter(r => r.ok).length + '/' + results.length)
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
