/* Adım 2 doğrulaması: dialog içeriği (açıklama, PNG Seç, İptal) + Uygula akışı */
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
  await send(ws, 'Page.enable')
  await send(ws, 'Runtime.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false })
  await sleep(3000)

  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + detail : ''}`)
  }
  const normExpr = `((s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase())`

  await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  await sleep(3000)

  // 1) dialog'u aç
  await ev(`(() => { const p = document.querySelector('.me-profile-panel'); const th = [...p.querySelectorAll('.cape-thumb')]; th[th.length - 1].click(); return 'ok' })()`)
  await sleep(1500)

  const dlg = await ev(`(() => {
    const norm = ${normExpr}
    const ovs = [...document.querySelectorAll('.v-overlay--active, [role=dialog]')]
    const d = ovs.find(o => norm(o.innerText || '').includes('ozel pelerin'))
    if (!d) return null
    const btns = [...d.querySelectorAll('button')]
    return {
      text: d.innerText,
      hasDescription: norm(d.innerText).includes('mojang') && norm(d.innerText).includes('görünür'),
      pickBtn: !!d.querySelector('[data-testid=custom-cape-pick]'),
      applyBtn: btns.find(b => norm(b.innerText).includes('uygula')),
      cancelBtn: btns.find(b => norm(b.innerText).includes('iptal')),
      removeBtn: !!d.querySelector('[data-testid=custom-cape-remove]')
    }
  })()`)
  record('Diyalog açılıyor', !!dlg, '')
  record('Açıklama metni (Mojang notu)', !!dlg && dlg.hasDescription, dlg ? (dlg.text.match(/Bu özel pelerin[^\n]*/) || [''])[0].slice(0, 90) : '')
  record('PNG Seç butonu', !!dlg && dlg.pickBtn, '')
  record('İptal butonu', !!dlg && !!dlg.cancelBtn, '')
  record('Uygula butonu başta pasif', !!dlg && !!dlg.applyBtn && dlg.applyBtn.disabled, '')
  record('Sil butonu (mevcut pelerin varsa)', !!dlg && dlg.removeBtn, '')

  const shot1 = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '22-step2-dialog.png'), Buffer.from(shot1.data, 'base64'))

  // 2) PNG Seç'e tıkla -> native diyalog açılır (otomasyonda mock'lanamaz); akışı
  //    doğrudan Vue state'iyle simüle edelim: bileşenin pendingPath'ine erişemeyiz,
  //    ama media URL önizleme mantığını <img> ile test edebiliriz.
  //    Bunun yerine dialog'un İptal ile kapandığını doğrulayalım:
  await ev(`(() => {
    const norm = ${normExpr}
    const ovs = [...document.querySelectorAll('.v-overlay--active, [role=dialog]')]
    const d = ovs.find(o => norm(o.innerText || '').includes('ozel pelerin'))
    const b = d && [...d.querySelectorAll('button')].find(b => norm(b.innerText).includes('iptal'))
    if (b) b.click()
    return b ? 'cancelled' : 'no-btn'
  })()`)
  await sleep(900)
  const closed = await ev(`(() => {
    const norm = ${normExpr}
    return ![...document.querySelectorAll('.v-overlay--active, [role=dialog]')].some(o => norm(o.innerText || '').includes('ozel pelerin'))
  })()`)
  record('İptal ile kapanıyor', !!closed, '')

  // 3) preview mekanizması: media protokolü herhangi bir png'yi servis ediyor mu?
  //    Mevcut takılı özel pelerinin URL'si zaten media protokolünden geliyor.
  const mediaOk = await ev(`fetch('http://launcher/media?path=' + encodeURIComponent('C:/Users/Disco/AppData/Roaming/Disco Launcher/closet') ).then(r => r.status).catch(e => 'ERR:' + e.message)`)
  console.log('media probe (klasör -> 404 beklenir):', mediaOk)

  console.log('\nSUMMARY: ' + results.filter(r => r.ok).length + '/' + results.length)
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'step2-results.json'), JSON.stringify(results, null, 2))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
