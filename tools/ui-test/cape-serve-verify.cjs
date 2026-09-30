/* Gerçek pelerinle 200 + PNG akış testi: closet/capes.json'daki hesap anahtarıyla endpoint'ten çek */
const path = require('path')
const fs = require('fs')
const http = require('http')

const HOME = process.env.USERPROFILE || 'C:/Users/Disco'
const capesJson = path.join(HOME, 'AppData', 'Roaming', 'Disco Launcher', 'closet', 'capes.json')

function httpGet (url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 5000 }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), type: res.headers['content-type'] }))
    })
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: Buffer.alloc(0), type: '' }) })
    req.on('error', () => resolve({ status: 0, body: Buffer.alloc(0), type: '' }))
  })
}

async function main () {
  let capes = {}
  try {
    capes = JSON.parse(fs.readFileSync(capesJson, 'utf-8')).capes || {}
  } catch (e) {
    console.log('capes.json okunamadı:', e.message)
  }
  const accounts = Object.keys(capes)
  console.log('capes.json hesapları:', accounts.length ? accounts : '(yok)')

  const port = process.env.CAPE_PORT || 25555
  if (accounts.length === 0) {
    console.log('Sonuç: kayıtlı pelerin yok — endpoint 404 dönmesi doğru. (UI üzerinden pelerin ekleyip tekrar test edilmeli)')
    process.exit(0)
  }
  const account = accounts[0]
  const r = await httpGet(`http://localhost:${port}/disco/cape?account=${encodeURIComponent(account)}`)
  const isPng = r.body.length > 8 && r.body[0] === 0x89 && r.body[1] === 0x50 && r.body[2] === 0x4E && r.body[3] === 0x47
  console.log(JSON.stringify({
    account: account.slice(0, 12) + '…',
    status: r.status,
    contentType: r.type,
    bytes: r.body.length,
    isPng,
  }))
  console.log(r.status === 200 && isPng ? 'CAPE SERVE OK' : 'CAPE SERVE FAIL')
  process.exit(0)
}
main()
