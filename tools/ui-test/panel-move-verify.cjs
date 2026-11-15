/* Panel taşıma doğrulaması: pill yok + panel tam yükseklik + launch testidsi */
const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const PORT = 9777
const SHOTS = path.join(__dirname, 'artifacts', 'shots')
fs.mkdirSync(SHOTS, { recursive: true })
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
  const shot = async (name) => {
    try {
      const r = await send(ws, 'Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'))
    } catch {}
  }
  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 250) : ''}`)
  }
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await sleep(6000)

  const st = await evaluate(`(() => {
    const pill = document.querySelector('#launch-button, [data-testid="launch-button"]')
    const panelLaunch = document.querySelector('[data-testid="panel-launch"]')
    const panelKill = document.querySelector('[data-testid="panel-kill"]')
    const gear = document.querySelector('[data-testid="launch-button-menu"]')
    const panel = document.querySelector('.instance-actions-panel')
    const pr = panel ? panel.getBoundingClientRect() : null
    const status = document.querySelector('.home-launch-group')
    return {
      pillGone: !pill,
      gearGone: !gear,
      hasPanelLaunch: !!panelLaunch,
      hasPanelKill: !!panelKill,
      panelRect: pr ? { top: Math.round(pr.top), bottom: Math.round(pr.bottom), height: Math.round(pr.height), right: Math.round(pr.right) } : null,
      winH: window.innerHeight,
      statusGroupStillThere: !!status
    }
  })()`)
  record('Üst Başlat pill kaldırıldı', st.pillGone, JSON.stringify(st))
  record('Dişli butonu kaldırıldı', st.gearGone, '')
  record('Panel Başlat butonu var', st.hasPanelLaunch, '')
  record('Panel Durdur butonu var', st.hasPanelKill, '')
  const fullHeight = st.panelRect && st.panelRect.top <= 40 && st.panelRect.bottom >= st.winH - 40
  record('Panel tam yükseklik (üst boşluk kapandı)', fullHeight, JSON.stringify({ panel: st.panelRect, winH: st.winH }))
  await shot('panel-move')

  console.log('---')
  console.log('SONUÇ: ' + results.filter(r => r.ok).length + '/' + results.length + ' PASS')
  process.exit(0)
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
