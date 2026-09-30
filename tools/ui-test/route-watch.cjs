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
    }
  })
  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 200))
    return r.result.value
  }
  console.log('start hash:', await evaluate(`location.hash`))
  await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  for (let i = 1; i <= 12; i++) {
    await sleep(500)
    const h = await evaluate(`location.hash + ' || panel=' + !!document.querySelector('.me-profile-panel')`)
    console.log(`+${i * 500}ms:`, h)
    if (h.includes('/me') && i * 500 > 4000) break
  }
  // sonra hash'e tekrar /me push edip panel metnine bak
  const panelText = await evaluate(`(() => { const p = document.querySelector('.me-profile-panel'); return p ? p.innerText.slice(0, 600) : 'NO PANEL' })()`)
  console.log('PANEL:', JSON.stringify(panelText))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
