/**
 * E2E: select the cape-e2e instance in the sidebar menu and click launch.
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

  // Open the instance menu and pick cape-e2e.
  await evalIn(call, `document.querySelector('[data-testid="sidebar-instance-menu-button"]').click()`)
  await sleep(1000)
  const picked = await evalIn(call, `(function(){
    var items = Array.from(document.querySelectorAll('.v-list-item'))
    var target = items.find(function(i){ return (i.textContent||'').indexOf('cape-e2e')>=0 })
    if (!target) return 'missing'
    target.click()
    return 'clicked'
  })()`)
  console.log('select cape-e2e:', picked)
  await sleep(1500)

  const header = await evalIn(call, `(function(){
    var el = document.querySelector('.header-primary-row .home-title')
    return el ? el.textContent : 'unknown'
  })()`)
  console.log('selected instance (header):', header)

  if (String(header).indexOf('cape-e2e') < 0) {
    console.log('ERROR: cape-e2e not selected, aborting launch')
    process.exit(2)
  }

  await evalIn(call, `document.querySelector('[data-testid="launch-button"]').click()`)
  console.log('launch clicked for cape-e2e')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
