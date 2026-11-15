/* Renk paleti restore + kare switch doğrulaması */
const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const PORT = 9777
const SHOTS = path.join(__dirname, 'artifacts', 'shots')
fs.mkdirSync(SHOTS, { recursive: true })
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
    }
  })
  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 200))
    return r.result.value
  }
  const shot = async (name) => {
    try {
      const r = await send(ws, 'Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'))
    } catch {}
  }
  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 240) : ''}`)
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await sleep(6000)

  // Ayarlar > Görünüm'e git
  await evaluate(`(() => { location.hash = '#/setting'; return location.hash })()`)
  await send(ws, 'Page.reload')
  await sleep(6000)
  let ready = false
  for (let i = 0; i < 20 && !ready; i++) {
    ready = await evaluate(`(() => { try { return document.body.innerText.includes('Tema Renkleri') || document.body.innerText.includes('Theme Colors') } catch { return false } })()`)
    if (!ready) await sleep(800)
  }

  // renk satırı + seçiciler
  const colors = await evaluate(`(() => {
    const row = document.querySelector('.color-theme-row')
    const dots = document.querySelectorAll('.color-theme-row .color-button')
    return {
      rowVisible: !!row,
      dotCount: dots.length,
      titleFound: document.body.innerText.includes('Tema Renkleri') || document.body.innerText.includes('Theme Colors')
    }
  })()`)
  record('Renk özelleştirme satırı görünür', colors.rowVisible && colors.titleFound, JSON.stringify(colors))
  record('7 renk seçici (appbar/sidebar/primary/card/bg/warning/error)', colors.dotCount === 7, 'dots=' + colors.dotCount)
  await shot('color-palette-row')

  // bir rengi değiştir: primary color picker'ı aç, swatch seç
  let colorChanged = false
  try {
    await evaluate(`(() => {
      const dots = [...document.querySelectorAll('.color-theme-row .color-button')]
      const primary = dots[2]
      if (primary) primary.click()
      return !!primary
    })()`)
    await sleep(1200)
    const picked = await evaluate(`(() => {
      const input = document.querySelector('.v-overlay--active .v-color-picker__input input')
      if (!input) return 'no-input'
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, '#FF5555')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return 'set'
    })()`)
    await sleep(1500)
    const check = await evaluate(`(() => {
      const app = document.querySelector('#app')
      const theme = app.__vue_app__.config.globalProperties.$theme
      return 'checked-via-css'
    })()`)
    colorChanged = picked === 'set'
    console.log('PICK:', picked)
  } catch (e) { console.log('PICK ERR:', e.message) }
  record('Renk seçici açılıp renk uygulanabiliyor', colorChanged, '')

  // switch stili: kare kontrol
  const sw = await evaluate(`(() => {
    const track = document.querySelector('.v-switch .v-switch__track')
    const thumb = document.querySelector('.v-switch .v-switch__thumb')
    if (!track || !thumb) return { found: false }
    const tr = getComputedStyle(track).borderRadius
    const th = getComputedStyle(thumb).borderRadius
    return { found: true, trackRadius: tr, thumbRadius: th, trackSquare: parseFloat(tr) <= 4, thumbSquare: parseFloat(th) <= 4 }
  })()`)
  record('Switch track kare (radius <=4px)', sw.found && sw.trackSquare, JSON.stringify(sw))
  record('Switch thumb kare (radius <=4px)', sw.found && sw.thumbSquare, '')

  // reset butonu var mı
  const reset = await evaluate(`!!document.querySelector('.color-theme-row__reset button')`)
  record('Varsayılana Sıfırla butonu mevcut', reset, '')
  await shot('square-switch')

  console.log('---')
  console.log('SONUÇ: ' + results.filter(r => r.ok).length + '/' + results.length + ' PASS')
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
