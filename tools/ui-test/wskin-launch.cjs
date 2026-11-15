/**
 * E2E: trigger the launch of the currently selected instance (cape-e2e)
 * by clicking the home launch button.
 */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9777/json/list', (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    let id = 0
    const pending = new Map()
    ws.on('message', (m) => {
      const msg = JSON.parse(m)
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    })
    const call = (method, params = {}) => new Promise((res) => {
      id += 1
      pending.set(id, res)
      ws.send(JSON.stringify({ id, method, params }))
    })
    ws.on('open', () => resolve({ call }))
    ws.on('error', reject)
  })
}

async function evalIn(call, expr) {
  const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  const res = r.result && r.result.result
  return res ? res.value : undefined
}

async function main() {
  const targets = await getTargets()
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  const { call } = await connect(page.webSocketDebuggerUrl)

  // Ensure home route.
  for (let i = 0; i < 30; i++) {
    const state = await evalIn(call, `(function(){
      var el = document.querySelector('#app')
      if (!el || !el.__vue_app__) return 'noapp'
      var router = el.__vue_app__.config.globalProperties.$router
      if (!router) return 'norouter'
      if (router.currentRoute.value.path !== '/') { router.push('/'); return 'pushing' }
      return 'home'
    })()`)
    if (state === 'home') break
    await sleep(500)
  }
  await sleep(1000)

  const header = await evalIn(call, `(function(){
    var el = document.querySelector('.header-primary-row .home-title')
    return el ? el.textContent : 'unknown'
  })()`)
  console.log('selected instance (header):', header)

  const btn = await evalIn(call, `(function(){
    var el = document.querySelector('[data-testid="launch-button"]')
    if (!el) return 'missing'
    el.click()
    return 'clicked'
  })()`)
  console.log('launch button:', btn)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
