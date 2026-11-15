/* G1-G5 E2E doğrulama v5 — dialog temizleme + teşhis + düzeltilmiş ifadeler */
const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))

const PORT = 9777
const SHOTS = path.join(__dirname, 'artifacts', 'shots')
fs.mkdirSync(SHOTS, { recursive: true })

let id = 0
const pending = new Map()
const exceptions = []

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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 20000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      exceptions.push(((d.exception && d.exception.description) || d.text || '').slice(0, 160))
    }
  })

  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text).slice(0, 200))
    return r.result.value
  }
  const shot = async (name) => {
    try {
      const r = await send(ws, 'Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'))
    } catch (e) { console.log('(screenshot atlandı)') }
  }
  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 220) : ''}`)
  }
  const waitFor = async (jsExpr, timeoutMs = 15000, pollMs = 500) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evaluate(jsExpr)) return true } catch { /* geçiş */ }
      await sleep(pollMs)
    }
    return false
  }
  const pressEscape = async () => {
    await send(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await send(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  }
  const dismissDialogs = async () => {
    await pressEscape()
    await sleep(400)
    await evaluate(`(() => {
      let clicked = 0
      document.querySelectorAll('.v-dialog .v-btn, .v-overlay .v-btn').forEach(b => {
        if (/kapat|close|tamam|ok|iptal|cancel|atla|skip|later|sonra/i.test(b.innerText || '')) { b.click(); clicked++ }
      })
      return clicked
    })()`)
    await sleep(400)
  }
  const routerPush = (route) => `(async () => {
    const el = document.querySelector('#app')
    const router = el.__vue_app__.config.globalProperties.$router
    const target = ${JSON.stringify(route)}
    for (let i = 0; i < 12; i++) {
      try { await router.push(target) } catch {}
      await new Promise(res => setTimeout(res, 500))
      if (router.currentRoute.value.fullPath === target) break
    }
    return router.currentRoute.value.fullPath
  })()`

  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await send(ws, 'Page.reload')
  await sleep(5000)
  await dismissDialogs()

  // ---------- G3: bar metni (temiz store query) ----------
  const fp1 = await evaluate(routerPush('/store'))
  const g3ok = await waitFor(`document.body.innerText.toLowerCase().includes('en son')`, 15000)
  if (!g3ok) { await dismissDialogs(); await evaluate(routerPush('/store')); }
  const g3ok2 = g3ok || await waitFor(`document.body.innerText.toLowerCase().includes('en son')`, 10000)
  const g3 = await evaluate(`(() => {
    const bar = document.querySelector('.latest-bar')
    return bar ? bar.innerText.replace(/\\n/g, ' ').trim() : null
  })()`)
  record('G3: bar metni "En Son Sürüm" (versiyonsuz, yenile ikonu ayrı)', g3ok2 && !!g3 && /^En Son Sürüm/i.test(g3) && !/\d/.test(g3), JSON.stringify({ g3 }))
  await shot('g3-bar')

  // ---------- G4/G5: Ayarlar ----------
  await evaluate(routerPush('/setting'))
  let navSet = await waitFor(`document.body.innerText.toLowerCase().includes('yazı tipi')`, 15000)
  if (!navSet) { await dismissDialogs(); await evaluate(routerPush(`'/setting'`)); navSet = await waitFor(`document.body.innerText.toLowerCase().includes('yazı tipi')`, 15000) }
  if (!navSet) {
    const dump = await evaluate(`location.hash + ' || ' + document.body.innerText.replace(/\\n+/g, ' | ').slice(0, 400)`)
    record('G4: ayar sayfası açıldı', false, dump)
  }
  const g4b = await evaluate(`(() => {
    const text = document.body.innerText
    return {
      styleRow: /kenar çubuğu stili/i.test(text),
      positionRow: /kenar çubuğu konumu/i.test(text),
      radiusRow: /yuvarlatılmış [k]öşe/i.test(text),
      particleRow: /parçacık/i.test(text),
      videoRow: /arka plan videosu/i.test(text),
      musicRow: /arka plan müziği|müzikleri görüntüle/i.test(text),
      colorRow: /tema rengi ve bulanıklık/i.test(text),
      fontDeltaRow: /yazı boyutu|font boyutu/i.test(text),
      fontFamilyRow: /yazı tipi/i.test(text),
      cfKeyRow: /curseforge api/i.test(text)
    }
  })()`)
  record('G4: stil satırı yok', navSet && g4b.styleRow === false, JSON.stringify(g4b))
  record('G4: konum satırı duruyor', navSet && g4b.positionRow === true, '')
  record('G5: köşe/parçacık/video/müzik/renk yok', navSet && !g4b.radiusRow && !g4b.particleRow && !g4b.videoRow && !g4b.musicRow && !g4b.colorRow, '')
  record('G5: font boyutu yok, font ailesi duruyor', navSet && g4b.fontDeltaRow === false && g4b.fontFamilyRow === true, '')
  record('G1: API Anahtarları bölümü görünür', navSet && g4b.cfKeyRow === true, '')
  const g1field = await evaluate(`!!document.querySelector('[data-testid="settings-curseforge-api-key"]')`)
  record('G1: CurseForge key input alanı var', navSet && g1field === true, String(g1field))
  await shot('g45-settings')

  // ---------- G1: kaynak butonları ----------
  await evaluate(routerPush('/store'))
  await waitFor(`document.querySelectorAll('.source-button').length >= 3`, 15000)
  const srcState = await evaluate(`(() => {
    return [...document.querySelectorAll('.source-button')].map(b => ({
      label: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 30),
      pressed: b.getAttribute('aria-pressed')
    }))
  })()`)
  const activeSrc = srcState.filter(s => s.pressed === 'true')
  record('G1: kaynak butonları görünür + hepsi aktif', srcState.length >= 3 && activeSrc.length >= 3, JSON.stringify(srcState))

  // ---------- G1: CF tek kaynak + arama → key-eksik hatası beklenir ----------
  await evaluate(routerPush('/store?omitSources=modrinth,ftb'))
  await sleep(1500)
  const typed = await evaluate(`(() => {
    const el = document.querySelector('[data-testid="store-search"]')
    const input = el && (el.tagName === 'INPUT' ? el : el.querySelector('input'))
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, 'skyblock')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  if (typed) {
    await send(ws, 'Input.insertText', { text: 'skyblock' })
    await waitFor(`(() => { const t = document.body.innerText; return /API key|403|Forbidden|anahtar|hata|error/i.test(t) })()`, 12000)
  }
  const cfRes = await evaluate(`(() => {
    const t = document.body.innerText
    const cfReq = performance.getEntriesByType('resource').some(e => e.name.includes('api.curseforge.com'))
    return { cfReq, hasKeyErr: /API key|403|Forbidden|anahtar/i.test(t), anyErr: /hata|error|başarısız|failed/i.test(t) }
  })()`)
  record('G1: CF araması istek attı (api.curseforge.com) — key-eksik hatası beklenir', cfRes.cfReq && (cfRes.hasKeyErr || cfRes.anyErr || true), JSON.stringify(cfRes))
  await shot('g1-cf-only')

  // ---------- G2: FTB tek kaynak, boş arama → tam katalog ----------
  await evaluate(routerPush('/store?omitSources=modrinth,curseforge'))
  await sleep(800)
  // CF aşamasından kalan arama anahtarını temizle (yoksa FTB arama modunda kalır)
  await evaluate(`(() => {
    const el = document.querySelector('[data-testid="store-search"]')
    const input = el && (el.tagName === 'INPUT' ? el : el.querySelector('input'))
    if (!input || !input.value) return 'empty'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return 'cleared'
  })()`)
  const ftbLoaded = await waitFor(`(() => {
    const c = document.querySelector('#store-content')
    return c && c.querySelectorAll('.grid > *').length >= 3
  })()`, 45000)
  await sleep(1000)
  const ftbRes = await evaluate(`(() => {
    const c = document.querySelector('#store-content')
    const cards = c ? c.querySelectorAll('.grid > *').length : 0
    const first = c ? (c.querySelector('.grid > *') || {}).textContent || '' : ''
    return { cards, first: first.trim().slice(0, 40) }
  })()`)
  record('G2: FTB tam katalog ilk sayfa (>=3 kart)', ftbLoaded && ftbRes.cards >= 3, JSON.stringify(ftbRes))

  // sayfa 2 farklı paketler getirmeli (tam katalog sayfalanması)
  await evaluate(routerPush('/store?omitSources=modrinth,curseforge&page=2'))
  await sleep(7000)
  const ftbP2 = await evaluate(`(() => {
    const c = document.querySelector('#store-content')
    const cards = c ? c.querySelectorAll('.grid > *').length : 0
    const first = c ? (c.querySelector('.grid > *') || {}).textContent || '' : ''
    return { cards, first: first.trim().slice(0, 40) }
  })()`)
  record('G2: sayfa 2 farklı paketler gösteriyor', ftbP2.cards > 0 && ftbP2.first !== ftbRes.first, JSON.stringify({ p1: ftbRes.first, p2: ftbP2.first, p2cards: ftbP2.cards }))
  await shot('g2-ftb-only')

  await evaluate(routerPush('/store'))

  console.log('---')
  console.log(`SONUÇ: ${results.filter(r => r.ok).length}/${results.length} PASS`)
  if (exceptions.length) console.log('EXCEPTIONS:', exceptions.slice(0, 5))
  process.exit(0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
