const path = require('path')
const http = require('http')
const WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9777/json/list', (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
}

getTargets().then(async (targets) => {
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  ws.on('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: '({ ok: 1 + 1, url: location.href })', returnByValue: true } }))
  })
  ws.on('message', (m) => {
    console.log(JSON.stringify(JSON.parse(m), null, 2).slice(0, 800))
    process.exit(0)
  })
})
