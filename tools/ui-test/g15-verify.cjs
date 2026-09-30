/* G1-G5 E2E doğrulama driver'ı — yeni build'e CDP üzerinden bağlanır. */
const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))

const PORT = 9777
const OUT = process.env.OUT_DIR || path.join(__dirname, 'artifacts')
const SHOTS = path.join(OUT, 'shots')
fs.mkdirSync(SHOTS, { recursive: true })

let id = 0
const pending = new Map()

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
}

function send(ws, method, params = {}) {
  const msg = { id: ++id, method, params }
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(msg.id)) {
        pending.delete(msg.id)
        reject(new Error('CDP timeout: ' + method))
      }
    }, 30000)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`)
  const page = targets.find((t) => t.type === 'page' && t.url.includes('disco.runtime'))
  if (!page) throw new Error('launcher page not found')
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

  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 200) : ''}`)
  }

  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }

  const shot = async (name) => {
    const r = await send(ws, 'Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'))
  }

  const nav = async (route) => {
    await evaluate(`(async () => {
      const app = document.querySelector('#app')
      const router = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$router
      if (!router) throw new Error('router yok')
      for (let i = 0; i < 30; i++) { if (router.currentRoute.value.fullPath !== undefined) break; await new Promise(r => setTimeout(r, 100)) }
      await router.push('${route}').catch(() => {})
      return router.currentRoute.value.fullPath
    })()`)
    await sleep(2500)
  }

  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await sleep(3000)

  // ---------- G3: bar metni ----------
  await nav('/')
  const g3 = await evaluate(`(() => {
    const el = [...document.querySelectorAll('*')].find(n => n.children.length === 0 && /En Son (Sürüm|Minecraft Sürümü)/.test(n.textContent || ''))
    return el ? el.textContent.trim() : null
  })()`)
  record('G3: bar metni versiyonsuz "En Son Sürüm"', g3 === 'En Son Sürüm', g3)
  await shot('g3-bar')

  // ---------- G4: sidebar klasik ----------
  const g4 = await evaluate(`(() => {
    const notch = document.querySelector('.notch, [class*="notch"]')
    const classic = document.querySelector('[class*="sidebar"], nav, .v-navigation-drawer')
    return { notch: !!notch, sidebar: !!classic }
  })()`)
  record('G4: sidebar render (klasik)', g4.sidebar, 'notch=' + g4.notch)

  await nav('/setting')
  await sleep(1500)
  const g4b = await evaluate(`(() => {
    const text = document.body.innerText
    return {
      styleRow: /Kenar Çubuğu Stili/i.test(text),
      alignRow: /Kenar Çubuğu Hizalaması|Auto-hide|Otomatik Gizle/i.test(text),
      scaleRow: /Kenar Çubuğu Ölçeği/i.test(text),
      positionRow: /Kenar Çubuğu Konumu/i.test(text),
      radiusRow: /Yuvarlatılmış [Kk]öşe/i.test(text),
      particleRow: /Parçacık/i.test(text),
      videoRow: /Arka Plan Videosu/i.test(text),
      musicRow: /Arka Plan Müziği|Müzikleri Görüntüle/i.test(text),
      colorRow: /Tema Rengi ve Bulanıklık/i.test(text),
      fontDeltaRow: /Yazı Boyutu|Font Boyutu/i.test(text),
      fontFamilyRow: /Yazı Tipi/i.test(text)
    }
  })()`)
  record('G4: ayarlarda stil satırı yok', g4b.styleRow === false, JSON.stringify(g4b))
  record('G4: align/autohide/scale satırı yok', !g4b.alignRow && !g4b.scaleRow, JSON.stringify(g4b))
  record('G4: konum satırı duruyor', g4b.positionRow === true, '')
  record('G5: yuvarlatılmış köşe yok', g4b.radiusRow === false, '')
  record('G5: parçacık/video/müzik yok', !g4b.particleRow && !g4b.videoRow && !g4b.musicRow, JSON.stringify(g4b))
  record('G5: renk seçici kartı yok', g4b.colorRow === false, '')
  record('G5: font boyutu yok, font ailesi duruyor', g4b.fontDeltaRow === false && g4b.fontFamilyRow === true, JSON.stringify(g4b))
  await shot('g45-settings-appearance')

  // ---------- G1: Ağ Ayarları → API Anahtarları ----------
  const g1 = await evaluate(`(() => {
    const input = document.querySelector('[data-testid="settings-curseforge-api-key"]')
    return { present: !!input, type: input ? input.type : null }
  })()`)
  record('G1: CurseForge API key alanı', g1.present, JSON.stringify(g1))
  await shot('g1-api-key-field')

  // ---------- G1: Store CurseForge kaynağı ----------
  await nav('/store')
  await sleep(2000)
  const g1b = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button.source-button')]
    const cf = btns.find(b => /curseforge/i.test(b.getAttribute('aria-label') || '') || /curseforge/i.test(b.innerText))
    return { total: btns.length, cfLabel: cf ? (cf.getAttribute('aria-label') || cf.innerText.trim()) : null, omitted: cf ? cf.classList.contains('omitted') : null }
  })()`)
  record('G1: kaynak seçicide CurseForge var', !!g1b.cfLabel, JSON.stringify(g1b))
  // CurseForge'u tek kaynak yap ve arama yap
  await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button.source-button')]
    const cf = btns.find(b => /curseforge/i.test(b.getAttribute('aria-label') || '') || /curseforge/i.test(b.innerText))
    if (cf) cf.click()
    return true
  })()`)
  await sleep(800)
  const search = await evaluate(`(() => {
    const inp = document.querySelector('[data-testid="store-search"]')
    if (!inp) return null
    inp.focus()
    return true
  })()`)
  if (search) {
    await send(ws, 'Input.insertText', { text: 'skyblock' })
    await sleep(6000)
  }
  const g1c = await evaluate(`(() => {
    const cards = document.querySelectorAll('[class*="project"], [class*="card"], .store-project-item')
    const err = /error|failed|hata|403|api key/i.test(document.body.innerText.slice(0, 4000))
    return { cards: cards.length, errHint: err }
  })()`)
  record('G1: CurseForge araması istek attı (kart veya hata mesajı)', g1c.cards > 0 || g1c.errHint, JSON.stringify(g1c))
  await shot('g1-curseforge-search')

  // ---------- G2: FTB paket sayısı ----------
  await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button.source-button')]
    const ftb = btns.find(b => /ftb/i.test(b.getAttribute('aria-label') || '') || /ftb/i.test(b.innerText))
    if (ftb) ftb.click()
    return true
  })()`)
  await sleep(800)
  // aramayı temizle
  const inp = await evaluate(`document.querySelector('[data-testid="store-search"]') ? document.querySelector('[data-testid="store-search"]').value : null`)
  if (inp) {
    await evaluate(`(() => { const i = document.querySelector('[data-testid="store-search"]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
    await sleep(6000)
  }
  const g2 = await evaluate(`(() => {
    const text = document.body.innerText
    const m = text.match(/(\\d+)\\s*(?:Mod Pack|projeler|projects|paket)/i)
    const cards = document.querySelectorAll('[class*="project"], [class*="card"], .store-project-item')
    return { label: m ? m[0] : null, cards: cards.length }
  })()`)
  record('G2: FTB kataloğu listelendi (>=40 kart/etiket)', (g2.cards >= 40) || /9[0-9]/.test(g2.label || ''), JSON.stringify(g2))
  await shot('g2-ftb-all')

  console.log('---')
  const pass = results.filter(r => r.ok).length
  console.log(`SONUÇ: ${pass}/${results.length} PASS`)
  process.exit(0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
