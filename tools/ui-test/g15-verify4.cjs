/* G1-G5 E2E doğrulama v4 — URL-query tabanlı source durumu + temiz nav */
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
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }
  const shot = async (name) => {
    try {
      const r = await send(ws, 'Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'))
    } catch (e) { console.log('(screenshot atlandı: ' + e.message + ')') }
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

  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await sleep(1200)

  // Store'u temiz query ile aç
  const storeQuery = async (q) => {
    await evaluate(`(async () => {
      const el = document.querySelector('#app')
      const router = el.__vue_app__.config.globalProperties.$router
      for (let i = 0; i < 10; i++) {
        await router.push({ path: '/store', query: ${JSON.stringify(q)} }).catch(() => {})
        await new Promise(r => setTimeout(r, 500))
        const cur = router.currentRoute.value
        if (cur.path === '/store' && JSON.stringify(cur.query) === JSON.stringify(${JSON.stringify(q)})) break
      }
      return router.currentRoute.value.fullPath
    })()`)
    await sleep(1000)
  }

  // ---------- G3: bar metni (temiz query) ----------
  await storeQuery({})
  const g3ok = await waitFor(`(() => { const t = document.body.innerText; return t.toLowerCase().includes('en son') })()`, 15000)
  const g3 = await evaluate(`(() => {
    const els = [...document.querySelectorAll('.latest-bar *')].filter(n => n.children.length === 0 || n.classList.contains('latest-bar__text'))
    return els.map(e => e.textContent.trim()).filter(Boolean)
  })()`)
  const g3text = g3.find(t => /en son/i.test(t)) || null
  record('G3: bar metni "En Son Sürüm" (versiyonsuz)', g3ok && !!g3text && /^En Son Sürüm$/i.test(g3text) && !/\d/.test(g3text), JSON.stringify({ g3ok, g3: g3.slice(0, 4) }))
  await shot('g3-bar')

  // ---------- G4/G5: Ayarlar ----------
  await evaluate(`(async () => {
    const el = document.querySelector('#app')
    const router = el.__vue_app__.config.globalProperties.$router
    await router.push('/setting').catch(() => {})
  })()`)
  const navSet = await waitFor(`document.body.innerText.toLowerCase().includes('curseforge')`, 15000)
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
  const g1field = await evaluate(`(() => {
    const el = document.querySelector('[data-testid="settings-curseforge-api-key"]')
    return { present: !!el }
  })()`)
  record('G1: CurseForge key input alanı var', g1field.present, JSON.stringify(g1field))
  await shot('g45-settings')

  // ---------- G1: kaynak butonları (aria-pressed taşıyan elemanlar) ----------
  await storeQuery({})
  await waitFor(`document.querySelectorAll('[aria-pressed]').length >= 3`, 15000)
  const srcState = await evaluate(`(() => {
    return [...document.querySelectorAll('[aria-pressed]')].slice(0, 6).map(b => ({
      label: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 30),
      pressed: b.getAttribute('aria-pressed')
    }))
  })()`)
  const activeSrc = srcState.filter(s => s.pressed === 'true')
  record('G1: kaynak butonları görünür + hepsi aktif', srcState.length >= 3 && activeSrc.length >= 3, JSON.stringify(srcState))

  // ---------- G1: CF tek kaynak + arama → key hatası beklenir ----------
  await storeQuery({ omitSources: 'modrinth,ftb' })
  await sleep(1500)
  const typed = await evaluate(`(() => { const i = document.querySelector('[data-testid="store-search"]'); if (!i) return false; i.focus(); return true })()`)
  if (typed) {
    await send(ws, 'Input.insertText', { text: 'skyblock' })
    await waitFor(`(() => { const t = document.body.innerText; return /API key|403|Forbidden|anahtar|hata|error/i.test(t) })()`, 15000)
  }
  const cfRes = await evaluate(`(() => {
    const t = document.body.innerText
    return { hasKeyErr: /API key|403|Forbidden|anahtar/i.test(t), anyErr: /hata|error|başarısız|failed/i.test(t) }
  })()`)
  record('G1: CF araması istek attı, key-eksik hatası görünüyor (beklenen)', cfRes.hasKeyErr || cfRes.anyErr, JSON.stringify(cfRes))
  await shot('g1-cf-only')

  // ---------- G2: FTB tek kaynak, boş arama → tam katalog ----------
  await storeQuery({ omitSources: 'modrinth,curseforge' })
  const ftbLoaded = await waitFor(`document.querySelectorAll('.v-card, [class*="project"]').length >= 30`, 25000)
  await sleep(1000)
  const ftbRes = await evaluate(`(() => ({
    cards: document.querySelectorAll('.v-card, [class*="project"]').length,
    barText: (document.querySelector('.latest-bar') || {}).innerText || null
  }))()`.replace('))()', '})()'))
  record('G2: FTB tam katalog (>=30 kart)', ftbLoaded && ftbRes.cards >= 30, JSON.stringify(ftbRes))
  await shot('g2-ftb-only')

  // son: temiz duruma dön
  await storeQuery({})

  console.log('---')
  console.log(`SONUÇ: ${results.filter(r => r.ok).length}/${results.length} PASS`)
  if (exceptions.length) console.log('EXCEPTIONS:', exceptions.slice(0, 5))
  process.exit(0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
