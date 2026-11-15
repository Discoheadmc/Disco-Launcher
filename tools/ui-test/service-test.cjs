/* Backend service E2E: exercise LocalSkinService + LocalCapeService through
   the renderer's real service bridge (same path the UI uses). */
const path = require('path')
const http = require('http')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const fs = require('fs')
const PORT = 9777
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
    setTimeout(() => { if (pending.has(msg.id)) { pending.delete(msg.id); reject(new Error('timeout ' + method)) } }, 30000)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const pngPath = path.join(process.env.REPO, 'xmcl-keystone-ui', 'src', 'assets', 'steve_skin.png')

  const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`)
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.on('open', r))
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString())
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
    }
  })
  const evaluate = async (expression) => {
    const r = await send(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('EVAL: ' + JSON.stringify(r.exceptionDetails).slice(0, 500))
    return r.result.value
  }
  await send(ws, 'Runtime.enable')

  const results = []
  const record = (name, ok, detail) => {
    results.push({ name, ok, detail: String(detail).slice(0, 300) })
    console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' :: ' + String(detail).slice(0, 200) : ''}`)
  }

  // Open service channels for LocalSkinService & LocalCapeService
  await evaluate(`
    window.__svc = {}
    for (const key of ['LocalSkinService', 'LocalCapeService', 'UserService']) {
      window.__svc[key] = window.serviceChannels.open(key)
    }
    'opened'
  `)

  // ---- LocalSkinService ----
  const addSkinRaw = await evaluate(`window.__svc.LocalSkinService.call('addSkin', {
    name: 'e2e-test-skin',
    source: ${JSON.stringify(pngPath)},
    slim: false
  }).then(r => JSON.stringify(r)).catch(e => 'ERR: ' + (e && (e.message || e.code) || String(e)))`)
  const addSkin = addSkinRaw && !String(addSkinRaw).startsWith('ERR') ? JSON.parse(addSkinRaw) : null
  console.log('addSkin raw:', String(addSkinRaw).slice(0, 200))
  record('LocalSkinService.addSkin (local PNG)', !!addSkin && !!addSkin.id, addSkin ? 'id=' + addSkin.id + ' url=' + addSkin.url : JSON.stringify(addSkin))
  const skinId = addSkin && addSkin.id

  const state1Raw = await evaluate(`window.__svc.LocalSkinService.call('getState').then(r => JSON.stringify(r)).catch(e => 'ERR: ' + (e && (e.message || e.code) || String(e)))`)
  const state1 = state1Raw && !String(state1Raw).startsWith('ERR') ? JSON.parse(state1Raw) : { skins: [] }
  record('LocalSkinService.getState lists the new skin', !!state1 && state1.skins.some(s => s.id === skinId), (state1.skins || []).length + ' skins in closet')

  // media URL fetchable?
  if (addSkin && addSkin.url) {
    const mediaStatus = await evaluate(`fetch(${JSON.stringify(addSkin.url)}).then(r => r.status)`)
    record('Closet skin served over launcher media protocol', mediaStatus === 200, 'GET ' + addSkin.url.slice(0, 60) + ' -> ' + mediaStatus)
  }

  // equip to the offline account profile via setEquippedSkin
  if (skinId) {
    const usersRaw = await evaluate(`window.__svc.UserService.call('getUserState').then(s => JSON.stringify({ users: Object.keys(s.users || {}), offlineProfile: s.users && s.users['x://OFFLINE@dev'] ? s.users['x://OFFLINE@dev'].selectedProfile : null })).catch(e => 'ERR: ' + (e && (e.message || e.code) || String(e)))`)
    const users = usersRaw && !String(usersRaw).startsWith('ERR') ? JSON.parse(usersRaw) : { offlineProfile: null }
    console.log('users:', JSON.stringify(users))
    const accountKey = 'x://OFFLINE@dev:' + (users.offlineProfile || '')
    await evaluate(`window.__svc.LocalSkinService.call('setEquippedSkin', ${JSON.stringify(accountKey)}, ${JSON.stringify(skinId)}).catch(e => 'ERR:' + e)`)
    const state2Raw = await evaluate(`window.__svc.LocalSkinService.call('getState').then(r => JSON.stringify(r))`)
    const state2 = JSON.parse(state2Raw)
    record('Equip persisted for offline account', state2.equippedSkinIds[accountKey] === skinId, 'equippedSkinIds[' + accountKey + ']=' + state2.equippedSkinIds[accountKey])
  }

  // ---- LocalCapeService ----
  const capeUrlRaw = await evaluate(`window.__svc.LocalCapeService.call('setCape', { account: 'x://OFFLINE@dev:e2e-profile', source: ${JSON.stringify(pngPath)} }).then(r => String(r)).catch(e => 'ERR: ' + (e && (e.message || e.code) || String(e)))`)
  const capeUrl = capeUrlRaw && !String(capeUrlRaw).startsWith('ERR') ? capeUrlRaw : null
  console.log('setCape raw:', String(capeUrlRaw).slice(0, 200))
  record('LocalCapeService.setCape (local PNG)', typeof capeUrl === 'string' && capeUrl.startsWith('http://launcher/media'), capeUrl)
  const capeState = JSON.parse(await evaluate(`window.__svc.LocalCapeService.call('getState').then(r => JSON.stringify(r))`))
  record('LocalCapeService.getState persists per account', capeState.capes['x://OFFLINE@dev:e2e-profile'] === capeUrl, JSON.stringify(capeState.capes))
  if (typeof capeUrl === 'string') {
    const capeStatus = await evaluate(`fetch(${JSON.stringify(capeUrl)}).then(r => r.status)`)
    record('Custom cape served over launcher media protocol', capeStatus === 200, 'GET -> ' + capeStatus)
  }
  await evaluate(`window.__svc.LocalCapeService.call('removeCape', 'x://OFFLINE@dev:e2e-profile').catch(e => 'ERR:' + e)`)
  const capeState2 = JSON.parse(await evaluate(`window.__svc.LocalCapeService.call('getState').then(r => JSON.stringify(r))`))
  record('LocalCapeService.removeCape', !capeState2.capes['x://OFFLINE@dev:e2e-profile'], JSON.stringify(capeState2.capes))

  // ---- offline uploadSkin (full local skin apply, no Mojang) ----
  const uploaded = await evaluate(`window.__svc.UserService.call('uploadSkin', {
    userId: 'x://OFFLINE@dev',
    skin: { url: ${JSON.stringify('file://' + pngPath)}, slim: false }
  }).then(() => 'ok').catch(e => 'ERR: ' + (e.message || e.code || JSON.stringify(e).slice(0, 120)))`)
  record('UserService.uploadSkin on offline account (local path)', uploaded === 'ok', uploaded)

  // verify the offline profile texture url updated
  const profRaw = await evaluate(`window.__svc.UserService.call('getUserState').then(s => JSON.stringify((() => {
    const off = s.users['x://OFFLINE@dev']
    const p = off && Object.values(off.profiles)[0]
    return p ? p.textures : null
  })()))`)
  const prof = JSON.parse(profRaw)
  record('Offline profile SKIN texture updated locally', !!prof && !!prof.SKIN && !!prof.SKIN.url, JSON.stringify(prof).slice(0, 200))

  // ---- cleanup ----
  if (skinId) {
    await evaluate(`window.__svc.LocalSkinService.call('removeSkin', ${JSON.stringify(skinId)}).catch(e => 'ERR:' + e)`)
    const state3 = JSON.parse(await evaluate(`window.__svc.LocalSkinService.call('getState').then(r => JSON.stringify(r))`))
    record('Cleanup: test skin removed', !state3.skins.some(s => s.id === skinId), (state3.skins || []).length + ' skins remain')
  }

  fs.writeFileSync(path.join(__dirname, 'artifacts', 'service-results.json'), JSON.stringify(results, null, 2))
  console.log('\nSUMMARY: ' + results.filter(r => r.ok).length + '/' + results.length + ' passed')
  ws.close()
  process.exit(0)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
