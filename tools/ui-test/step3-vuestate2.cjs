/* Null-safe: tüm overlay'ler içinde gardırop diyaloğunu bul, Vue state'ini oku */
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
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }
  const hash = await ev(`location.hash`)
  console.log('hash:', hash)
  const panelExists = await ev(`!!document.querySelector('.me-profile-panel')`)
  console.log('panel:', panelExists)
  if (!panelExists) {
    await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
    await sleep(3500)
  }
  const openRes = await ev(`(() => {
    const p = document.querySelector('.me-profile-panel')
    if (!p) return 'NO_PANEL'
    const b = [...p.querySelectorAll('button')].find(x => /gardırop/i.test(x.innerText))
    if (!b) return 'NO_BTN'
    b.click()
    return 'CLICKED'
  })()`)
  console.log('open:', openRes)
  await sleep(3500)

  const state = await ev(`(() => {
    const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
    const ovs = [...document.querySelectorAll('.v-overlay')]
    const dlg = ovs.find(o => norm(o.innerText || '').includes('gardırop'))
    if (!dlg) return { found: false, overlays: ovs.length }
    const el = dlg.querySelector('.v-card') || dlg
    const comp = el.__vueParentComponent
    if (!comp) return { found: false, reason: 'no vueParentComponent' }
    let c = comp
    let hops = 0
    while (c && hops < 30) {
      const setup = c.setupState || {}
      if ('previewUrl' in setup) {
        const profile = c.props && c.props.profile
        return {
          found: true,
          hops,
          previewUrl: String(setup.previewUrl == null ? '' : setup.previewUrl).slice(0, 140),
          currentCape: String(setup.currentCape == null ? '' : setup.currentCape).slice(0, 140),
          selectedSkin: setup.selectedSkin == null ? 'undef' : (setup.selectedSkin ? 'set' : 'null'),
          profileSkins: profile && profile.skins ? profile.skins.length : 'undef',
          profileTextures: profile && profile.textures ? JSON.stringify(Object.keys(profile.textures)) : 'undef',
          modelValue: c.props ? c.props.modelValue : 'undef'
        }
      }
      c = c.parent
      hops++
    }
    return { found: false, reason: 'walked chain', hops }
  })()`)
  console.log(JSON.stringify(state, null, 2))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
