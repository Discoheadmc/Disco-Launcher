/* Dialog bileşeninin canlı Vue state'ini oku */
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
  await sleep(3000)

  const state = await ev(`(() => {
    // overlay içindeki herhangi bir elemandan Vue bileşen zincirini yürüt
    const norm = (s) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
    const ovs = [...document.querySelectorAll('.v-overlay')].filter(o => norm(o.innerText || '').includes('gardırop'))
    if (!ovs.length) return { found: false }
    let el = ovs[0].querySelector('.v-card') || ovs[0]
    let comp = el.__vueParentComponent
    let hops = 0
    while (comp && hops < 25) {
      const setup = comp.setupState || {}
      const keys = Object.keys(setup)
      if ('previewUrl' in setup || 'selectedSkin' in setup) {
        const profile = comp.props?.profile
        return {
          found: true,
          hops,
          previewUrl: String(setup.previewUrl ?? '').slice(0, 120),
          previewCape: String(setup.previewCape ?? '').slice(0, 120),
          currentCape: String(setup.currentCape ?? '').slice(0, 120),
          selectedSkin: setup.selectedSkin ? 'set' : 'null',
          profileSkins: profile?.skins?.length ?? 'undef',
          profileTextures: profile?.textures ? Object.keys(profile.textures) : 'undef',
          modelValue: comp.props?.modelValue
        }
      }
      comp = comp.parent
      hops++
    }
    return { found: false, reason: 'no previewUrl in chain', hops }
  })()`)
  console.log(JSON.stringify(state, null, 2))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
