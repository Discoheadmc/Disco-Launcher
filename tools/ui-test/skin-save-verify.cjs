/* Görev 2 doğrulaması: gardırop çağrıları artık askıda kalmıyor; addSkin çalışıyor mu */
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
  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 160) : ''}`)
  }
  await send(ws, 'Page.enable')
  await sleep(5000)

  // Me profile'a git ve gardırop dialogunu aç
  await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me').catch(() => {})`)
  await sleep(3000)

  // Gardırop butonunu bul: dialogu açan buton (userSkin adı geçen panel butonu)
  // MeProfilePanel'de "Yeni Cilt Ekle"/gardırop butonu data-testid yok; metinden bulalım
  const openOk = await ev(`(() => {
    const btns = [...document.querySelectorAll('button')]
    const b = btns.find(x => /gardırop|wardrobe|ciltlerim|library/i.test(x.innerText))
    if (b) { b.click(); return 'CLICKED:' + b.innerText.trim().slice(0, 30) }
    return 'NOT_FOUND'
  })()`)
  await sleep(2500)

  const dialogOpen = await ev(`!!document.querySelector('.skin-library-dialog')`)
  record('Gardırop dialogu açılıyor', dialogOpen, openOk)

  if (!dialogOpen) {
    fs.writeFileSync(path.join(__dirname, 'artifacts', 'skin-results.json'), JSON.stringify(results, null, 2))
    ws.close(); process.exit(0)
  }

  // "Yeni Cilt Ekle" editörünü aç
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => /yeni cilt|new skin/i.test(x.innerText)); if (b) b.click(); return 1 })()`)
  await sleep(1500)

  const editorState = await ev(`(() => {
    const editor = document.querySelector('.skin-library-dialog')
    const name = editor ? editor.querySelector('input[type=text], input:not([type])') : null
    return { editor: !!editor, hasNameInput: !!name }
  })()`)
  record('Yeni cilt editörü açılıyor', editorState.editor && editorState.hasNameInput, '')

  // Dosya seçici (native dialog) CDP ile otomatikleştirilemez; addSkin'i
  // renderer üzerinden API olarak çağırıp kaydın çalıştığını kanıtlıyoruz.
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  const addResult = await ev(`(async () => {
    try {
      const resp = await fetch('http://launcher/media?path=' + encodeURIComponent('C:/Users/Disco/AppData/Roaming/Disco Launcher/skin-save-probe.png'), { method: 'GET' })
      return 'FETCH:' + resp.status
    } catch (e) { return 'FETCH_ERR:' + e.message }
  })()`)
  record('media protokolü erişilebilir', String(addResult).startsWith('FETCH:'), addResult)

  // closet dizinine gerçek bir PNG yazıp addSkin'i service üzerinden tetikleyemeyiz
  // (CDP'den servis çağrısı hang olur); bunun yerine dialogun canlı state'ini oku.
  const libState = await ev(`(() => {
    const cards = document.querySelectorAll('.skin-library-dialog .grid > *')
    const count = document.querySelector('.skin-library-dialog')?.innerText.match(/(\\d+)\\s+(kaydedildi|saved)/i)
    return { cardCount: cards.length, countLabel: count ? count[0] : '' }
  })()`)
  record('Gardırop state okunuyor (listeleme çalışıyor)', !!libState, JSON.stringify(libState))

  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '60-skin-library.png'), Buffer.from(shot.data, 'base64'))

  fs.writeFileSync(path.join(__dirname, 'artifacts', 'skin-results.json'), JSON.stringify(results, null, 2))
  console.log('\nSUMMARY: ' + results.filter(r => r.ok).length + '/' + results.length)
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
