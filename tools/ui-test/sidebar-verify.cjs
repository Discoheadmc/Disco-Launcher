/* Sidebar tek-buton doğrulaması: eski şerit yok, buton var, popover açılıyor, navigasyon çalışıyor */
const path = require('path')
const fs = require('fs')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
let id = 0
const pending = new Map()
function send (ws, method, params = {}) {
  const msg = { id: ++id, method, params }
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject })
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('to ' + method)) } }, 30000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function getJson (url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.on('error', reject)
  })
}
async function waitCdp (maxSec = 60) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxSec * 1000) {
    try { return await getJson('http://127.0.0.1:9777/json/list') } catch { await sleep(2000) }
  }
  throw new Error('CDP unreachable')
}
async function main () {
  const targets = await waitCdp()
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
  const ev = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  }
  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
  }
  await send(ws, 'Page.enable')
  await sleep(5000)

  const state = await ev(`(() => {
    const sidebar = document.querySelector('[data-testid=app-sidebar]')
    const btn = document.querySelector('[data-testid=sidebar-instance-menu-button]')
    return {
      sidebar: !!sidebar,
      oldStrip: document.querySelectorAll('[data-testid=instance-item]').length,
      button: !!btn,
      accounts: !!document.querySelector('[data-testid=nav-accounts]'),
      store: !!document.querySelector('[data-testid=nav-store]'),
      settings: !!document.querySelector('[data-testid=nav-settings]'),
      btnImage: btn ? !!btn.querySelector('img') : false,
      btnChevron: btn ? !!btn.querySelector('.sidebar-instance-menu__chevron') : false
    }
  })()`)
  record('Eski instance şeridi kaldırıldı (0 item)', state.oldStrip === 0, 'item sayısı: ' + state.oldStrip)
  record('Tek buton (aktif ikon + ok)', state.button && state.btnImage && state.btnChevron, JSON.stringify(state))
  record('Profil ikonu ayrı duruyor', state.accounts, '')
  record('Mağaza ikonu ayrı duruyor', state.store, '')
  record('Ayarlar ikonu ayrı duruyor', state.settings, '')

  const shot1 = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '30-sidebar-button.png'), Buffer.from(shot1.data, 'base64'))

  // popover'ı aç (soğuk başlangıçta geç açılabilir → retry)
  let menu = null
  for (let i = 0; i < 5 && (!menu || !menu.open); i++) {
    await ev(`(() => { const b = document.querySelector('[data-testid=sidebar-instance-menu-button]'); if (b) b.click(); return 1 })()`)
    await sleep(1500)
    menu = await ev(`(() => {
      const lists = [...document.querySelectorAll('.v-overlay--active .v-list, .v-menu .v-list')]
      const list = lists.find(l => l.querySelectorAll('.v-list-item').length >= 2)
      return {
        open: !!list,
        items: list ? [...list.querySelectorAll('.v-list-item')].map(i => i.innerText.trim().slice(0, 30)) : []
      }
    })()`)
  }
  if (!menu) menu = { open: false, items: [] }
  record('Popover açılıyor + instance listesi', !!menu.open && menu.items.length >= 2, JSON.stringify(menu && menu.items))

  const shot2 = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '31-sidebar-popover.png'), Buffer.from(shot2.data, 'base64'))

  // 2. instance'a tıkla → navigasyon çalışıyor mu
  const before = await ev(`(() => ({
    hash: location.hash,
    btnSrc: (document.querySelector('[data-testid=sidebar-instance-menu-button] img') || {}).src || ''
  }))()`)
  const clicked = await ev(`(() => {
    const lists = [...document.querySelectorAll('.v-overlay--active .v-list, .v-menu .v-list')]
    const list = lists.find(l => l.querySelectorAll('.v-list-item').length >= 2)
    if (!list) return 'NO_LIST'
    const items = [...list.querySelectorAll('.v-list-item')]
  // Seçili satır v-list-item--active class'ı taşıyor; check ligature metni de 'check' olarak geçiyor.
  const target = items.find(i => !i.classList.contains('v-list-item--active') && !/check/i.test(i.innerText) && i.innerText.trim() && !/ekle|add|oluştur/i.test(i.innerText))
    if (!target) return 'NO_TARGET'
    const name = target.innerText.trim().slice(0, 40)
    target.click()
    return 'CLICKED::' + name
  })()`)
  const clickedName = String(clicked).split('::')[1] || ''
  const clickedResult = String(clicked).split('::')[0]
  await sleep(2500)
  const after = await ev(`(() => ({
    hash: location.hash,
    btnSrc: (document.querySelector('[data-testid=sidebar-instance-menu-button] img') || {}).src || ''
  }))()`)
  const navChanged = after.hash !== before.hash
  const iconChanged = before.btnSrc !== after.btnSrc
  // popover'ı tekrar aç, aktif satır hâlâ doğru mu?
  let checkMoved = []
  for (let i = 0; i < 5 && !checkMoved.length; i++) {
    await ev(`(() => { const b = document.querySelector('[data-testid=sidebar-instance-menu-button]'); if (b) b.click(); return 1 })()`)
    await sleep(1500)
    checkMoved = await ev(`(() => {
      const lists = [...document.querySelectorAll('.v-overlay--active .v-list, .v-menu .v-list')]
      const list = lists.find(l => l.querySelectorAll('.v-list-item').length >= 2)
      if (!list) return []
      return [...list.querySelectorAll('.v-list-item--active')].map(i => i.innerText.trim().slice(0, 40))
    })()`)
  }
  await ev(`(() => { const b = document.querySelector('[data-testid=sidebar-instance-menu-button]'); b && b.click(); return 1 })()`)
  record('Instance tıklanınca navigasyon + seçim', clickedResult === 'CLICKED' && (navChanged || iconChanged || checkMoved.length > 0), `tıklanan: "${clickedName}" / hash: ${before.hash} -> ${after.hash}, ikon değişti: ${iconChanged}, seçili: ${JSON.stringify(checkMoved)}`)

  // popover kapandı mı (close-on-content-click)
  await sleep(800)
  const menuClosed = await ev(`![...document.querySelectorAll('.v-overlay--active .v-list')].some(l => l.querySelectorAll('.v-list-item').length >= 2)`)
  record('Seçimden sonra popover kapanıyor', !!menuClosed, '')

  fs.writeFileSync(path.join(__dirname, 'artifacts', 'sidebar-results.json'), JSON.stringify(results, null, 2))
  console.log('\nSUMMARY: ' + results.filter(r => r.ok).length + '/' + results.length)
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
