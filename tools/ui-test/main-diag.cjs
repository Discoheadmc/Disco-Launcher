const path = require('path')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
let id = 0
const pending = new Map()
const consoleLines = []
function send (ws, method, params = {}) {
  const msg = { id: ++id, method, params }
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject })
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 15000)
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
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
      consoleLines.push(`[${msg.params.type}] ${text.slice(0, 250)}`)
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      consoleLines.push(`[EXCEPTION] ${(d.text || '')} ${(d.exception && (d.exception.description || d.exception.value) || '').slice(0, 250)}`)
    }
  })
  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 250))
    return r.result.value
  }
  await send(ws, 'Runtime.enable')

  // 1) What's actually in <main> right now?
  const dom = await evaluate(`(() => {
    const main = document.querySelector('main')
    return {
      hash: location.hash,
      mainChildren: main ? [...main.children].map(c => c.className.slice(0, 60)) : null,
      hasMeLayout: !!document.querySelector('.me-layout'),
      hasPanel: !!document.querySelector('.me-profile-panel'),
      hasStore: !!document.querySelector('.store'),
      vAppCount: document.querySelectorAll('.v-application').length
    }
  })()`)
  console.log('DOM:', JSON.stringify(dom, null, 2))

  // 2) hook router.afterEach and watch for 20s
  await evaluate(`(() => {
    const app = document.querySelector('#app').__vue_app__
    const router = app.config.globalProperties.$router
    window.__navs = []
    router.afterEach((to, from) => window.__navs.push(from.fullPath + ' -> ' + to.fullPath))
  })()`)
  await sleep(20000)
  const navs = await evaluate(`window.__navs`)
  console.log('NAVS in 20s:', JSON.stringify(navs))
  console.log('CONSOLE (last 15):')
  consoleLines.slice(-15).forEach((l) => console.log('  ' + l))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
