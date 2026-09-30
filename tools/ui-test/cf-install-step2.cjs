/* SkyCreblock kurulumu: Yükle → dialog onay → kurulum bitişini bekle → instance doğrula */
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
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })

  // detay sayfasında aç
  await evaluate(`(() => { location.hash = '#/store/curseforge/899973'; return location.hash })()`)
  await send(ws, 'Page.reload')
  await sleep(5000)
  let ready = false
  for (let i = 0; i < 25 && !ready; i++) {
    ready = await evaluate(`(() => { try { return document.body.innerText.includes('SkyCreblock') } catch { return false } })()`)
    if (!ready) await sleep(800)
  }
  console.log('DETAIL READY:', ready)
  await sleep(2000)

  // Yükle butonuna bas
  const clicked = await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').includes('Yükle') && !x.disabled)
    if (!b) return 'no-install-button: ' + [...document.querySelectorAll('button')].map(x => (x.innerText || '').trim()).filter(Boolean).join(',')
    b.click()
    return 'clicked'
  })()`)
  console.log('INSTALL CLICK:', clicked)
  await sleep(3000)

  // dialog dump + akıllı onay döngüsü: en fazla 6 adım
  for (let step = 1; step <= 6; step++) {
    const dlg = await evaluate(`(() => {
      const overlays = [...document.querySelectorAll('.v-overlay--active, .v-dialog--active, .v-dialog .v-card')]
      const visible = overlays.find(o => o.offsetParent !== null || o.getBoundingClientRect().height > 50)
      if (!visible) return null
      const inputs = [...visible.querySelectorAll('input, textarea')].map(i => ({ type: i.type, ph: i.placeholder || '', val: i.type === 'password' ? '***' : (i.value || '').slice(0, 30) }))
      const btns = [...visible.querySelectorAll('button')].map(b => ({ text: (b.innerText || '').trim().slice(0, 25), cls: b.className.includes('bg-primary') ? 'primary' : (b.className.includes('v-btn--variant-flat') ? 'flat' : 'plain'), disabled: b.disabled }))
      return { title: (visible.querySelector('.v-card-title, h2, h3') || {}).innerText || '', inputs, btns }
    })()`)
    if (!dlg) { console.log('STEP ' + step + ': dialog yok — akış tamam'); break }
    console.log('STEP ' + step + ' DIALOG:', JSON.stringify(dlg).slice(0, 400))
    // onay butonu: Yükle/Kur/Oluştur/Devam/Tamam/Onayla (primary tercih edilir)
    const acted = await evaluate(`(() => {
      const overlays = [...document.querySelectorAll('.v-overlay--active, .v-dialog--active, .v-dialog .v-card')]
      const visible = overlays.find(o => o.getBoundingClientRect().height > 50)
      if (!visible) return 'no-dialog'
      const btns = [...visible.querySelectorAll('button')]
      const confirm = btns.find(b => /yükle|kur|oluştur|devam|tamam|onayla|install|create|continue|ok/i.test(b.innerText || '') && !b.disabled)
      if (!confirm) return 'no-confirm'
      confirm.click()
      return 'confirmed:' + (confirm.innerText || '').trim()
    })()`)
    console.log('STEP ' + step + ' ACTION:', acted)
    await sleep(3000)
  }

  // kurulum ilerlemesini izle: görev sayısı + instance listesi
  let done = false
  for (let i = 0; i < 12 && !done; i++) {
    const st = await evaluate(`(() => {
      const taskText = (document.querySelector('[data-testid=\"task-button\"], [class*=\"task\"]') || {}).innerText || ''
      const bodyText = document.body.innerText
      const hasTask = /görev çalışıyor|tasks? running/i.test(bodyText)
      const instances = [...document.querySelectorAll('[data-testid=\"sidebar-instance-menu-button\"], .sidebar-instance, nav a')].map(a => (a.innerText || a.textContent || '').trim()).filter(t => t && t.length < 40)
      return { hasTask, taskSample: taskText.slice(0, 40), instSample: instances.slice(0, 8) }
    })()`)
    const found = (st.instSample || []).find(t => /skycreblock/i.test(t))
    console.log('POLL ' + i + ':', JSON.stringify(st))
    if (!st.hasTask && found) { done = true; break }
    if (!st.hasTask && i > 6 && found !== undefined) { done = true; break }
    await sleep(10000)
  }
  console.log('INSTALL DONE:', done)

  // son durum: instance listesinde ara
  const finalState = await evaluate(`(() => {
    const t = document.body.innerText.split(String.fromCharCode(10)).join(' | ')
    return { hasSkyCreblock: t.includes('SkyCreblock'), hash: location.hash, head: t.slice(0, 400) }
  })()`)
  console.log('FINAL:', JSON.stringify(finalState))
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
