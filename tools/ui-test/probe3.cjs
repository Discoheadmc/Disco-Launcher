/* Probe /me render over time after router.push. */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const fs = require('fs')

const PORT = 9777
let id = 0
const pending = new Map()
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

  const route = (p) => evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.\$router.push('${p}')`)
  const snap = () => evaluate(`(() => {
    const panel = document.querySelector('.me-profile-panel')
    return {
      hasPanel: !!panel,
      closet: panel ? panel.innerText.includes('Yerel Gardırop') : false,
      custom: panel ? panel.innerText.includes('Özel Pelerin') : false,
      capeRow: panel ? panel.innerText.includes('Pelerininiz') : false,
      txt: panel ? panel.innerText.slice(0, 400).replace(/\\n/g, ' | ') : '(none)'
    }
  })()`)

  console.log('now at /store, pushing /me...')
  await route('/me')
  for (const ms of [500, 1500, 3000, 5000, 8000]) {
    await sleep(ms)
    const s = await snap()
    console.log(`after +${ms}ms:`, JSON.stringify(s))
  }

  await send(ws, 'Page.captureScreenshot', { format: 'png' }).then((r) => {
    fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '08-me-final.png'), Buffer.from(r.data, 'base64'))
  })
  ws.close()
  process.exit(0)
}
main().catch((e) => { console.error('PROBE ERROR:', e.message); process.exit(1) })
