/* Renk seçici menüsü teşhisi */
const path = require('path')
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
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 200))
    return r.result.value
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await evaluate(`(() => { location.hash = '#/setting'; return location.hash })()`)
  await send(ws, 'Page.reload')
  await sleep(6000)
  await sleep(1000)

  // renk noktasına tıkla
  const clicked = await evaluate(`(() => {
    const dots = [...document.querySelectorAll('.color-theme-row .color-button')]
    if (!dots.length) return 'no-dots (ayarlar sayfasında mıyız? hash=' + location.hash + ')'
    dots[2].click()
    return 'clicked'
  })()`)
  console.log('CLICK:', clicked)
  await sleep(2000)
  const overlay = await evaluate(`(() => {
    const overlays = [...document.querySelectorAll('.v-overlay--active, .v-menu > .v-overlay__content')]
    const visible = overlays.find(o => o.getBoundingClientRect().height > 30)
    if (!visible) return 'no-visible-overlay; count=' + overlays.length
    const picker = visible.querySelector('.v-color-picker')
    const inputs = [...visible.querySelectorAll('input')].map(i => ({ cls: i.className.slice(0, 60), type: i.type, val: (i.value || '').slice(0, 12) }))
    const swatches = visible.querySelectorAll('.v-color-picker__swatch').length
    return { hasPicker: !!picker, inputs, swatches, html: picker ? picker.outerHTML.slice(0, 100) : visible.outerHTML.slice(0, 200) }
  })()`)
  console.log('OVERLAY:', JSON.stringify(overlay).slice(0, 600))
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
