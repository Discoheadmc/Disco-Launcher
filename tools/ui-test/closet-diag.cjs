/* Diagnose closet dialog open: click via JS .click() instead of synthetic mouse. */
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
  await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.\$router.push('/me')`)
  await sleep(5000)

  // dispatch a real DOM click on the closet button
  const clicked = await evaluate(`(() => {
    const b = [...document.querySelectorAll('.me-profile-panel button')].find(b => /gardırop/i.test(b.innerText))
    if (!b) return 'button not found'
    b.click()
    return 'clicked'
  })()`)
  console.log('click:', clicked)
  await sleep(3000)
  const state = await evaluate(`(() => {
    const overlays = [...document.querySelectorAll('.v-overlay')]
    return {
      overlayCount: overlays.length,
      active: overlays.filter(o => o.classList.contains('v-overlay--active')).length,
      dialogs: [...document.querySelectorAll('.v-dialog')].map(d => d.className.slice(0, 80)),
      bodyText: document.body.innerText.includes('Cilt') || document.body.innerText.toLowerCase().includes('skin'),
      sample: document.body.innerText.slice(0, 200).replace(/\\n/g, ' | ')
    }
  })()`)
  console.log('after click state:', JSON.stringify(state, null, 2))
  await send(ws, 'Page.captureScreenshot', { format: 'png' }).then((r) => {
    fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '10-closet-diag.png'), Buffer.from(r.data, 'base64'))
  })
  ws.close()
  process.exit(0)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
