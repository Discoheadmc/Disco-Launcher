/* app._instance non-enumerable — doğrudan erişip ağacı yürü (Suspense dahil) */
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
  await ev(`(() => { const p = document.querySelector('.me-profile-panel'); const b = [...p.querySelectorAll('button')].find(x => /gardırop/i.test(x.innerText)); if (b) b.click(); return 1 })()`)
  await sleep(3500)

  const state = await ev(`(() => {
    const app = document.querySelector('#app').__vue_app__
    const root = app._instance
    if (!root) return { found: false, reason: 'still null' }
    let dialogComp = null
    let visited = 0
    const seen = new Set()
    const visitVnode = (vnode) => {
      if (!vnode || visited > 1500) return
      if (typeof vnode !== 'object') return
      if (seen.has(vnode)) return
      seen.add(vnode)
      visited++
      if (vnode.component) {
        const comp = vnode.component
        const setup = comp.setupState || {}
        if ('previewUrl' in setup && 'selectedSkin' in setup) { dialogComp = comp; return }
        visitVnode(comp.subTree)
      }
      if (Array.isArray(vnode.children)) {
        for (const ch of vnode.children) {
          if (dialogComp) return
          if (ch && typeof ch === 'object') visitVnode(ch)
        }
      }
      if (vnode.suspense) {
        if (dialogComp) return
        visitVnode(vnode.suspense.activeBranch)
      }
    }
    visitVnode(root.subTree)
    if (!dialogComp) return { found: false, reason: 'dialog comp not found', visited }
    const setup = dialogComp.setupState
    const profile = dialogComp.props && dialogComp.props.profile
    return {
      found: true,
      visited,
      previewUrl: String(setup.previewUrl == null ? '' : setup.previewUrl).slice(0, 140),
      currentCape: String(setup.currentCape == null ? '' : setup.currentCape).slice(0, 140),
      selectedSkin: setup.selectedSkin ? 'set' : 'null',
      modelValue: dialogComp.props ? dialogComp.props.modelValue : 'undef',
      profileSkins: profile && profile.skins ? profile.skins.length : 'undef',
      profileTextureKeys: profile && profile.textures ? JSON.stringify(Object.keys(profile.textures)) : 'undef',
      skinModelCape: setup.skinModel && setup.skinModel.cape ? String(setup.skinModel.cape.value).slice(0, 140) : 'no-model'
    }
  })()`)
  console.log(JSON.stringify(state, null, 2))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
