/* Disco Launcher test driver — connects over CDP and exercises the real app. */
const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))

const PORT = 9777
const OUT = process.env.OUT_DIR || path.join(__dirname, 'artifacts')
const SHOTS = path.join(OUT, 'shots')
fs.mkdirSync(SHOTS, { recursive: true })

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

function send(ws, method, params = {}, sessionId) {
  const msg = { id: ++id, method, params }
  if (sessionId) msg.sessionId = sessionId
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(msg.id)) {
        pending.delete(msg.id)
        reject(new Error('CDP timeout: ' + method))
      }
    }, 20000)
  })
}

function onEvent(ws, handler) {
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p.reject(new Error(msg.error.message)) 
      else p.resolve(msg.result)
    } else if (msg.method) {
      handler(msg)
    }
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`)
  const page = targets.find((t) => t.type === 'page' && t.url.includes('disco.runtime'))
  if (!page) throw new Error('launcher page not found: ' + JSON.stringify(targets.map(t => t.url)))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.on('open', r))

  const logs = []
  onEvent(ws, (msg) => {
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
      logs.push(`[${msg.params.type}] ${text.slice(0, 300)}`)
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      logs.push(`[EXCEPTION] ${(d.text || '')} ${(d.exception && (d.exception.description || d.exception.value) || '').slice(0, 300)}`)
    }
  })

  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }

  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1200, height: 720, deviceScaleFactor: 1, mobile: false })
  await sleep(2500)

  const shot = async (name) => {
    const r = await send(ws, 'Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'))
  }

  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok, detail: String(detail).slice(0, 300) })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
  }

  // --- T0: boot state ---
  const bootErrs = logs.filter((l) => l.startsWith('[EXCEPTION]')).length
  record('Boot without renderer exceptions', bootErrs === 0, bootErrs + ' exceptions so far')

  // Health metrics helper
  const metrics = async () => {
    const m = await send(ws, 'Performance.getMetrics')
    const get = (n) => { const f = m.metrics.find((x) => x.name === n); return f ? f.value : -1 }
    return { jsHeap: (get('JSHeapUsedSize') / 1048576).toFixed(1), nodes: get('Nodes'), listeners: get('JSEventListeners') }
  }
  const m1 = await metrics()
  record('Renderer JS heap after boot', parseFloat(m1.jsHeap) < 400, m1.jsHeap + ' MB, DOM nodes: ' + m1.nodes)

  // --- T1: routes exist (SPA navigate) ---
  const route = (r) => evaluate(`window.$router ? window.$router.push('${r}') : (location.hash = '${r}')`)

  await route('/me')
  await sleep(1800)
  const meText = await evaluate(`document.body.innerText.slice(0, 400)`)
  record('Me/profile view renders', /disco|offline|local/i.test(meText), meText.replace(/\n/g, ' | ').slice(0, 140))
  await shot('01-me-profile')

  // Local Closet button present?
  const closet = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button')]
    const b = btns.find(x => /gardırop|closet/i.test(x.innerText))
    return b ? b.innerText.trim() : null
  })()`)
  record('Local Closet button visible', !!closet, closet)

  // Custom cape section present?
  await route('/me'); await sleep(800)
  const customCape = await evaluate(`document.body.innerText.includes('Özel Pelerin') || document.body.innerText.toLowerCase().includes('custom cape')`)
  record('Custom cape section visible', !!customCape, customCape)
  await shot('02-me-custom-cape')

  // --- T2: Store view (trending must be gone) ---
  await route('/store')
  await sleep(2500)
  const store = await evaluate(`(() => {
    const txt = document.body.innerText
    return {
      trending: /trend|trending/i.test(txt),
      discover: /discover|keşfed|keşif|projeler/i.test(txt) || !!document.querySelector('[data-testid=store-search]'),
      search: !!document.querySelector('[data-testid=store-search]'),
      filters: document.querySelectorAll('.filter-title').length
    }
  })()`)
  record('Store: trending section removed', store.trending === false, 'trending found: ' + store.trending)
  record('Store: discover + search render', store.search && (store.discover || store.filters > 0), JSON.stringify(store))
  await shot('03-store')

  // Filter interaction (game version autocomplete exists?)
  const filterCount = await evaluate(`document.querySelectorAll('.filter-title').length`)
  record('Store: filter groups render', filterCount >= 3, filterCount + ' filter groups')

  // --- T3: Settings view ---
  await route('/setting')
  await sleep(1800)
  const setText = await evaluate(`document.body.innerText.slice(0, 500)`)
  record('Settings view renders', setText.length > 50, setText.replace(/\n/g, ' | ').slice(0, 120))
  await shot('04-settings')

  // --- T4: Home view ---
  await route('/')
  await sleep(1800)
  await shot('05-home')

  // --- T5: stress — navigate all routes quickly ---
  const routes = ['/', '/me', '/store', '/setting', '/me', '/']
  for (const r of routes) { await route(r); await sleep(400) }
  await sleep(1200)
  const m2 = await metrics()
  const grow = (parseFloat(m2.jsHeap) - parseFloat(m1.jsHeap)).toFixed(1)
  record('Heap growth after route stress < 60MB', Math.abs(parseFloat(grow)) < 60, m1.jsHeap + ' -> ' + m2.jsHeap + ' MB (' + grow + ')')
  const errAfterStress = logs.filter((l) => l.startsWith('[EXCEPTION]')).length
  record('No exceptions after stress navigation', errAfterStress === 0, errAfterStress + ' exceptions')

  // --- T6: backend service smoke via service bridge (renderer side) ---
  const servicesOk = await evaluate(`!!(window.$vm || document.querySelector('#app'))`)
  record('Renderer app root healthy', !!servicesOk, servicesOk)

  // Save artifacts
  fs.writeFileSync(path.join(OUT, 'ui-results.json'), JSON.stringify(results, null, 2))
  fs.writeFileSync(path.join(OUT, 'console.log.txt'), logs.join('\n'))
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify({ afterBoot: m1, afterStress: m2 }, null, 2))

  console.log('\nSUMMARY: ' + results.filter(r => r.ok).length + '/' + results.length + ' passed')
  ws.close()
  process.exit(0)
}

main().catch((e) => { console.error('DRIVER ERROR:', e.message); process.exit(1) })
