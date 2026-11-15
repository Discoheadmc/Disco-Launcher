/* Check if ANY ipc invoke resolves from the page world. */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 20000)
  })
}
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
    if (r.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }
  await send(ws, 'Runtime.enable')

  // sanity: windowController.isMaximized goes through ipcMain.handle
  console.log('ipc sanity (isMaximized):', await evaluate(`Promise.race([
    windowController.isMaximized().then(v => 'resolved: ' + v),
    new Promise(res => setTimeout(() => res('HUNG'), 8000))
  ])`))

  // does the UI itself work? The Vue app uses the same bridge — check the
  // settings state got loaded (it's fetched over this bridge at boot)
  console.log('ui state loaded check:', await evaluate(`(() => {
    const app = document.querySelector('#app').__vue_app__
    return 'app alive'
  })()`))

  // maybe service-call requires the sender to be the app's own webContents and it works;
  // check if a service call issued by the REAL app (via its own UI) works — the settings
  // state IS loaded (we saw settings view render), so bridge works when called by app code.
  // Our raw call hung... try with the exact envelope the app uses: maybe service key must
  // match a registered key exactly. Read the visible error by racing a bad call:
  console.log('bad service call:', await evaluate(`Promise.race([
    window.serviceChannels.open('NoSuchService').call('foo').then(r => 'resolved').catch(e => 'rejected: ' + (e.message || e)),
    new Promise(res => setTimeout(() => res('HUNG'), 8000))
  ])`))

  ws.close()
  process.exit(0)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
