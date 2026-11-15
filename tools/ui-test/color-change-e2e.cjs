/* Renk değiştirme E2E: primary rengini değiştir → theme.json'a yazıldığını doğrula → resetle */
const fs = require('fs')
const path = require('path')
const os = require('os')
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
function readThemeJson() {
  try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), 'AppData', 'Roaming', 'Disco Launcher', 'theme.json'), 'utf8')) } catch { return null }
}
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
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 200) : ''}`)
  }
  await send(ws, 'Runtime.enable')
  await sleep(800)

  // Ayarlar sayfasında ol (önceki test zaten orada bıraktı)
  const hash = await evaluate('location.hash')
  console.log('HASH:', hash)

  const before = readThemeJson()
  const beforeKey = before ? (before.colors ? before.colors.darkPrimaryColor : JSON.stringify(before).slice(0, 120)) : 'no-theme.json'
  console.log('BEFORE theme.json darkPrimaryColor:', beforeKey)

  // primary seçiciyi aç
  await evaluate(`(() => { const d = [...document.querySelectorAll('.color-theme-row .color-button')]; d[2].click(); return d.length })()`)
  await sleep(1500)

  // RGB inputlarını ayarla (R=255, G=85, B=85)
  const setRgb = await evaluate(`(() => {
    const inputs = [...document.querySelectorAll('.v-overlay--active input[type="number"]')]
    if (inputs.length < 3) return 'inputs=' + inputs.length
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const vals = ['255', '85', '85']
    for (let i = 0; i < 3; i++) { setter.call(inputs[i], vals[i]); inputs[i].dispatchEvent(new Event('input', { bubbles: true })); inputs[i].dispatchEvent(new Event('change', { bubbles: true })) }
    return 'set'
  })()`)
  console.log('SET RGB:', setRgb)
  await sleep(2500)

  // dot rengi değişti mi + theme.json
  const dotAfter = await evaluate(`(() => {
    const d = [...document.querySelectorAll('.color-theme-row .color-button')]
    return d[2] ? d[2].style.backgroundColor : null
  })()`)
  const after = readThemeJson()
  const afterKey = after ? (after.colors ? after.colors.darkPrimaryColor : null) : null
  console.log('DOT AFTER:', dotAfter, '| theme.json darkPrimaryColor:', afterKey)
  record('Renk değişimi dot\'a yansıdı', dotAfter && dotAfter !== 'rgb(156, 39, 176)', dotAfter)
  record('Renk theme.json\'a kalıcı yazıldı', !!afterKey && afterKey !== beforeKey, String(beforeKey) + ' -> ' + String(afterKey))

  // menüyü kapat + resetle
  await evaluate(`(() => { document.body.click(); return true })()`)
  await sleep(800)
  await evaluate(`(() => { const b = document.querySelector('.color-theme-row__reset button'); if (b) b.click(); return !!b })()`)
  await sleep(2000)
  const resetTheme = readThemeJson()
  const resetKey = resetTheme && resetTheme.colors ? resetTheme.colors.darkPrimaryColor : null
  record('Sıfırla eski değere döndü', resetKey !== afterKey, String(resetKey))

  console.log('---')
  console.log('SONUÇ: ' + results.filter(r => r.ok).length + '/' + results.length + ' PASS')
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
