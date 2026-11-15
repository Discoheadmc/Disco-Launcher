/**
 * E2E: create a fabric instance with the WSkinLoader opt-in checked.
 * Steps: router -> '/', open add-instance dialog, name, pick Fabric loader,
 * check [data-testid=add-instance-wskinloader], create, then verify.
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
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
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
  const details = r.result && (r.result.exceptionDetails || (r.result.result && r.result.result.exceptionDetails))
  if (details) {
    throw new Error('page eval failed: ' + JSON.stringify(details).slice(0, 400))
  }
  const res = r.result && r.result.result
  if (res && res.subtype === 'error') {
    throw new Error('page eval error: ' + String(res.description).slice(0, 300))
  }
  return res ? res.value : undefined
}

async function main() {
  const targets = await getTargets()
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  const { call } = await connect(page.webSocketDebuggerUrl)
  await call('Runtime.enable')

  // Wait for hydration, then force route to home.
  let onHome = false
  for (let i = 0; i < 60; i++) {
    try {
      onHome = await evalIn(call, `(function(){
        var el = document.querySelector('#app')
        if (!el || !el.__vue_app__) return 'noapp'
        var router = el.__vue_app__.config.globalProperties.$router
        if (!router) return 'norouter'
        if (router.currentRoute.value.path !== '/') { router.push('/'); return 'pushing' }
        return 'home'
      })()`)
      if (onHome === 'home') break
    } catch (e) {
      console.log('wait:', String(e).slice(0, 120))
    }
    await sleep(500)
  }
  console.log('route:', onHome, 'url:', await evalIn(call, 'location.href'))
  await sleep(1500)

  // Open the add-instance dialog via the dialog broadcast channel (the
  // dialog model listens on it — the same pathway a second window uses).
  const nav = await evalIn(call, `(function(){
    var ch = new BroadcastChannel('dialog')
    ch.postMessage({ dialog: 'add-instance-dialog' })
    return 'posted'
  })()`)
  console.log('dialog open:', nav)
  await sleep(1500)

  const dlgOpen = await evalIn(call, `!!document.querySelector('[data-testid="add-instance-dialog"]')`)
  console.log('dialog present:', dlgOpen)

  // Fill name.
  const nameSet = await evalIn(call, `(function(){
    var el = document.querySelector('[data-testid="add-instance-name"] input')
    if (!el) return 'missing'
    var setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
    setter.call(el, 'cape-e2e')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return 'ok'
  })()`)
  console.log('name:', nameSet)

  // Pick Fabric loader tile.
  const fabric = await evalIn(call, `(function(){
    var el = document.querySelector('[data-testid="modloader-tab-fabric"]')
    if (!el) return 'missing'
    el.click()
    return 'clicked'
  })()`)
  console.log('fabric tile:', fabric)
  await sleep(1000)

  // Check the WSkinLoader toggle.
  const toggle = await evalIn(call, `(function(){
    var box = document.querySelector('[data-testid="add-instance-wskinloader"] input[type=checkbox]')
    if (!box) return 'missing'
    if (!box.checked) box.click()
    return box.checked ? 'checked' : 'click-failed'
  })()`)
  console.log('wskinloader toggle:', toggle)
  await sleep(500)

  // Create.
  await evalIn(call, `document.querySelector('[data-testid="add-instance-create"]').click()`)
  console.log('create clicked')
  await sleep(6000)

  const header = await evalIn(call, `(function(){
    var el = document.querySelector('.header-primary-row .home-title')
    return el ? el.textContent : (document.querySelector('.home-title') ? document.querySelector('.home-title').textContent : 'unknown')
  })()`)
  console.log('header title after create:', header)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
