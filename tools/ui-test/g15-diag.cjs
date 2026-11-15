/* Teşhis: locale, bar metni, ayar sayfası metinleri, store kaynak butonları */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))

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
    setTimeout(() => {
      if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) }
    }, 30000)
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
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p.reject(new Error(msg.error.message))
      else p.resolve(msg.result)
    }
  })

  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }

  await send(ws, 'Runtime.enable')
  await sleep(1000)

  const locale = await evaluate(`(() => {
    const app = document.querySelector('#app')
    const gp = app && app.__vue_app__ && app.__vue_app__.config.globalProperties
    return gp && gp.$i18n ? gp.$i18n.locale : (localStorage.getItem('locale') || '?')
  })()`)
  console.log('LOCALE:', locale)

  // Ayarlar sayfasına git, network bölümündeki metinleri topla
  await evaluate(`(async () => {
    const app = document.querySelector('#app')
    const router = app.__vue_app__.config.globalProperties.$router
    await router.push('/setting').catch(() => {})
  })()`)
  await sleep(2500)
  const settingText = await evaluate(`document.body.innerText.replace(/\\n+/g, ' | ').slice(0, 6000)`)
  console.log('SETTINGS TEXT:', settingText)

  // Store sayfası
  await evaluate(`(async () => {
    const app = document.querySelector('#app')
    const router = app.__vue_app__.config.globalProperties.$router
    await router.push('/store').catch(() => {})
  })()`)
  await sleep(3000)
  const storeText = await evaluate(`document.body.innerText.replace(/\\n+/g, ' | ').slice(0, 3000)`)
  console.log('STORE TEXT:', storeText)
  const sourceBtns = await evaluate(`[...document.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.innerText.trim())).filter(t => t).slice(0, 40)`)
  console.log('BUTTONS:', JSON.stringify(sourceBtns))

  process.exit(0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
