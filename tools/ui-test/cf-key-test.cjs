/* Kayıtlı CurseForge key'ini test et — key değeri asla yazdırılmaz */
const path = require('path')
const fs = require('fs')
const https = require('https')

const setting = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'Disco Launcher', 'setting.json'), 'utf8'))
const key = String(setting.curseforgeApiKey || '')
if (!key) { console.log('NO KEY'); process.exit(0) }
console.log('KEY META: len=' + key.length + ' chars=' + [...key.slice(0, 8)].map(c => /[a-zA-Z0-9]/.test(c) ? c : c === '$' ? '$' : '?').join('') + '...')

function probe(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'x-api-key': key, 'Accept': 'application/json' } }, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve({ status: res.statusCode, body: d.slice(0, 150) }))
    }).on('error', (e) => resolve({ status: 0, body: e.message }))
  })
}

async function main() {
  const r1 = await probe('https://api.curseforge.com/v1/games?pageSize=5')
  console.log('GAMES:', JSON.stringify(r1))
  const r2 = await probe('https://api.curseforge.com/v1/mods/search?gameId=432&classId=4471&searchFilter=sky&pageSize=5')
  console.log('SEARCH:', JSON.stringify(r2))
  process.exit(0)
}
main()
