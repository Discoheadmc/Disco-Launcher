/* CF key girişi + Kaydet — key değeri LOG'LANMAZ */
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const KEY = process.argv[2] || ''
if (!KEY) { console.error('key argümanı eksik'); process.exit(1) }

async function main() {
  const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`)
  const page = targets.find((t) => t.type === 'page' && t.url.includes('disco.runtime'))
  if (!page) { console.log('PAGE NOT FOUND'); process.exit(1) }
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
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')

  // Ayarlar'da ol
  await evaluate(`(() => { if (!location.hash.includes('/setting')) location.hash = '#/setting'; return location.hash })()`)
  await send(ws, 'Page.reload')
  await sleep(6000)

  // alanı bul, key'i gir (native setter), input event tetikle
  const setInput = await evaluate(`(async () => {
    for (let i = 0; i < 15; i++) {
      const el = document.querySelector('[data-testid="settings-curseforge-api-key"]')
      if (el) {
        const input = el.tagName === 'INPUT' ? el : el.querySelector('input')
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
          setter.call(input, ${JSON.stringify(KEY)})
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.focus()
          return 'set:' + input.value.length
        }
      }
      await new Promise(r => setTimeout(r, 700))
    }
    return 'field-not-found'
  })()`)
  console.log('SET:', setInput)
  if (setInput === 'field-not-found') process.exit(1)

  await sleep(800)

  // Kaydet butonunu bul (konteyner içindeki primary buton; dirty olunca aktif olur)
  const clickSave = await evaluate(`(() => {
    const el = document.querySelector('[data-testid="settings-curseforge-api-key"]')
    const group = el.closest('[data-testid="setting-group-api-keys"]') || el.closest('.v-card') || el.parentElement.parentElement.parentElement
    if (!group) return 'group-not-found'
    const btns = [...group.querySelectorAll('button')]
    const save = btns.find(b => /kaydet|save/i.test(b.innerText || '')) || btns.find(b => !b.disabled)
    if (!save) return 'no-button'
    const wasDisabled = save.disabled
    save.click()
    return 'clicked,wasDisabled=' + wasDisabled
  })()`)
  console.log('SAVE:', clickSave)
  await sleep(2500)

  // doğrula: setting.json'a düştü mü (renderer'dan okunamaz; dosyayı bash doğrulayacak)
  const after = await evaluate(`(() => {
    const el = document.querySelector('[data-testid="settings-curseforge-api-key"]')
    const input = el && (el.tagName === 'INPUT' ? el : el.querySelector('input'))
    return { len: input ? input.value.length : null }
  })()`)
  console.log('AFTER:', JSON.stringify(after))
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
