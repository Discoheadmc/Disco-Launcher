/* Mevcut durumu yaz: route + view + console hataları */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
let id = 0
const pending = new Map()
const logs = []
function send (ws, method, params = {}) {
  const msg = { id: ++id, method, params }
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject })
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('to ' + method)) } }, 25000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function getJson (url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.on('error', reject)
  })
}
async function waitCdp (maxSec = 60) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxSec * 1000) {
    try { return await getJson('http://127.0.0.1:9777/json/list') } catch { await sleep(2000) }
  }
  throw new Error('CDP unreachable')
}
async function main () {
  const targets = await waitCdp()
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
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      logs.push('[EXC] ' + (d.text || '') + ' ' + ((d.exception && d.exception.description) || '').slice(0, 200))
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      logs.push('[ERR] ' + (msg.params.args || []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200))
    }
  })
  await send(ws, 'Runtime.enable')
  await sleep(2000)
  const hash = await send(ws, 'Runtime.evaluate', { expression: 'location.hash', returnByValue: true })
  console.log('hash:', hash.result.value)
  await send(ws, 'Runtime.evaluate', { expression: `document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')` })
  await sleep(6000)
  const dom = await send(ws, 'Runtime.evaluate', { expression: `JSON.stringify({
    hash: location.hash,
    panel: !!document.querySelector('.me-profile-panel'),
    mainChild: (document.querySelector('main') && document.querySelector('main').firstElementChild && document.querySelector('main').firstElementChild.className.slice(0, 50)) || 'none',
    btns: [...document.querySelectorAll('button')].length
  })`, returnByValue: true })
  console.log('DOM:', dom.result.value)
  console.log('LOGS (last 8):')
  logs.slice(-8).forEach(l => console.log('  ' + l))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
