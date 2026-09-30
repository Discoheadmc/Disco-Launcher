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
  const expr = `(function(){
    var ids = Array.from(document.querySelectorAll('[data-testid]')).map(function(e){return e.getAttribute('data-testid')})
    var uniq = Array.from(new Set(ids))
    return JSON.stringify({ count: uniq.length, ids: uniq.slice(0, 60), navAny: uniq.filter(function(i){return i.indexOf('nav')>=0}) })
  })()`
  ws.on('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }))
  })
  ws.on('message', (m) => {
    const msg = JSON.parse(m)
    console.log(msg.result && msg.result.result ? msg.result.result.value : JSON.stringify(msg).slice(0, 500))
    process.exit(0)
  })
})
