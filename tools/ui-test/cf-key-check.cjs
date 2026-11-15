/* CF key giriş durumu kontrolü — değer GÖSTERİLMEZ, sadece uzunluk */
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
  let targets
  try { targets = await getJson(`http://127.0.0.1:${PORT}/json/list`) } catch { console.log('APP NOT RUNNING'); process.exit(0) }
  const page = targets.find((t) => t.type === 'page' && t.url.includes('disco.runtime'))
  if (!page) { console.log('PAGE NOT FOUND'); process.exit(0) }
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
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 150))
    return r.result.value
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  // hash'i setting yap ve reload — doğrudan Ayarlar'da açılır
  await evaluate(`(() => { location.hash = '#/setting'; return location.hash })()`)
  await send(ws, 'Page.reload')
  await sleep(6000)
  let fieldReady = false
  for (let i = 0; i < 20 && !fieldReady; i++) {
    fieldReady = await evaluate(`!!document.querySelector('[data-testid="settings-curseforge-api-key"]')`)
    if (!fieldReady) await sleep(700)
  }
  if (!fieldReady) {
    const dump = await evaluate(`location.hash + ' ||| ' + document.body.innerText.replace(/\\n+/g, ' | ').slice(0, 300)`)
    console.log('FIELD NOT FOUND. DUMP:', dump)
    process.exit(0)
  }
  const state = await evaluate(`(() => {
    const el = document.querySelector('[data-testid="settings-curseforge-api-key"]')
    if (!el) return { field: false }
    const input = el.tagName === 'INPUT' ? el : el.querySelector('input')
    if (input) input.focus()
    const v = input ? input.value : ''
    return { field: true, len: v.length, focused: document.activeElement === input }
  })()`)
  console.log('STATE:', JSON.stringify(state))
  try { await send(ws, 'Page.bringToFront') } catch {}
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
