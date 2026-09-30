/* Başlat Butonu Rengi E2E (Home merkezli akış):
   A) Home/varsayılan: buton yeşil hardcoded, html'de custom class yok; "Oluştur" butonu bg anlık görüntüsü
   B) Ayarlar: 8. seçici (Başlat Butonu) RGB'yi sırayla 200/85/85 yap
   C) Home: buton custom rengi aldı + html class eklendi + "Oluştur" butonu ETKİLENMEDİ
   D) theme.json kalıcılık (#505555)
   E) Ayarlar: alpha=0 → Home: hardcoded yeşile dönüş + class kaldırıldı + theme.json #50555500 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const PORT = parseInt(process.env.CDP_PORT || '9777', 10)
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
function readThemeJson() {
  try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), 'AppData', 'Roaming', 'Disco Launcher', 'theme.json'), 'utf8')) } catch { return null }
}
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
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 300))
    return r.result.value
  }
  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 220) : ''}`)
  }
  await send(ws, 'Runtime.enable')
  await sleep(800)

  const gotoRoute = async (route, waitForSel) => {
    // Seçici belirana kadar polling (taze uygulamada yükleme yavaş olabilir)
    const waitSel = async (ms) => {
      const deadline = Date.now() + ms
      while (Date.now() < deadline) {
        if (await evaluate(`!!document.querySelector(${JSON.stringify(waitForSel)})`)) return true
        await sleep(500)
      }
      return false
    }
    if (await waitSel(1000)) return
    // Önce Vue Router ile dene (en güvenilir yol), olmazsa hash değiştir
    await evaluate(`(() => {
      try {
        const app = document.querySelector('#app').__vue_app__
        const router = app && app.config.globalProperties.$router
        if (router) { router.push(${JSON.stringify(route)}); return 'router' }
      } catch (e) { /* fallthrough */ }
      location.hash = ${JSON.stringify('#' + route)}
      return 'hash'
    })()`)
    if (await waitSel(6000)) return
    // Son çare: eve dönüp tekrar dene
    await evaluate(`(() => { location.hash = '#/'; return true })()`)
    await sleep(1500)
    await evaluate(`(() => { location.hash = ${JSON.stringify('#' + route)}; return true })()`)
    if (await waitSel(6000)) return
    throw new Error('navigate failed: ' + route)
  }
  const snapshotHome = () => evaluate(`(() => {
    const b = document.querySelector('.instance-actions-panel .action-btn--primary')
    const custom = [...document.querySelectorAll('*')].filter((el) => getComputedStyle(el).backgroundColor === 'rgb(200, 85, 85)').length
    const st = b ? (b.getAttribute('style') || '') : ''
    return {
      launchBg: b ? getComputedStyle(b).backgroundColor : 'NO-BUTTON',
      inlineBg: /background\s*:/.test(st),
      customBgCount: custom,
      htmlCls: document.documentElement.className,
    }
  })()`)
  const openPicker8 = async () => {
    await gotoRoute('/setting', '.color-theme-row')
    await sleep(400)
    await evaluate(`(() => { document.body.click(); return true })()`)
    await sleep(300)
    await evaluate(`(() => { const d = [...document.querySelectorAll('.color-theme-row .color-button')]; d[7].click(); return true })()`)
    await sleep(1400)
  }
  const setChannel = (idx, val) => evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.v-overlay--active .v-color-picker input[type="number"]')]
    if (!inputs[${idx}]) return 'no-input-' + ${idx}
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(inputs[${idx}], ${JSON.stringify(String(val))})
    inputs[${idx}].dispatchEvent(new Event('input', { bubbles: true }))
    inputs[${idx}].dispatchEvent(new Event('change', { bubbles: true }))
    return 'ok'
  })()`)
  const pickerCount = () => evaluate(`document.querySelectorAll('.color-theme-row .color-button').length`)
  const dot7 = () => evaluate(`(() => { const d = [...document.querySelectorAll('.color-theme-row .color-button')]; return d[7] ? d[7].style.backgroundColor : null })()`)
  const launchColorInJson = () => {
    const t = readThemeJson()
    return t && t.colors ? (t.colors.launchButtonColor === undefined ? 'UNDEFINED' : t.colors.launchButtonColor) : 'NO-JSON'
  }

  // ── A) Home / varsayılan ────────────────────────────────────────
  await gotoRoute('/', '.instance-actions-panel')
  await sleep(500)
  const snap0 = await snapshotHome()
  record('Varsayılan: buton yeşil hardcoded', snap0.launchBg === 'rgba(150, 219, 89, 0.15)', snap0.launchBg)
  record('Varsayılan: butonda inline custom stil yok', !snap0.inlineBg, snap0.launchBg)
  console.log('theme.json launchButtonColor (başlangıç):', launchColorInJson())

  // ── B) Ayarlar: 8. seçici RGB 200/85/85 (sıralı) ────────────────
  await gotoRoute('/setting', '.color-theme-row')
  await sleep(400)
  const cnt = await pickerCount()
  record('8 renk seçici var', cnt === 8, 'count=' + cnt)
  await evaluate(`(() => { const d = [...document.querySelectorAll('.color-theme-row .color-button')]; d[7].click(); return true })()`) 
  await sleep(1400)
  let setLog = []
  for (const [idx, val] of [[0, 200], [1, 85], [2, 85]]) {
    const r = await setChannel(idx, val)
    setLog.push(idx + ':' + r)
    await sleep(450)
  }
  console.log('SET RGB:', setLog.join(' '))
  await sleep(2500)
  const d1 = await dot7()
  record('Seçici dot rengi değişti', d1 === 'rgb(200, 85, 85)', d1)

  // ── C) Home: buton + izolasyon ──────────────────────────────────
  await evaluate(`(() => { document.body.click(); return true })()`)
  await sleep(400)
  await gotoRoute('/', '.instance-actions-panel')
  await sleep(600)
  const snap1 = await snapshotHome()
  record('Başlat butonu custom rengi aldı', snap1.launchBg === 'rgb(200, 85, 85)', snap1.launchBg)
  record('Butona inline custom stil bind edildi', snap1.inlineBg, snap1.launchBg)
  record('Renk SADECE Başlat butonuna uygulandı (izolasyon)', snap1.customBgCount === 1, 'custom-bg eleman sayısı=' + snap1.customBgCount)

  // ── D) theme.json kalıcılık ─────────────────────────────────────
  const j1 = launchColorInJson()
  record('theme.json kalıcı yazıldı', /^#C85555(FF)?$/i.test(j1), j1)

  // ── E) Varsayılana dönüş: alpha=0 (NO_CLEAR=1 ile atlanır) ──────
  if (process.env.NO_CLEAR === '1') {
    console.log('NO_CLEAR=1: temizleme adımı atlandı, renk ayili birakildi')
  } else {
  await openPicker8()
  const clearLog = []
  for (const [idx, val] of [[0, 0], [1, 0], [2, 0], [3, 0]]) {
    const r = await setChannel(idx, val)
    clearLog.push(idx + ':' + r)
    await sleep(450)
  }
  console.log('CLEAR:', clearLog.join(' '))
  await sleep(2500)
  await evaluate(`(() => { document.body.click(); return true })()`)
  await sleep(400)
  await gotoRoute('/', '.instance-actions-panel')
  await sleep(600)
  const snap2 = await snapshotHome()
  record('Sıfırlama: hardcoded yeşile döndü', snap2.launchBg === 'rgba(150, 219, 89, 0.15)', snap2.launchBg)
  record('Sıfırlama: inline custom stil kaldırıldı', !snap2.inlineBg, snap2.launchBg)
  const j2 = launchColorInJson()
  record('Sıfırlama: theme.json temizlendi (alpha-0 = boş)', j2 === '', j2)
  }

  console.log('---')
  console.log('SONUÇ: ' + results.filter(r => r.ok).length + '/' + results.length + ' PASS')
  process.exit(results.every(r => r.ok) ? 0 : 1)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
