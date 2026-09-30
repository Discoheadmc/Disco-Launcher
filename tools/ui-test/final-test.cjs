/* Disco Launcher — final comprehensive smoke test (new + old features) over CDP. */
const fs = require('fs')
const path = require('path')
const http = require('http')
const os = require('os')
const { execFileSync } = require('child_process')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))

const PORT = 9777
const OUT = path.join(__dirname, 'artifacts')
const SHOTS = path.join(OUT, 'shots')
fs.mkdirSync(SHOTS, { recursive: true })

let id = 0
const pending = new Map()

function getJson (url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
}

function send (ws, method, params = {}) {
  const msg = { id: ++id, method, params }
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(msg.id)) {
        pending.delete(msg.id)
        reject(new Error('CDP timeout: ' + method))
      }
    }, 25000)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const poll = async (evaluate, expr, timeout = 10000, step = 400) => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (await evaluate(expr)) return true
    await sleep(step)
  }
  return await evaluate(expr)
}

// ---- Process-level CPU/RAM sampling (all "Disco Launcher" processes) ----
let lastSample = null
function sampleProc () {
  // NOTE: Turkish locale formats doubles with comma; force invariant culture for CPU, output raw bytes for RAM.
  const script = "$ErrorActionPreference='SilentlyContinue'; Get-Process 'Disco Launcher' | ForEach-Object { \"{0}|{1}|{2}\" -f $_.Id, $_.WorkingSet64, ([double]$_.CPU).ToString([System.Globalization.CultureInfo]::InvariantCulture) }"
  let out = ''
  try {
    out = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8', timeout: 15000 })
  } catch (e) { return null }
  const procs = out.split('\n').map((l) => l.trim()).filter((l) => l.includes('|')).map((l) => {
    const [pidS, wsS, cpuS] = l.split('|')
    return { pid: +pidS, wsMB: +(parseInt(wsS, 10) / 1048576).toFixed(1), cpuS: parseFloat(cpuS) }
  }).filter((p) => !isNaN(p.pid) && !isNaN(p.wsMB))
  const now = Date.now()
  const ramMB = procs.reduce((a, p) => a + p.wsMB, 0)
  const cpuTotal = procs.reduce((a, p) => a + p.cpuS, 0)
  let cpuPct = null
  if (lastSample && now > lastSample.t) {
    const wall = (now - lastSample.t) / 1000
    cpuPct = ((cpuTotal - lastSample.cpu) / wall / os.cpus().length) * 100
  }
  lastSample = { t: now, cpu: cpuTotal }
  return { procs: procs.length, ramMB: +ramMB.toFixed(1), cpuPct: cpuPct === null ? null : +cpuPct.toFixed(1) }
}

