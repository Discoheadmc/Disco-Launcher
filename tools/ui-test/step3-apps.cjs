/* Tüm Vue app'lerini bul: Teleport/overlay ayrı app olabilir */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
let id = 0
const pending = new Map()
function send (ws, method, params = {}) {
  const msg = { id: ++id, method, params }
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject })
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('to ' + method)) } }, 25000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main () {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9777/json/list', (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
  const page = targets.find((t) => t.type === 'page' && t.url.includes('disco.runtime'))
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
  const ev = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }
  await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  await sleep(3000)
  await ev(`(() => { const p = document.querySelector('.me-profile-panel'); const b = [...p.querySelectorAll('button')].find(x => /gardırop/i.test(x.innerText)); if (b) b.click(); return 1 })()`)
  await sleep(3500)

  const state = await ev(`(() => {
    // Tüm elemanlarda __vue_app__ ara (teleport hedefleri ayrı app mount etmez ama kontrol edelim)
    const apps = []
    for (const el of document.querySelectorAll('*')) {
      if (el.__vue_app__ && !apps.includes(el.__vue_app__)) apps.push(el.__vue_app__)
    }
    const out = { appCount: apps.length, apps: [] }
    apps.forEach((app, i) => {
      const info = { i, container: app._container && (app._container.id || app._container.className || 'el'), hasInstance: !!app._instance }
      out.apps.push(info)
    })
    // #app._instance neden yok? _context üzerinden root bulmayı dene
    const app = apps[0]
    const ctx = app && app._context
    if (ctx) {
      out.ctxKeys = Object.keys(ctx).slice(0, 12)
      // config.globalProperties.$root?
      const gp = ctx.config && ctx.config.globalProperties
      out.gpKeys = gp ? Object.keys(gp).slice(0, 12) : null
    }
    return out
  })()`)
  console.log(JSON.stringify(state, null, 2))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
