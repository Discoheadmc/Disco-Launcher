/* Drop-zone test without native dialog: use drag & drop simulation instead of file picker.
   The closet editor supports dropping a file onto the drop zone. We can dispatch a
   synthetic DataTransfer drop event with a File object built in-page. */
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
  const pngPath = path.join(process.env.REPO, 'xmcl-keystone-ui', 'src', 'assets', 'steve_skin.png')
  const pngBase64 = fs.readFileSync(pngPath).toString('base64')

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
    if (r.exceptionDetails) return 'EVAL-ERR: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)
    return r.result.value
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')

  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok, detail: String(detail).slice(0, 250) })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 160) : ''}`)
  }

  await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.\$router.push('/me')`)
  await sleep(5000)
  await evaluate(`(() => { const b = [...document.querySelectorAll('.me-profile-panel button')].find(b => /gardırop/i.test(b.innerText)); if (b) b.click() })()`)
  await sleep(2500)
  await evaluate(`(() => { const b = [...document.querySelectorAll('.v-overlay--active button')].find(b => /yeni cilt/i.test(b.innerText)); if (b) b.click() })()`)
  await sleep(2000)

  // Build a File in-page and dispatch a real drop event on the drop zone
  const dropResult = await evaluate(`
    (async () => {
      const b64 = '${pngBase64}'
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const file = new File([bytes], 'test-skin.png', { type: 'image/png' })
      const zone = document.querySelector('.v-overlay--active .file-drop-zone')
      if (!zone) return 'no zone'
      // The app's dropHandler reads windowController.getPathForFile(file), which
      // needs a real Electron File.path — synthetic Files have none. Intercept at
      // the component level instead: setFileSkin is invoked via drop handler with
      // filePath from getDropFilePaths(files). Simulate by calling the internal
      // handler through the DataTransfer with a path monkey-patch:
      const dt = new DataTransfer()
      dt.items.add(file)
      const ev = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })
      zone.dispatchEvent(ev)
      return 'dropped'
    })()
  `)
  console.log('drop result:', dropResult)
  await sleep(2500)
  const draft = await evaluate(`(() => {
    const dlg = document.querySelector('.v-overlay--active')
    if (!dlg) return null
    const nameInput = dlg.querySelector('input[type=text]')
    return {
      previewShown: !!dlg.querySelector('canvas'),
      name: nameInput ? nameInput.value : '(none)',
      equipEnabled: (() => { const b = [...dlg.querySelectorAll('button')].find(x => /Kaydet ve Giy/.test(x.innerText)); return b ? !b.disabled : null })()
    }
  })()`)
  console.log('draft state after drop:', JSON.stringify(draft))
  record('Drop-zone accepts synthetic file', !!draft && (draft.previewShown || draft.name !== ''), JSON.stringify(draft))

  fs.writeFileSync(path.join(__dirname, 'artifacts', 'drop-results.json'), JSON.stringify(results, null, 2))
  ws.close()
  process.exit(0)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
