/* Prod build'de __name siliniyor — panel bileşeninden cape state'ini oku */
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
  await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  await sleep(3000)

  // Panel bileşenini elemanından bul
  const panel = await ev(`(() => {
    const el = document.querySelector('.me-profile-panel')
    if (!el) return { found: false }
    // alt elemanlardan herhangi birinde __vueParentComponent var mı
    let comp = null
    for (const e of [el, ...el.querySelectorAll('*')]) {
      if (e.__vueParentComponent) { comp = e.__vueParentComponent; break }
    }
    if (!comp) return { found: false, reason: 'no comp' }
    let c = comp
    let hops = 0
    let skinModelCape = null
    while (c && hops < 40) {
      const setup = c.setupState || {}
      if ('skinModel' in setup && setup.skinModel && setup.skinModel.cape) {
        skinModelCape = {
          cape: String(setup.skinModel.cape.value == null ? '' : setup.skinModel.cape.value).slice(0, 140),
          skin: String(setup.skinModel.skin.value == null ? '' : setup.skinModel.skin.value).slice(0, 100)
        }
        break
      }
      c = c.parent
      hops++
    }
    return { found: true, skinModelCape }
  })()`)
  console.log('PANEL:', JSON.stringify(panel, null, 2))

  // closet diyaloğu açıkken (kullanıcı açık bıraktıysa) diyalog bileşen state'i
  await ev(`(() => { const p = document.querySelector('.me-profile-panel'); const b = [...p.querySelectorAll('button')].find(x => /gardırop/i.test(x.innerText)); if (b) b.click(); return 1 })()`)
  await sleep(3500)
  const closet = await ev(`(() => {
    const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
    const ovs = [...document.querySelectorAll('.v-overlay')]
    const dlg = ovs.find(o => norm(o.innerText || '').includes('gardırop'))
    if (!dlg) return { open: false }
    let comp = null
    for (const e of [dlg, ...dlg.querySelectorAll('*')]) {
      if (e.__vueParentComponent) { comp = e.__vueParentComponent; break }
    }
    if (!comp) return { open: true, reason: 'no comp el', text: dlg.innerText.slice(0, 150) }
    let c = comp
    let hops = 0
    while (c && hops < 40) {
      const setup = c.setupState || {}
      if ('previewUrl' in setup) {
        return {
          open: true,
          previewUrl: String(setup.previewUrl == null ? '' : setup.previewUrl).slice(0, 140),
          currentCape: String(setup.currentCape == null ? '' : setup.currentCape).slice(0, 140),
          selectedSkin: setup.selectedSkin ? 'set' : 'null',
          profileSkins: c.props && c.props.profile && c.props.profile.skins ? c.props.profile.skins.length : 'undef',
          profileTextureKeys: c.props && c.props.profile && c.props.profile.textures ? JSON.stringify(Object.keys(c.props.profile.textures)) : 'undef'
        }
      }
      c = c.parent
      hops++
    }
    return { open: true, reason: 'no previewUrl in chain', firstKeys: Object.keys(comp.setupState || {}).slice(0, 15) }
  })()`)
  console.log('CLOSET:', JSON.stringify(closet, null, 2))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
