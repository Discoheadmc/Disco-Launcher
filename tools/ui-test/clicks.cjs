/* Interaction test: closet dialog + cape picker over CDP (real input events). */
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
  const click = async (js) => {
    // Returns the element's bounding box center so we can send real mouse events
    const rect = await evaluate(`(() => {
      ${js}
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`)
    if (!rect) return false
    await send(ws, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    await send(ws, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    return true
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')

  const route = (p) => evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.\$router.push('${p}')`)

  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok, detail: String(detail).slice(0, 200) })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 120) : ''}`)
  }

  await route('/me')
  await sleep(5500)

  // 1. Open the Local Closet dialog
  await click(`el = [...document.querySelectorAll('.me-profile-panel button')].find(b => /gardırop/i.test(b.innerText))`)
  await sleep(2500)
  const dialog = await evaluate(`(() => {
    const dlg = document.querySelector('.v-dialog--active .skin-library-dialog, .v-overlay--active .skin-library-dialog, [role=dialog]')
    return { open: !!dlg, title: dlg ? dlg.innerText.slice(0, 120).replace(/\\n/g, ' | ') : '' }
  })()`)
  record('Closet dialog opens on click', dialog.open, dialog.title)
  await send(ws, 'Page.captureScreenshot', { format: 'png' }).then((r) => {
    fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '09-closet-dialog.png'), Buffer.from(r.data, 'base64'))
  })

  // 2. Close it again
  await click(`el = [...document.querySelectorAll('.v-overlay--active button, .v-dialog--active button')].find(b => b.querySelector('.mdi-close'))`)
  await sleep(1200)
  const closed = await evaluate(`!document.querySelector('.v-overlay--active .skin-library-dialog')`)
  record('Closet dialog closes', !!closed, closed)

  // 3. Official cape picker: select the second cape then back to none
  const capeSelected = await click(`el = [...document.querySelectorAll('.me-profile-panel .cape-thumb')][1]`)
  await sleep(2500)
  const capeState = await evaluate(`(() => {
    const thumbs = [...document.querySelectorAll('.me-profile-panel .cape-thumb')]
    return thumbs.map(t => t.getAttribute('aria-checked'))
  })()`)
  record('Official cape selection applies (2nd cape active)', capeSelected && capeState[1] === 'true', JSON.stringify(capeState))

  const backToNone = await click(`el = [...document.querySelectorAll('.me-profile-panel .cape-thumb')][0]`)
  await sleep(2000)
  const capeState2 = await evaluate(`(() => {
    const thumbs = [...document.querySelectorAll('.me-profile-panel .cape-thumb')]
    return thumbs.map(t => t.getAttribute('aria-checked'))
  })()`)
  record('No-cape option restores', backToNone && capeState2[0] === 'true', JSON.stringify(capeState2))

  // 4. Custom cape pick button exists and is clickable (dialog opens a file chooser — cancel it)
  const pickClicked = await click(`el = [...document.querySelectorAll('.me-profile-panel button')].find(b => /PNG/i.test(b.innerText))`)
  await sleep(1500)
  record('Custom cape pick button clickable', pickClicked, pickClicked)
  // press Escape to dismiss any native dialog state
  await send(ws, 'Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await send(ws, 'Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })

  fs.writeFileSync(path.join(__dirname, 'artifacts', 'interaction-results.json'), JSON.stringify(results, null, 2))
  console.log('\nSUMMARY: ' + results.filter(r => r.ok).length + '/' + results.length + ' passed')
  ws.close()
  process.exit(0)
}
main().catch((e) => { console.error('DRIVER ERROR:', e.message); process.exit(1) })
