/* Panel Başlat → oyun süreci başlar → Panel Durdur → biter (gerçek E2E) */
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 25000)
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
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 200))
    return r.result.value
  }
  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 220) : ''}`)
  }
  await send(ws, 'Runtime.enable')
  await sleep(800)

  const clickPanel = async (testid) => evaluate(`(() => {
    const b = document.querySelector('[data-testid="${testid}"]')
    if (!b) return 'no-btn'
    if (b.disabled) return 'disabled'
    b.click()
    return 'clicked'
  })()`)

  // launch öncesi durum
  const before = await evaluate(`(() => {
    const kill = document.querySelector('[data-testid="panel-kill"]')
    return { killDisabled: kill ? kill.disabled : null }
  })()`)
  console.log('BEFORE:', JSON.stringify(before))

  // Başlat
  const c1 = await clickPanel('panel-launch')
  console.log('LAUNCH:', c1)
  if (c1 !== 'clicked') { record('Panel Başlat tıklanabilir', false, c1); process.exit(1) }

  // oyun süreci başlayana kadar bekle (Durdur aktifleşir)
  let launched = false
  for (let i = 0; i < 30; i++) {
    const st = await evaluate(`(() => {
      const kill = document.querySelector('[data-testid="panel-kill"]')
      return { disabled: kill ? kill.disabled : null }
    })()`)
    if (st.disabled === false) { launched = true; break }
    await sleep(2000)
  }
  record('Panelden oyun başladı (Durdur aktifleşti)', launched, '')

  // 5 sn çalıştır, sonra Durdur
  await sleep(5000)
  const c2 = await clickPanel('panel-kill')
  console.log('KILL:', c2)
  let killed = false
  for (let i = 0; i < 15; i++) {
    const st = await evaluate(`(() => {
      const kill = document.querySelector('[data-testid="panel-kill"]')
      return { disabled: kill ? kill.disabled : null }
    })()`)
    if (st.disabled === true) { killed = true; break }
    await sleep(2000)
  }
  record('Panelden oyun durduruldu (Durdur pasifleşti)', killed, '')
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
