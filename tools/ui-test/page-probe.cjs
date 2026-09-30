/* Anlık sayfa durumu probe'u */
const http = require('http')
const path = require('path')
const WebSocket = require(path.join(process.env.REPO, 'node_modules', '.pnpm', 'ws@8.21.3', 'node_modules', 'ws'))
const PORT = parseInt(process.env.CDP_PORT || '9777', 10)
http.get(`http://127.0.0.1:${PORT}/json/list`, (res) => {
  let d = ''
  res.on('data', (c) => { d += c })
  res.on('end', () => {
    const targets = JSON.parse(d)
    const page = targets.find((t) => t.type === 'page' && t.url.includes('disco.runtime'))
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `JSON.stringify({
            hash: location.hash,
            colorRow: !!document.querySelector('.color-theme-row'),
            colorButtons: document.querySelectorAll('.color-theme-row .color-button').length,
            bodySnippet: document.body.innerText.slice(0, 300)
          })`,
          returnByValue: true,
        },
      }))
    })
    ws.on('message', (m) => {
      const msg = JSON.parse(m)
      if (msg.id === 1) {
        console.log('SONUC:', msg.result && msg.result.result ? msg.result.result.value : JSON.stringify(msg).slice(0, 300))
        process.exit(0)
      }
    })
  })
})
