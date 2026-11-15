/* Final kontrol: görevler bitti mi + SkyCreblock instance'ı listede mi */
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout')) } }, 20000)
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
  })
  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 150))
    return r.result.value
  }
  await send(ws, 'Runtime.enable')
  await sleep(1000)

  // görev sayısı
  const tasks = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button')]
    const t = btns.find(b => /görev çalışıyor|task/i.test(b.innerText || ''))
    return t ? (t.innerText || '').split(String.fromCharCode(10)).join(' | ') : 'görev yok'
  })()`)
  console.log('TASKS:', tasks)

  // ana sayfaya git, instance kartlarını listele
  await evaluate(`(() => { location.hash = '#/'; return location.hash })()`)
  await sleep(5000)
  const home = await evaluate(`(() => {
    const t = document.body.innerText.split(String.fromCharCode(10)).join(' | ')
    return {
      hasSky: t.includes('SkyCreblock'),
      hash: location.hash,
      instNames: (t.match(/[A-Za-z][A-Za-z0-9 .:-]{2,30}(?=\\d+\\.\\d+)/g) || []).slice(0, 10)
    }
  })()`)
  console.log('HOME:', JSON.stringify(home))
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
