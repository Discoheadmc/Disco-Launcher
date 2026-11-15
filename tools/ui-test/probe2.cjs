/* Probe navigation mechanism + real click-based navigation. */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const fs = require('fs')

const PORT = 9777
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 25000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`)
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.on('open', r))
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
    }
  })
  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) return 'EVAL-ERR: ' + JSON.stringify(r.exceptionDetails).slice(0, 300)
    return r.result.value
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')

  console.log('current url:', await evaluate(`location.href`))
  console.log('vue-router present:', await evaluate(`!!document.querySelector('#app').__vue_app__`))

  // Try accessing router via app instance
  const routerInfo = await evaluate(`(() => {
    const app = document.querySelector('#app').__vue_app__
    if (!app) return 'no app'
    const router = app.config.globalProperties.\$router
    if (!router) return 'no router on globalProperties'
    return 'router found, current: ' + router.currentRoute.value.fullPath
  })()`)
  console.log('router probe:', routerInfo)

  if (String(routerInfo).startsWith('router found')) {
    await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.\$router.push('/me')`)
    await sleep(2200)
    const meState = await evaluate(`(() => {
      const panel = document.querySelector('.me-profile-panel')
      return {
        path: document.querySelector('#app').__vue_app__.config.globalProperties.\$router.currentRoute.value.fullPath,
        hasPanel: !!panel,
        hasCloset: panel ? panel.innerText.includes('Yerel Gardırop') : false,
        hasCustom: panel ? panel.innerText.includes('Özel Pelerin') : false,
        text: panel ? panel.innerText.slice(0, 300).replace(/\\n/g, ' | ') : '(no panel)'
      }
    })()`)
    console.log('=== /me via router.push ===')
    console.log(JSON.stringify(meState, null, 2))

    // store
    await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.\$router.push('/store')`)
    await sleep(9000)
    const storeState = await evaluate(`(() => ({
      path: document.querySelector('#app').__vue_app__.config.globalProperties.\$router.currentRoute.value.fullPath,
      search: !!document.querySelector('[data-testid=store-search]'),
      headings: [...document.querySelectorAll('h2')].map(h => h.innerText.trim()).slice(0, 5),
      cards: document.querySelectorAll('.store-entry article, .store-entry .v-card').length,
      content: document.querySelector('#store-content') ? document.querySelector('#store-content').innerText.slice(0, 250).replace(/\\n/g, ' | ') : '(no #store-content)'
    }))()`)
    console.log('=== /store via router.push (9s wait) ===')
    console.log(JSON.stringify(storeState, null, 2))

    await send(ws, 'Page.captureScreenshot', { format: 'png' }).then((r) => {
      fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '07-store-real.png'), Buffer.from(r.data, 'base64'))
    })
  }

  ws.close()
  process.exit(0)
}
main().catch((e) => { console.error('PROBE ERROR:', e.message); process.exit(1) })
