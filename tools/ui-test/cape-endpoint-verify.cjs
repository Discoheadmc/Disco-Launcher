/* Cape endpoint doğrulaması: servisi oluştur, endpoint durum kodlarını ölç */
const path = require('path')
const fs = require('fs')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
let id = 0
const pending = new Map()
function send (ws, method, params = {}) {
  const msg = { id: ++id, method, params }
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject })
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('to ' + method)) } }, 30000)
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
function httpStatus (url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 5000 }, (res) => { res.resume(); resolve(res.statusCode) })
    req.on('timeout', () => { req.destroy(); resolve(0) })
    req.on('error', () => resolve(0))
  })
}
async function main () {
  const targets = await getJson('http://127.0.0.1:9777/json/list')
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
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }
  // /me ekranına git → MeProfilePanel useUserCape() → LocalCapeService oluşur
  for (let i = 0; i < 6; i++) {
    await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me').catch(() => {})`)
    await sleep(2000)
    const h = await ev(`location.hash`)
    if (h.includes('me')) break
  }
  await sleep(4000)

  const port = process.env.CAPE_PORT || 25555
  const noAccount = await httpStatus(`http://localhost:${port}/disco/cape`)
  const bogus = await httpStatus(`http://localhost:${port}/disco/cape?account=none:none`)
  console.log(JSON.stringify({ noAccount, bogus }))
  console.log(noAccount === 400 && bogus === 404 ? 'ENDPOINT OK' : 'ENDPOINT MISMATCH (expected 400/404)')
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
