/* Vue global hook ile bileşenleri yakala */
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

  // renderer'ın kendisi __VUE__ hook'una sahip — devtools emit mekanizmasını kullan
  await ev(`(() => {
    window.__cap = []
    const hook = window.__VUE__
    if (hook && hook.push) {
      hook.push((evt, payload) => {
        if (evt === 'component:updated' || evt === 'component:mounted') {
          const n = payload && (payload.uid !== undefined ? payload.uid : null)
          window.__cap.push(evt + ':' + (payload && payload.type && (payload.type.__name || payload.type.name) || '?'))
        }
      })
    }
    return typeof hook
  })()`)

  await ev(`document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/me')`)
  await sleep(3000)
  await ev(`(() => { const p = document.querySelector('.me-profile-panel'); const b = [...p.querySelectorAll('button')].find(x => /gardırop/i.test(x.innerText)); if (b) b.click(); return 1 })()`)
  await sleep(3500)

  // renderer'da instance getter'ı var: __VUE_INSTANCE_SETTERS__ ile aktif instance'ı alabilir miyiz?
  const probe = await ev(`(() => {
    const out = {}
    // Vue 3.4+ currentInstance getter yok prod'da; ama __VUE_HMR_RUNTIME__ var mı?
    out.hmr = typeof window.__VUE_HMR_RUNTIME__
    // createApp dönen app nesnesi #app.__vue_app__ — _instance private ama _container var
    const app = document.querySelector('#app').__vue_app__
    out.appKeys = Object.keys(app).slice(0, 15)
    // app._instance gerçekten yok mu?
    out.hasInstance = '_instance' in app
    // mount sonucu proxy: container.__vue_app__._instance null'sa
    // alternatif: v-app elemanına bağlanan kök bileşen — querySelector ile dene
    const vapp = document.querySelector('.v-application')
    out.vapp = !!vapp
    if (vapp) {
      let comp = null
      for (const e of [vapp, ...vapp.querySelectorAll('*')]) { if (e.__vueParentComponent) { comp = e.__vueParentComponent; break } }
      out.gotComp = !!comp
      if (comp) {
        // panel'e kadar yürü: setupState'inde customCape olan bileşeni ara
        let c = comp
        let hops = 0
        const names = []
        while (c && hops < 60) {
          const setup = c.setupState || {}
          if ('customSelected' in setup || ('customCape' in setup && 'skinModel' in setup)) {
            out.panelCape = setup.customCape && setup.customCape.capeUrl ? String(setup.customCape.capeUrl.value).slice(0, 140) : 'no-url'
            out.skinModelCape = setup.skinModel && setup.skinModel.cape ? String(setup.skinModel.cape.value).slice(0, 140) : 'no-model'
            out.customSelected = String(setup.customSelected)
            break
          }
          names.push((c.type && (c.type.__name || c.type.name)) || '?')
          c = c.parent
          hops++
        }
        out.hops = hops
        out.lastNameSample = names.slice(-6)
      }
    }
    return out
  })()`)
  console.log(JSON.stringify(probe, null, 2))
  ws.close(); process.exit(0)
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1) })
