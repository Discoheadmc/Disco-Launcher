/* G1-G5 E2E doğrulama v3 — doğru sayfa/marker/toggle mantığı */
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 30000)
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
      exceptions.push(((d.exception && d.exception.description) || d.text || '').slice(0, 200))
    }
  })

  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }
  const shot = async (name) => {
    const r = await send(ws, 'Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'))
  }
  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 220) : ''}`)
  }
  const waitFor = async (jsExpr, timeoutMs = 15000, pollMs = 500) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evaluate(jsExpr)) return true } catch { /* geçiş sırasında */ }
      await sleep(pollMs)
    }
    return false
  }

  const nav = async (route) => {
    await evaluate(`(async () => {
      const el = document.querySelector('#app')
      const router = el.__vue_app__.config.globalProperties.$router
      for (let i = 0; i < 10; i++) {
        if (router.currentRoute.value.fullPath === '${route}') break
        await router.push('${route}').catch(() => {})
        await new Promise(r => setTimeout(r, 600))
      }
      return router.currentRoute.value.fullPath
    })()`)
    await sleep(1200)
  }

  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await sleep(1500)

  // ---------- G3: bar metni — STORE sayfasında ----------
  await nav('/store')
  const g3ok = await waitFor(`document.body.innerText.toLowerCase().includes('en son')`, 15000)
  const g3 = await evaluate(`(() => {
    const els = [...document.querySelectorAll('*')].filter(n => n.children.length === 0 && /en son/i.test(n.textContent || ''))
    return els.map(e => e.textContent.trim()).filter(t => t.length < 60)
  })()`)
  record('G3: bar metni "En Son Sürüm" (versiyonsuz)', g3.some(t => /^En Son Sürüm$/i.test(t)), JSON.stringify(g3.slice(0, 5)))
  await shot('g3-bar')

  // ---------- G4/G5: Ayarlar ----------
  await nav('/setting')
  const navSet = await waitFor(`document.body.innerText.toLowerCase().includes('ağ ayarları') || document.body.innerText.toLowerCase().includes('api')`, 15000)
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
  record('G5: köşe/parçacık/video/müzik/renk yok', navSet && !g4b.radiusRow && !g4b.particleRow && !g4b.videoRow && !g4b.musicRow && !g4b.colorRow, JSON.stringify(g4b))
  record('G5: font boyutu yok, font ailesi duruyor', navSet && g4b.fontDeltaRow === false && g4b.fontFamilyRow === true, '')
  record('G1: API Anahtarları bölümü (CF metni) görünür', navSet && g4b.cfKeyRow === true, '')

  const g1field = await evaluate(`(() => {
    const el = document.querySelector('[data-testid="settings-curseforge-api-key"]')
    return { present: !!el, tag: el ? el.tagName : null }
  })()`)
  record('G1: CurseForge key input alanı var', g1field.present, JSON.stringify(g1field))
  await shot('g45-settings')

  // ---------- G1: Store kaynak butonları + CF tek kaynak testi ----------
  await nav('/store')
  await waitFor(`document.querySelectorAll('button.source-button').length >= 3`, 15000)
  const srcState = await evaluate(`(() => {
    return [...document.querySelectorAll('button.source-button')].map(b => ({
      id: /modrinth/i.test(b.getAttribute('aria-label') || '') ? 'modrinth' : /curseforge/i.test(b.getAttribute('aria-label') || '') ? 'curseforge' : /ftb/i.test(b.getAttribute('aria-label') || '') ? 'ftb' : '?',
      pressed: b.getAttribute('aria-pressed')
    }))
  })()`)
  const allThere = srcState.length >= 3 && srcState.every(s => s.id !== '?') && srcState.every(s => s.pressed === 'true')
  record('G1: 3 kaynak butonu aktif (Modrinth/CF/FTB)', allThere, JSON.stringify(srcState))

  // yardımcı: kaynak butonuna tıkla (toggle)
  const clickSource = async (id) => {
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('button.source-button')].find(x => new RegExp('${id}', 'i').test(x.getAttribute('aria-label') || ''))
      if (b) b.click()
      return !!b
    })()`)
    await sleep(700)
  }
  const clearSearch = async () => {
    await evaluate(`(() => {
      const i = document.querySelector('[data-testid="store-search"]')
      if (i) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })) }
      return true
    })()`)
  }
  const typeSearch = async (text) => {
    const ok = await evaluate(`(() => { const i = document.querySelector('[data-testid="store-search"]'); if (!i) return false; i.focus(); return true })()`)
    if (ok) { await send(ws, 'Input.insertText', { text }); return true }
    return false
  }

  // CF-only: Modrinth + FTB'yi çıkar
  await clickSource('modrinth')
  await clickSource('ftb')
  await clearSearch()
  await sleep(500)
  await typeSearch('skyblock')
  const cfResp = await waitFor(`(() => { const t = document.body.innerText; return /API key|403|Forbidden|anahtar/i.test(t) || document.querySelectorAll('img').length > 3 })()`, 15000)
  const cfRes = await evaluate(`(() => {
    const t = document.body.innerText
    return { hasKeyErr: /API key|403|Forbidden|anahtar/i.test(t), imgs: document.querySelectorAll('img').length, pressed: [...document.querySelectorAll('button.source-button')].map(b => b.getAttribute('aria-pressed')).join(',') }
  })()`)
  record('G1: CF tek kaynak — istek/yant akışı', cfResp, JSON.stringify(cfRes))
  await shot('g1-cf-only')

  // geri al: Modrinth + FTB'yi tekrar ekle, aramayı temizle
  await clearSearch()
  await sleep(400)
  await clickSource('modrinth')
  await clickSource('ftb')
  await sleep(1500)

  // ---------- G2: FTB tek kaynak, boş arama = tam katalog ----------
  await clickSource('modrinth')
  await clickSource('curseforge')
  await clearSearch()
  await sleep(500)
  const ftbLoaded = await waitFor(`document.querySelectorAll('button.source-button').length === 3 && document.querySelectorAll('.v-card, [class*="project"]').length >= 30 || [...document.querySelectorAll('button.source-button')].filter(b => b.getAttribute('aria-pressed') === 'true').length === 1 && document.body.innerText.length > 500`, 20000)
  await sleep(2000)
  const ftbRes = await evaluate(`(() => {
    const cards = document.querySelectorAll('.v-card, [class*="project"]')
    return { cards: cards.length, pressed: [...document.querySelectorAll('button.source-button')].map(b => b.getAttribute('aria-pressed')).join(',') }
  })()`)
  record('G2: FTB tam katalog (>=30 kart)', ftbRes.cards >= 30, JSON.stringify(ftbRes))
  await shot('g2-ftb-only')

  // geri al
  await clickSource('modrinth')
  await clickSource('curseforge')
  await sleep(500)

  console.log('---')
  console.log(`SONUÇ: ${results.filter(r => r.ok).length}/${results.length} PASS`)
  if (exceptions.length) console.log('EXCEPTIONS:', exceptions.slice(0, 5))
  process.exit(0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
