/* Probe live UI state for the two failing checks. */
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
    if (r.exceptionDetails) return 'EVAL-ERR: ' + JSON.stringify(r.exceptionDetails).slice(0, 200)
    return r.result.value
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')

  // --- /me probe ---
  await evaluate(`location.hash = '#/me'`)
  await sleep(2500)
  const meText = await evaluate(`document.body.innerText`)
  const meProbe = await evaluate(`(() => {
    const panel = document.querySelector('.me-profile-panel') || document.body
    return {
      hasCustomTr: panel.innerText.includes('Özel Pelerin'),
      hasCloset: panel.innerText.includes('Yerel Gardırop'),
      buttons: [...document.querySelectorAll('.me-profile-panel button')].map(b => b.innerText.trim()).filter(Boolean).slice(0, 12),
      sample: panel.innerText.slice(0, 700).replace(/\\n/g, ' | ')
    }
  })()`)
  console.log('=== /me probe ===')
  console.log(JSON.stringify(meProbe, null, 2))

  // --- /store probe with long wait ---
  await evaluate(`location.hash = '#/store'`)
  await sleep(9000)
  const storeProbe = await evaluate(`(() => ({
    url: location.hash,
    search: !!document.querySelector('[data-testid=store-search]'),
    headings: [...document.querySelectorAll('h2')].map(h => h.innerText.trim()).slice(0, 6),
    cards: document.querySelectorAll('.store-entry .v-card, .store-entry article').length,
    textSample: document.querySelector('#store-content') ? document.querySelector('#store-content').innerText.slice(0, 300).replace(/\\n/g, ' | ') : '(no #store-content)',
    bodySample: document.body.innerText.slice(0, 350).replace(/\\n/g, ' | ')
  }))()`)
  console.log('=== /store probe (after 9s) ===')
  console.log(JSON.stringify(storeProbe, null, 2))

  await send(ws, 'Page.captureScreenshot', { format: 'png' }).then((r) => {
    fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '06-store-loaded.png'), Buffer.from(r.data, 'base64'))
  })

  ws.close()
  process.exit(0)
}
main().catch((e) => { console.error('PROBE ERROR:', e.message); process.exit(1) })
