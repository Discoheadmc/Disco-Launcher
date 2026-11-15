/* Adım 1 doğrulaması: 4. küçük resim butonu + dialog açılışı */
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 25000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fs = require('fs')
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
  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 250))
    return r.result.value
  }
  await send(ws, 'Page.enable')
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.reload')
  await sleep(8000)
  await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  await sleep(2500)

  const state = await evaluate(`(() => {
    const panel = document.querySelector('.me-profile-panel')
    if (!panel) return { panel: false }
    const thumbs = [...panel.querySelectorAll('.cape-thumb')]
    const customBtn = thumbs[thumbs.length - 1]
    return {
      panel: true,
      thumbCount: thumbs.length,
      customBtnIcon: customBtn ? (customBtn.querySelector('.v-icon') || {}).textContent : null,
      customBtnAria: customBtn ? customBtn.getAttribute('aria-label') : null,
      customBtnRole: customBtn ? customBtn.getAttribute('role') : null,
      customSetHint: panel.innerText.includes('Sadece bu başlatıcıda') || panel.innerText.toLowerCase().includes('sadece bu başlatıcı'),
      customSectionGone: !panel.innerText.includes('PNG Seç'),
      officialCapeRow: panel.innerText.toUpperCase().includes('PELERİNİNİZİ')
    }
  })()`)
  console.log('STATE:', JSON.stringify(state, null, 2))

  // click the custom button -> dialog should open
  const opened = await evaluate(`(() => {
    const panel = document.querySelector('.me-profile-panel')
    const thumbs = [...panel.querySelectorAll('.cape-thumb')]
    const btn = thumbs[thumbs.length - 1]
    btn.click()
    return 'clicked'
  })()`)
  await sleep(1200)
  const dlg = await evaluate(`(() => {
    const ovs = [...document.querySelectorAll('.v-overlay--active, .v-dialog--active, [role=dialog]')]
    const dlg = ovs.find(o => o.innerText && o.innerText.includes('ÖZEL PELERİN'))
    return {
      open: !!dlg,
      hasTitle: dlg ? dlg.innerText.includes('Özel Pelerin') || dlg.innerText.toUpperCase().includes('ÖZEL PELERİN') : false,
      hasCancel: dlg ? !!([...dlg.querySelectorAll('button')].find(b => /İptal|iptal/i.test(b.innerText))) : false,
      hasCloseX: dlg ? !!dlg.querySelector('button') : false
    }
  })()`)
  console.log('DIALOG:', JSON.stringify(dlg, null, 2))

  const r = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '20-step1-thumb.png'), Buffer.from(r.data, 'base64'))
  // screenshot of dialog open
  const r2 = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'shots', '21-step1-dialog.png'), Buffer.from(r2.data, 'base64'))

  // close via İptal
  await evaluate(`(() => {
    const ovs = [...document.querySelectorAll('.v-overlay--active, .v-dialog--active, [role=dialog]')]
    const dlg = ovs.find(o => o.innerText && o.innerText.includes('ÖZEL PELERİN'))
    if (dlg) { const b = [...dlg.querySelectorAll('button')].find(b => /İptal/i.test(b.innerText)); if (b) b.click() }
  })()`)
  await sleep(800)
  const closed = await evaluate(`![...document.querySelectorAll('.v-overlay--active, [role=dialog]')].some(o => o.innerText && o.innerText.includes('ÖZEL PELERİN'))`)
  console.log('CLOSED:', closed)
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
