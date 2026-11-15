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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 25000)
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
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 250))
    return r.result.value
  }
  await send(ws, 'Page.enable')
  await send(ws, 'Runtime.enable')
  console.log('reloading...')
  await send(ws, 'Page.reload')
  await sleep(8000)
  console.log('hash after reload:', await evaluate(`location.hash`))

  // /me'ye git, panel mount'unu bekle (poll)
  await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  let mounted = false
  for (let i = 1; i <= 16; i++) {
    await sleep(500)
    const s = await evaluate(`!!document.querySelector('.me-profile-panel')`)
    if (s) { console.log(`panel mounted at +${i * 500}ms`); mounted = true; break }
  }
  if (!mounted) console.log('PANEL NEVER MOUNTED')
  await sleep(1000)
  const info = await evaluate(`(() => {
    const p = document.querySelector('.me-profile-panel')
    if (!p) return { panel: false }
    return {
      panel: true,
      rows: [...p.querySelectorAll('.cape-row')].length,
      texts: [...p.querySelectorAll('.cape-row')].map(r => r.innerText.replace(/\\n/g, ' | ').slice(0, 100)),
      closetBtn: !!([...p.querySelectorAll('button')].find(b => /gardırop/i.test(b.innerText)))
    }
  })()`)
  console.log(JSON.stringify(info, null, 2))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
