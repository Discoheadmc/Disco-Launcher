/* Konsol + exception yakalama: sayfayı reload edip çıkan hataları listeler */
const http = require('http')
const path = require('path')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const PORT = parseInt(process.env.CDP_PORT || '9777', 10)
let id = 0
const pending = new Map()
const events = []
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 20000)
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
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type
      const text = msg.params.args.map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ')
      events.push('[' + type + '] ' + text.slice(0, 250))
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      events.push('[EXCEPTION] ' + ((d.exception && d.exception.description) || d.text).slice(0, 400))
    }
  })
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  // Önce Home'a git (iki adımlı), sonra oradan reload et
  await send(ws, 'Runtime.evaluate', { expression: "location.hash='#/'" })
  await sleep(2500)
  events.length = 0
  await send(ws, 'Page.reload')
  await sleep(6000)
  const errors = events.filter((e) => e.startsWith('[error]') || e.startsWith('[EXCEPTION]') || e.includes('warn'))
  console.log('TOPLAM event:', events.length)
  console.log('--- HATALAR ---')
  errors.slice(0, 30).forEach((e) => console.log(e))
  console.log('--- SON 10 EVENT ---')
  events.slice(-10).forEach((e) => console.log(e))
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
