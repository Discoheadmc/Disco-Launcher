/* Adım 2 düzeltilmiş doğrulama: doğru norm + doğru dal + gerçek disabled kontrolü */
const fs = require('fs')
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
let id = 0
const pending = new Map()
function send (ws, method, params = {}) {
  const msg = { id: ++id, method, params }
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve, reject })
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('to ' + method)) } }, 25000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main () {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9777/json/list', (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
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

  await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  await sleep(2500)
  await ev(`(() => { const p = document.querySelector('.me-profile-panel'); const th = [...p.querySelectorAll('.cape-thumb')]; th[th.length - 1].click(); return 'ok' })()`)
  await sleep(1500)

  // norm içinde aranan ibareleri de norm'la karşılaştır
  const dlg = await ev(`(() => {
    const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
    const ovs = [...document.querySelectorAll('.v-overlay--active, [role=dialog]')]
    const d = ovs.find(o => norm(o.innerText || '').includes('ozel pelerin'))
    if (!d) return null
    const btns = [...d.querySelectorAll('button')]
    const applyBtn = btns.find(b => norm(b.innerText).includes('uygula'))
    const pickBtn = d.querySelector('[data-testid=custom-cape-pick]')
    const repickBtn = d.querySelector('[data-testid=custom-cape-repick]')
    const n = norm(d.innerText)
    return {
      hasDescription: n.includes(norm('görünür')) && n.includes('mojang') && n.includes(norm('gönderilmez')),
      pickBtn: !!pickBtn,
      repickBtn: !!repickBtn,
      hasPreviewImg: !!d.querySelector('img'),
      previewSrc: d.querySelector('img') ? d.querySelector('img').src.slice(0, 80) : null,
      applyDisabled: applyBtn ? applyBtn.disabled : null,
      applyClassDisabled: applyBtn ? applyBtn.className.includes('v-btn--disabled') : null,
      removeBtn: !!d.querySelector('[data-testid=custom-cape-remove]')
    }
  })()`)
  record('Açıklama: sadece-bizde + Mojang notu', !!dlg && dlg.hasDescription, '')
  record('Önizleme <img> mevcut takılı pelerini gösteriyor', !!dlg && dlg.hasPreviewImg, dlg ? dlg.previewSrc : '')
  record('Değiştir dalı (pelerin zaten takılı)', !!dlg && dlg.repickBtn && !dlg.pickBtn, '')
  record('Uygula pasif (değişiklik yokken)', !!dlg && (dlg.applyDisabled === true || dlg.applyClassDisabled), 'disabled=' + (dlg && dlg.applyDisabled) + ' class=' + (dlg && dlg.applyClassDisabled))
  record('Sil butonu mevcut', !!dlg && dlg.removeBtn, '')

  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '23-step2-fixed.png'), Buffer.from(shot.data, 'base64'))

  fs.writeFileSync(path.join(__dirname, 'artifacts', 'step2-results.json'), JSON.stringify(results, null, 2))
  console.log('\nSUMMARY: ' + results.filter(r => r.ok).length + '/' + results.length)
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