async function main () {
  const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`)
  const page = targets.find((t) => t.type === 'page' && t.url.includes('disco.runtime'))
  if (!page) throw new Error('launcher page not found')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.on('open', r))

  const logs = []
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p.reject(new Error(msg.error.message))
      else p.resolve(msg.result)
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
      logs.push(`[${msg.params.type}] ${text.slice(0, 300)}`)
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      logs.push(`[EXCEPTION] ${(d.text || '')} ${(d.exception && (d.exception.description || d.exception.value) || '').slice(0, 300)}`)
    }
  })

  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }

  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Performance.enable') // required for getMetrics to report real values
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false })
  // Temiz durum: sayfayı yenile (kullanıcının o anki pencere etkileşimi / takılı router geçişini sıfırla)
  await send(ws, 'Page.reload')
  await sleep(8000)

  const shot = async (name) => {
    const r = await send(ws, 'Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'))
  }
  const router = `document.querySelector('#app').__vue_app__.config.globalProperties.$router`
  const go = (r) => evaluate(`${router}.push('${r}')`)
  const bodyText = () => evaluate(`document.body.innerText`)
  // Türkçe büyük İ/Ö/Ü NFD'de birleşik işaretlere ayrılır; tamamını temizle, ibreleri de normalize et.
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail: String(detail).slice(0, 240) })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
  }
  const procSamples = []
  const sample = (label) => { const s = sampleProc(); if (s) procSamples.push({ label, ...s }) }

  // ================= T0: boot =================
  sample('boot')
  const m = await send(ws, 'Performance.getMetrics')
  const get = (n) => { const f = m.metrics.find((x) => x.name === n); return f ? f.value : -1 }
  const heapBoot = +(get('JSHeapUsedSize') / 1048576).toFixed(1)
  record('Açılışta renderer hatasız', logs.filter((l) => l.startsWith('[EXCEPTION]')).length === 0, 'exception sayısı: ' + logs.filter((l) => l.startsWith('[EXCEPTION]')).length)
  record('Renderer JS heap (boot) < 400MB', heapBoot > 0 && heapBoot < 400, heapBoot + ' MB, DOM: ' + get('Nodes') + ' node')

  // ================= T1: Me paneli (yeni özellikler) =================
  await go('/me')
  const panelMounted = await poll(evaluate, `!!document.querySelector('.me-profile-panel')`, 10000)
  await sleep(1500) // skin render + servis durumu
  const meText = await bodyText()
  record('Me paneli render', meText.length > 100, meText.replace(/\n/g, ' | ').slice(0, 120))
  record('Yerel Gardırop butonu', norm(meText).includes(norm('gardırop')), '')
  record('Resmi pelerin satırı (Mojang)', norm(meText).includes(norm('pelerin')), '')
  record('Özel Pelerin bölümü (yeni)', norm(meText).includes(norm('özel pelerin')), '')
  record('PNG Seç / Değiştir butonu (yeni)', norm(meText).includes(norm('png seç')) || norm(meText).includes(norm('değiştir')), '')
  await shot('01-me-profile')
  await shot('02-me-custom-cape')

  // ================= T2: Gardırop diyaloğu aç/kapa =================
  const openRes = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /gardırop/i.test(x.innerText))
    if (!b) return 'NO_BTN'
    b.click()
    return 'CLICKED'
  })()`)
  await sleep(1000)
  const dlgOpen = await poll(evaluate, `!!document.querySelector('.v-overlay--active, [role=dialog]')`, 6000)
  const dlgText = await evaluate(`(() => {
    const ov = document.querySelector('.v-overlay--active, .v-dialog--active, [role=dialog]')
    return ov ? ov.innerText.slice(0, 300) : null
  })()`)
  record('Gardırop diyaloğu açılıyor', openRes === 'CLICKED' && !!dlgText && dlgOpen, (dlgText || openRes || '').replace(/\n/g, ' | ').slice(0, 100))
  await shot('03-closet-dialog')
  // kapat (X butonu, yoksa ESC)
  const closed = await evaluate(`(() => {
    const ov = document.querySelector('.v-overlay--active, [role=dialog]')
    if (!ov) return 'ALREADY_GONE'
    const btn = [...ov.querySelectorAll('button')].find(b => /close|kapat/i.test(b.className + ' ' + b.getAttribute('aria-label') + ' ' + b.innerText))
    if (btn) { btn.click(); return 'CLICKED_X' }
    return 'NO_X'
  })()`)
  if (closed === 'NO_X') {
    await send(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await send(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  }
  await sleep(500)
  const dlgGone = await poll(evaluate, `(() => {
    const ovs = [...document.querySelectorAll('.v-overlay--active, [role=dialog]')]
    return ovs.length === 0 || !ovs.some(o => /cilt|skin|gardırop/i.test(o.innerText))
  })()`, 6000)
  record('Gardırop diyaloğu kapanıyor', !!dlgGone, closed)

  // ================= T3: Store (trending kaldırıldı) =================
  await go('/store')
  await sleep(4000)
  // store kartları network fetch'e bağlı — göründüğüne kadar bekle (en fazla 12s daha)
  await evaluate(`new Promise((res) => {
    const t0 = Date.now()
    const iv = setInterval(() => {
      const t = document.body.innerText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      if ((t.includes('keşfet') || t.includes('proje')) && document.querySelectorAll('.v-card').length > 2) { clearInterval(iv); res(true) }
      else if (Date.now() - t0 > 12000) { clearInterval(iv); res(false) }
    }, 500)
  })`)
  const store = await evaluate(`(() => {
    const txt = document.body.innerText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    return {
      trending: txt.includes('trend'),
      search: !!document.querySelector('input[type=text], input:not([type])'),
      discover: txt.includes('kesfet') || txt.includes('proje'),
      version: txt.includes('surum')
    }
  })()`)
  record('Store: Trend Olan kaldırıldı (yeni)', store.trending === false, 'trending bulundu: ' + store.trending)
  record('Store: arama + keşfet render', store.search && store.discover, JSON.stringify(store))
  await shot('04-store')

  // arama alanına yazma (eski özellik)
  const typed = await evaluate(`(() => {
    const inp = document.querySelector('input[type=text], input:not([type])')
    if (!inp) return false
    inp.focus()
    return document.activeElement === inp
  })()`)
  record('Store: arama input odaklanabilir (eski)', !!typed, '')
  sample('store-loaded')

  // ================= T4: Settings =================
  await go('/setting')
  await poll(evaluate, `document.body.innerText.length > 100`, 8000)
  const setText = await bodyText()
  record('Ayarlar ekranı render (eski)', setText.length > 100, setText.replace(/\n/g, ' | ').slice(0, 100))
  await shot('05-settings')

  // ================= T5: Home =================
  await go('/')
  await sleep(1500)
  await poll(evaluate, `document.body.innerText.length > 50`, 8000)
  const homeText = await bodyText()
  record('Ana ekran render (eski)', homeText.length > 50, homeText.replace(/\n/g, ' | ').slice(0, 100))
  await shot('06-home')
  sample('after-views')
  await sleep(1500)
  sample('cpu-window-views')

  // ================= T6: hızlı rota stresi + sızıntı =================
  const routes = ['/', '/me', '/store', '/setting', '/me', '/', '/store', '/me']
  for (const r of routes) { await go(r); await sleep(450) }
  await sleep(2000)
  const m2 = await send(ws, 'Performance.getMetrics')
  const get2 = (n) => { const f = m2.metrics.find((x) => x.name === n); return f ? f.value : -1 }
  const heapAfter = +(get2('JSHeapUsedSize') / 1048576).toFixed(1)
  const grow = +(heapAfter - heapBoot).toFixed(1)
  record('Rota stresi sonrası heap büyümesi < 60MB', Math.abs(grow) < 60, heapBoot + ' -> ' + heapAfter + ' MB (' + (grow > 0 ? '+' : '') + grow + ')')
  record('Stres sonrası exception yok', logs.filter((l) => l.startsWith('[EXCEPTION]')).length === 0, logs.filter((l) => l.startsWith('[EXCEPTION]')).length + ' exception')
  await shot('07-after-stress')
  sample('after-stress')

  // ================= T7: süreç ölçümleri =================
  const lastProc = procSamples[procSamples.length - 1]
  record('Toplam RAM < 900MB', lastProc && lastProc.ramMB < 900, lastProc ? lastProc.ramMB + ' MB (' + lastProc.procs + ' süreç)' : 'ölçülemedi')
  if (lastProc && lastProc.cpuPct !== null) {
    record('Gezinme sırasında CPU < %25', lastProc.cpuPct < 25, 'CPU %' + lastProc.cpuPct)
  }

  // ================= kaydet =================
  fs.writeFileSync(path.join(OUT, 'final-results.json'), JSON.stringify({ results, procSamples, heapBoot, heapAfter }, null, 2))
  fs.writeFileSync(path.join(OUT, 'final-console.txt'), logs.join('\n'))
  console.log('\nPROCESS SAMPLES: ' + JSON.stringify(procSamples))
  console.log('SUMMARY: ' + results.filter((r) => r.ok).length + '/' + results.length + ' passed')
  ws.close()
  process.exit(0)
}

main().catch((e) => { console.error('DRIVER ERROR:', e.message); process.exit(1) })
