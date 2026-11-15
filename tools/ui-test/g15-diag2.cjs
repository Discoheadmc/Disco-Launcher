/* FTB-only ve CF-arama durumu teşhisi */
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
  const push = (route) => evaluate(`(async () => {
    const router = document.querySelector('#app').__vue_app__.config.globalProperties.$router
    await router.push('${route}').catch(() => {})
    return router.currentRoute.value.fullPath
  })()`)
  await send(ws, 'Runtime.enable')
  await sleep(800)

  // FTB-only
  console.log('PUSH FTB:', await push('/store?omitSources=modrinth,curseforge'))
  await sleep(12000)
  console.log('FTB-ONLY STATE:', await evaluate(`JSON.stringify({
    hash: location.hash,
    pressed: [...document.querySelectorAll('.source-button')].map(b => b.getAttribute('aria-pressed')).join(','),
    vCard: document.querySelectorAll('.v-card').length,
    project: document.querySelectorAll('[class*="project"]').length,
    img: document.querySelectorAll('img').length,
    storeItem: document.querySelectorAll('.store-project-item, [class*="store-project"]').length,
    grid: document.querySelectorAll('.grid > *').length,
    textHead: document.body.innerText.replace(/\\n+/g, ' | ').slice(0, 500)
  })`))

  // CF-only + native setter ile arama
  console.log('PUSH CF:', await push('/store?omitSources=modrinth,ftb'))
  await sleep(2000)
  const setInput = await evaluate(`(() => {
    const i = document.querySelector('[data-testid="store-search"]')
    if (!i) return 'no-input'
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(i, 'skyblock')
    i.dispatchEvent(new Event('input', { bubbles: true }))
    return 'set:' + i.value
  })()`)
  console.log('SET INPUT:', setInput)
  await sleep(10000)
  console.log('CF-ONLY STATE:', await evaluate(`JSON.stringify({
    hash: location.hash,
    inputValue: (document.querySelector('[data-testid="store-search"]') || {}).value || null,
    vCard: document.querySelectorAll('.v-card').length,
    img: document.querySelectorAll('img').length,
    keyErr: /API key|403|Forbidden|anahtar/i.test(document.body.innerText),
    textHead: document.body.innerText.replace(/\\n+/g, ' | ').slice(0, 500)
  })`))
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
