/* document genelinde __vueParentComponent taşıyan elemanlardan bileşen ağacını kur */
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
  await ev(`(() => { const p = document.querySelector('.me-profile-panel'); const b = [...p.querySelectorAll('button')].find(x => /gardırop/i.test(x.innerText)); b.click(); return 1 })()`)
  await sleep(3500)

  const state = await ev(`(() => {
    // window üzerinde expose edilen herhangi bir debug kancası var mı?
    const hooks = Object.keys(window).filter(k => /vue|__VUE/i.test(k)).slice(0, 10)
    // tüm elemanları tara, bileşenleri topla
    const seen = new Set()
    let found = null
    const all = document.querySelectorAll('*')
    for (const el of all) {
      const c = el.__vueParentComponent
      if (c && !seen.has(c)) {
        seen.add(c)
        const name = c.type && (c.type.__name || c.type.name) || ''
        if (/UserSkinLibraryDialog/i.test(name)) { found = c; break }
        // parent zincirinde ara
        let p = c.parent
        let hops = 0
        while (p && hops < 40) {
          const pn = p.type && (p.type.__name || p.type.name) || ''
          if (/UserSkinLibraryDialog/i.test(pn)) { found = p; break }
          p = p.parent
          hops++
        }
        if (found) break
      }
    }
    if (!found) return { found: false, vueHooks: hooks, comps: seen.size }
    const setup = found.setupState || {}
    const profile = found.props && found.props.profile
    return {
      found: true,
      comps: seen.size,
      previewUrl: String(setup.previewUrl == null ? '' : setup.previewUrl).slice(0, 140),
      currentCape: String(setup.currentCape == null ? '' : setup.currentCape).slice(0, 140),
      selectedSkin: setup.selectedSkin === undefined ? 'undef' : (setup.selectedSkin ? 'set' : 'null'),
      modelValue: found.props ? found.props.modelValue : 'undef',
      profileSkins: profile && profile.skins ? profile.skins.length : 'undef',
      profileTextures: profile && profile.textures ? JSON.stringify(Object.keys(profile.textures)) : 'undef',
      skinModelCape: setup.skinModel && setup.skinModel.cape ? String(setup.skinModel.cape.value).slice(0, 140) : 'no-model'
    }
  })()`)
  console.log(JSON.stringify(state, null, 2))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
