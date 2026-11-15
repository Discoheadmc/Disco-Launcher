// Disco Launcher icon pipeline, step 2 (plain Node).
// Packs the resized PNGs produced by generate-icon-pngs.mjs into:
//   icons/dark.ico   (16/24/32/48/64/128/256)
//   icons/dark.icns  (ic07/ic08/ic09/ic10 PNG-compressed entries)
// plus the light.* copies and the PNG assets the app imports directly
// (dark@256x256.png, dark@tray.png, ...).
//
// Usage: node scripts/pack-icons.mjs <pngDir> <iconsDir>

import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs'
import { join } from 'path'

const [pngDir, iconsDir] = process.argv.slice(2)
if (!pngDir || !iconsDir) {
  console.error('usage: node pack-icons.mjs <pngDir> <iconsDir>')
  process.exit(2)
}
const pngPath = (s) => join(pngDir, `icon-${s}.png`)
const png = (s) => readFileSync(pngPath(s))

// ---- ICO ------------------------------------------------------------------
const ico = await pngToIco([16, 24, 32, 48, 64, 128, 256].map(png))
writeFileSync(join(iconsDir, 'dark.ico'), ico)

// ---- ICNS -----------------------------------------------------------------
// Modern ICNS entries (ic07...ic10) store PNG data directly.
const ICNS_TYPES = [
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
]
const chunks = ['icns']
let totalLen = 8
for (const [t] of ICNS_TYPES) {
  const d = png(ICNS_TYPES.find(([tt]) => tt === t)[1])
  chunks.push(t, d)
  totalLen += 8 + d.length
}
const header = Buffer.alloc(8)
header.write('icns', 0, 'ascii')
header.writeUInt32BE(totalLen, 4)
const icnsParts = [header]
let acc = 8
for (let i = 1; i < chunks.length; i += 2) {
  const type = Buffer.alloc(4)
  type.write(chunks[i], 0, 'ascii')
  const data = chunks[i + 1]
  const len = Buffer.alloc(4)
  len.writeUInt32BE(8 + data.length, 0)
  icnsParts.push(type, len, data)
  acc += 8 + data.length
}
writeFileSync(join(iconsDir, 'dark.icns'), Buffer.concat(icnsParts))

// ---- PNG assets the code imports -------------------------------------------
copyFileSync(pngPath(256), join(iconsDir, 'dark@256x256.png'))
copyFileSync(pngPath(256), join(iconsDir, 'light@256x256.png'))
copyFileSync(pngPath(32), join(iconsDir, 'dark@tray.png'))
copyFileSync(pngPath(32), join(iconsDir, 'light@tray.png'))
for (const f of ['dark@SmallTile.png', 'dark@Square44x44Logo.png', 'dark@Square150x150Logo.png', 'dark@Square44x44Logo.targetsize-256.png', 'dark@Square44x44Logo.targetsize-256_altform-unplated.png', 'dark@StoreLogo.png']) {
  const size = f.includes('Square44') ? 44 : f.includes('SmallTile') ? 32 : f.includes('StoreLogo') ? 50 : 150
  copyFileSync(pngPath(size), join(iconsDir, f))
}
if (!existsSync(join(iconsDir, 'light.icns'))) copyFileSync(join(iconsDir, 'dark.icns'), join(iconsDir, 'light.icns'))
copyFileSync(join(iconsDir, 'dark.ico'), join(iconsDir, 'light.ico'))
copyFileSync(join(iconsDir, 'dark.icns'), join(iconsDir, 'light.icns'))

console.log('icons packed:', join(iconsDir, 'dark.ico'), join(iconsDir, 'dark.icns'))
