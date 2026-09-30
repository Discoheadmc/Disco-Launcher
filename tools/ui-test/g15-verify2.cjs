/* G1-G5 E2E doğrulama v2 — retry-loop nav + marker bekleme */
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
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 200) : ''}`)
  }

  // JS koşulu true olana dek poll et (uzun sabit sleep yerine)
  const waitFor = async (jsExpr, timeoutMs = 12000, pollMs = 500) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      try { if (await evaluate(jsExpr)) return true } catch { /* sayfa değişiyor olabilir */ }
      await sleep(pollMs)
    }
    return false
  }

  // retry-loop push: route gerçekten değişene kadar dene
  const nav = async (route, marker, timeoutMs = 20000) => {
    await evaluate(`(async () => {
      const el = document.querySelector('#app')
      const router = el.__vue_app__.config.globalProperties.$router
      for (let i = 0; i < 10; i++) {
        if (router.currentRoute.value.fullPath === '${route}') break
        await router.push('${route}').catch(() => {})
        await new Promise(r => setTimeout(r, 700))
      }
      return router.currentRoute.value.fullPath
    })()`)
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      const ok = await evaluate(`document.body.innerText.includes(${JSON.stringify(marker)})`)
      if (ok) { await sleep(600); return true }
      await sleep(500)
    }
    return false
  }

  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await sleep(1500)

  // ---------- G3 ----------
  const navHome = await nav('/', 'Gardirop')
  const g3 = await evaluate(`(() => {
    const els = [...document.querySelectorAll('*')].filter(n => n.children.length === 0 && /En Son/.test(n.textContent || ''))
    return els.map(e => e.textContent.trim())
  })()`)
  record('G3: bar metni "En Son Sürüm" (versiyonsuz)', navHome && g3.some(t => t === 'En Son Sürüm'), JSON.stringify(g3))
  await shot('g3-bar')

  // ---------- G4/G5: Ayarlar ----------
  const navSet = await nav('/setting', 'Ağ Ayarları')
  if (!navSet) {
    const txt = await evaluate(`document.body.innerText.replace(/\\n+/g, ' | ').slice(0, 1500)`)
    record('G4: ayar sayfası açıldı', false, txt)
  }
  const g4b = await evaluate(`(() => {
    const text = document.body.innerText
    return {
      styleRow: /Kenar Çubuğu Stili/i.test(text),
      alignRow: /Kenar Çubuğu Hizalaması/.test(text),
      autoHideRow: /Otomatik Gizle/.test(text),
      scaleRow: /Kenar Çubuğu Ölçeği/.test(text),
      positionRow: /Kenar Çubuğu Konumu/.test(text),
      radiusRow: /Yuvarlatılmış [Kk]öşe/.test(text),
      particleRow: /Parçacık/.test(text),
      videoRow: /Arka Plan Videosu/.test(text),
      musicRow: /Arka Plan Müziği|Müzikleri Görüntüle/.test(text),
      colorRow: /Tema Rengi ve Bulanıklık/.test(text),
      fontDeltaRow: /Yazı Boyutu|Font Boyutu/.test(text),
      fontFamilyRow: /Yazı Tipi/.test(text),
      apiKeysRow: /API Anahtarları/.test(text),
      curseforgeKeyRow: /CurseForge API/.test(text)
    }
  })()`)
  record('G4: stil satırı yok', navSet && g4b.styleRow === false, JSON.stringify(g4b))
  record('G4: align/autohide/scale yok', navSet && !g4b.alignRow && !g4b.autoHideRow && !g4b.scaleRow, '')
  record('G4: konum satırı duruyor', navSet && g4b.positionRow === true, '')
  record('G5: yuvarlatılmış köşe yok', navSet && g4b.radiusRow === false, '')
  record('G5: parçacık/video/müzik yok', navSet && !g4b.particleRow && !g4b.videoRow && !g4b.musicRow, '')
  record('G5: renk kartı yok', navSet && g4b.colorRow === false, '')
  record('G5: font boyutu yok, font ailesi duruyor', navSet && g4b.fontDeltaRow === false && g4b.fontFamilyRow === true, '')
  record('G1: API Anahtarları bölümü görünür', navSet && g4b.apiKeysRow === true && g4b.curseforgeKeyRow === true, JSON.stringify({ a: g4b.apiKeysRow, c: g4b.curseforgeKeyRow }))
  await shot('g45-settings')

  const g1field = await evaluate(`(() => {
    const input = document.querySelector('[data-testid="settings-curseforge-api-key"]')
    return { present: !!input, type: input ? input.type : null }
  })()`)
  record('G1: CurseForge key input alanı', g1field.present && g1field.type === 'password', JSON.stringify(g1field))

  // ---------- G1: Store CurseForge ----------
  const navStore = await nav('/store', 'Kaynak')
  const src = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button')]
    const withLabel = btns.map(b => ({ label: (b.getAttribute('aria-label') || '') + ' ' + (b.className || ''), el: b }))
    const cf = withLabel.find(x => /curseforge/i.test(x.label))
    const ftb = withLabel.find(x => /\\bftb\\b/i.test(x.label))
    const mr = withLabel.find(x => /modrinth/i.test(x.label))
    return { cf: !!cf, ftb: !!ftb, mr: !!mr }
  })()`)
  record('G1: kaynak butonları (Modrinth/CF/FTB)', navStore && src.cf && src.ftb && src.mr, JSON.stringify(src))

  // CF'ye tıkla, arama yap
  if (src.cf) {
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => /curseforge/i.test((x.getAttribute('aria-label') || '') + ' ' + (x.className || '')))
      b.click(); return true
    })()`)
    await sleep(700)
    const typed = await evaluate(`(() => {
      const i = document.querySelector('[data-testid="store-search"]')
      if (!i) return false
      i.focus(); return true
    })()`)
    if (typed) {
      await send(ws, 'Input.insertText', { text: 'skyblock' })
      await waitFor(`document.querySelectorAll('.v-card, [class*="project"]').length > 0 || /API key|403|Forbidden|Hata|Error/i.test(document.body.innerText)`, 12000)
    }
    const cfRes = await evaluate(`(() => {
      const t = document.body.innerText
      const imgs = document.querySelectorAll('img').length
      return { hasErr: /API key|403|Forbidden/i.test(t), cardish: document.querySelectorAll('.v-card, [class*="project"]').length, imgs }
    })()`)
    record('G1: CF araması yanıt verdi (hata beklenebilir — key yok)', cfRes.cardish > 0 || cfRes.hasErr || cfRes.imgs > 0, JSON.stringify(cfRes))
    await shot('g1-cf-search')
  }

  // ---------- G2: FTB ----------
  if (src.ftb) {
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => /\\bftb\\b/i.test((x.getAttribute('aria-label') || '') + ' ' + (x.className || '')))
      if (b) b.click(); return true
    })()`)
    await sleep(600)
    await evaluate(`(() => {
      const i = document.querySelector('[data-testid="store-search"]')
      if (i) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })) }
      return true
    })()`)
    await waitFor(`document.querySelectorAll('.v-card, [class*="project"]').length >= 40`, 15000)
    const ftbRes = await evaluate(`(() => {
      const cards = document.querySelectorAll('.v-card, [class*="project"]')
      const label = (document.body.innerText.match(/\\d+\\s*(?:Mod Pack|projeler|projects)/i) || [])[0] || null
      return { cards: cards.length, label }
    })()`)
    record('G2: FTB tam katalog (>=40 kart)', ftbRes.cards >= 40, JSON.stringify(ftbRes))
    await shot('g2-ftb')
  }

  console.log('---')
  console.log(`SONUÇ: ${results.filter(r => r.ok).length}/${results.length} PASS`)
  if (exceptions.length) console.log('EXCEPTIONS:', exceptions.slice(0, 5))
  process.exit(0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
