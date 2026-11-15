const path = require('path')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))

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

async function main() {
  const targets = await getTargets()
  const page = targets.find((t) => t.type === 'page')
  const { call } = await connect(page.webSocketDebuggerUrl)
  await call('Runtime.evaluate', { expression: `document.querySelector('[data-testid="sidebar-instance-menu-button"]').click()`, returnByValue: true })
  await new Promise((r) => setTimeout(r, 1200))
  const r = await call('Runtime.evaluate', {
    expression: `(function(){
      var items = Array.from(document.querySelectorAll('.v-list-item')).map(function(i){ return (i.textContent||'').trim().slice(0,30) })
      var overlays = document.querySelectorAll('.v-overlay--active').length
      var menus = document.querySelectorAll('.v-menu > .v-overlay').length
      return JSON.stringify({ overlays: overlays, menus: menus, items: items.slice(0, 25) })
    })()`,
    returnByValue: true,
  })
  console.log(r.result.result.value)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
