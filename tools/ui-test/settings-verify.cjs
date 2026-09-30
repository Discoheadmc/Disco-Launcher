/* Görev 2 doğrulaması: Ayarlar görsel iyileştirmeleri — gruplar, tints, hover/focus, hiyerarşi; işlevler aynı */
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
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 160) : ''}`)
  }
  await send(ws, 'Page.enable')
  await sleep(5000)

  // Ayarlar sayfasına git
  await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/setting')`)
  await sleep(2500)

  const snap = await ev(`(() => {
    const gs = (el, prop) => el ? getComputedStyle(el)[prop] : ''
    const navItem = document.querySelector('#settings-nav .setting-nav-item')
    const navActive = document.querySelector('#settings-nav .setting-nav-item.v-list-item--active')
    const groupApp = document.querySelector('[data-testid=setting-group-app]')
    const groupPriv = document.querySelector('[data-testid=setting-group-privacy]')
    const groupConn = document.querySelector('[data-testid=setting-group-connection]')
    const connRows = groupConn ? groupConn.querySelectorAll('.setting-group__body > *').length : 0
    const devMode = document.querySelector('[data-testid=developer-mode]')
    const devTrack = devMode ? devMode.querySelector('.v-switch__track') : null
    const title = document.querySelector('.setting-item__title')
    const subtitle = document.querySelector('.setting-item__subtitle')
    const headers = [...document.querySelectorAll('.setting-group__header')].map(h => h.innerText.trim())
    return {
      navExists: !!navItem,
      navTransition: gs(navItem, 'transition'),
      navActiveExists: !!navActive,
      navActiveBg: gs(navActive, 'backgroundColor'),
      groupApp: !!groupApp,
      groupPriv: !!groupPriv,
      groupConn: !!groupConn,
      bodyBg: gs(groupApp ? groupApp.querySelector('.setting-group__body') : null, 'backgroundColor'),
      headers,
      devSwitch: !!devTrack,
      devTrackTransition: gs(devTrack, 'transition'),
      proxyRows: connRows,
      titleWeight: gs(title, 'fontWeight'),
      subtitleSize: gs(subtitle, 'fontSize'),
      subtitleOpacity: gs(subtitle, 'opacity'),
      // regresyon: sidebar menü hâlâ eski şeritsiz
      oldStrip: document.querySelectorAll('[data-testid=instance-item]').length,
      sidebarBtn: !!document.querySelector('[data-testid=sidebar-instance-menu-button]')
    }
  })()`)

  record('Sol nav hover/focus geçişi (transition tanımlı)', snap.navExists && /0\.15s/.test(snap.navTransition), snap.navTransition)
  record('Sol nav aktif sekme vurgusu', snap.navActiveExists && snap.navActiveBg && snap.navActiveBg !== 'rgba(0, 0, 0, 0)', snap.navActiveBg)
  record('Genel bölümü grupları (Dil&Veri + Gizlilik)', snap.groupApp && snap.groupPriv, JSON.stringify(snap.headers))
  record('Grup gövdesi hafif arka plan tonu', /0\.03\)/.test(snap.bodyBg), snap.bodyBg)
  record('Developer Mode toggle yerinde + hover/focus geçişi', snap.devSwitch && /opacity/.test(snap.devTrackTransition), snap.devTrackTransition)
  record('Ağ bölümü grup + 3 satır (kaynak/proxy/soket) korunuyor', snap.groupConn && snap.proxyRows >= 3, `satır: ${snap.proxyRows}`)
  record('Tipografi hiyerarşisi (başlık 600, açıklama soluk)', snap.titleWeight === '600' && snap.subtitleOpacity !== '1', `başlık:${snap.titleWeight}, açıklama:${snap.subtitleSize}/${snap.subtitleOpacity}`)
  record('Regresyon: sidebar tek buton hâlâ çalışır durumda', snap.oldStrip === 0 && snap.sidebarBtn, `oldStrip:${snap.oldStrip}, btn:${snap.sidebarBtn}`)

  // Ekran görüntüleri
  const shot1 = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '40-settings-groups.png'), Buffer.from(shot1.data, 'base64'))
  await ev(`(() => { const el = document.getElementById('network'); if (el) el.scrollIntoView({ block: 'start' }); return 1 })()`)
  await sleep(1200)
  const shot2 = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '41-settings-network.png'), Buffer.from(shot2.data, 'base64'))

  fs.writeFileSync(path.join(__dirname, 'artifacts', 'settings-results.json'), JSON.stringify(results, null, 2))
  console.log('\nSUMMARY: ' + results.filter(r => r.ok).length + '/' + results.length)
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
