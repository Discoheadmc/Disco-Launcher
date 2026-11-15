/* DEBUG probe: style tag + inline style + html class + theme.json durumunu adım adım izler */
const fs = require('fs')
const path = require('path')
const os = require('os')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const PORT = 9777
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
  const dump = (label) => evaluate(`(() => {
    const tag = document.getElementById('launch-button-style')
    const b = document.querySelector('.instance-actions-panel .action-btn--primary')
    const cls = document.documentElement.classList.contains('theme-launch-btn-custom')
    return JSON.stringify({ styleTag: tag ? tag.textContent : 'NO-TAG', inline: b ? (b.getAttribute('style') || 'none') : 'NO-BTN', cls, varVal: getComputedStyle(document.documentElement).getPropertyValue('--launch-btn-custom-bg').trim() || '(empty)' })
  })()`).then((v) => console.log('[' + label + ']', v))

  await send(ws, 'Runtime.enable')
  await sleep(800)

  console.log('route:', await evaluate('location.hash'))
  await dump('ACILIS')

  // Home'a git
  await evaluate(`(() => { location.hash = '#/'; return true })()`)
  await sleep(2000)
  await dump('HOME')

  // Settings'e git
  await evaluate(`(() => { location.hash = '#/setting'; return true })()`)
  await sleep(2200)
  await dump('SETTING')

  // Picker'ı aç ve dot durumuna bak
  await evaluate(`(() => { document.body.click(); return true })()`)
  await sleep(300)
  const info = await evaluate(`(() => {
    const d = [...document.querySelectorAll('.color-theme-row .color-button')]
    return JSON.stringify({ count: d.length, dot7: d[7] ? d[7].style.backgroundColor : null, dot7style: d[7] ? (d[7].getAttribute('style') || '') : null })
  })()`)
  console.log('[PICKER-INFO]', info)
  await evaluate(`(() => { const d = [...document.querySelectorAll('.color-theme-row .color-button')]; d[7].click(); return true })()`)
  await sleep(1500)

  // picker state: model value
  const pickerState = await evaluate(`(() => {
    const overlay = document.querySelector('.v-overlay--active')
    const inputs = overlay ? [...overlay.querySelectorAll('input[type=number]')].map(i => i.value) : []
    return JSON.stringify({ overlayOpen: !!overlay, inputs })
  })()`)
  console.log('[PICKER-STATE]', pickerState)

  // Sadece R kanalını 200 yap, adım adım izle
  await evaluate(`(() => {
    const overlay = document.querySelector('.v-overlay--active')
    const input = overlay.querySelector('input[type=number]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '200')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(1200)
  await dump('R=200-SONRASI')
  const themeJson1 = readLaunchColor()
  console.log('[THEME-JSON] after R=200:', themeJson1)

  // G ve B
  const setChan = (idx, val) => evaluate(`(() => {
    const overlay = document.querySelector('.v-overlay--active')
    if (!overlay) return 'closed'
    const input = overlay.querySelectorAll('input[type=number]')[${idx}]
    if (!input) return 'no-input'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '${val}')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return 'ok'
  })()`)
  console.log('G:', await setChan(1, 85))
  await sleep(1200)
  await dump('G=85-SONRASI')
  console.log('B:', await setChan(2, 85))
  await sleep(1200)
  await dump('B=85-SONRASI')
  await sleep(2000)
  console.log('[THEME-JSON] after RGB:', readLaunchColor())

  // Home'a dön
  await evaluate(`(() => { document.body.click(); return true })()`)
  await sleep(400)
  await evaluate(`(() => { location.hash = '#/'; return true })()`)
  await sleep(2000)
  await dump('HOME-SONRASI')
  console.log('[THEME-JSON] final:', readLaunchColor())

  process.exit(0)
}
function readLaunchColor() {
  try {
    const t = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'AppData', 'Roaming', 'Disco Launcher', 'theme.json'), 'utf8'))
    return t.colors ? (t.colors.launchButtonColor === undefined ? 'UNDEFINED' : t.colors.launchButtonColor) : 'NO-COLORS'
  } catch { return 'NO-JSON' }
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
