// Disco Launcher icon pipeline, step 1.
// Usage: pnpm exec electron scripts/generate-icon-pngs.mjs <source> <outDir>
//
// Reads the source logo (JPEG or PNG), makes the checkerboard "fake
// transparency" background actually transparent, crops to square, and writes
// the sizes needed by the packer: 16, 24, 32, 48, 64, 128, 256, 512, 1024.
//
// Transparency is applied at full resolution and encoded as a real PNG by
// hand (zlib + CRC32), because Electron's createFromBuffer(raw bitmap) does
// not reliably round-trip alpha. The resized outputs are produced by Electron
// from that decoded transparent PNG (createFromBuffer supports encoded PNGs
// and keeps their alpha).

import { app, nativeImage } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { deflateSync } from 'zlib'

app.disableHardwareAcceleration()

const [source, outDir] = process.argv.slice(2)
if (!source || !outDir) {
  console.error('usage: electron generate-icon-pngs.mjs <source> <outDir>')
  process.exit(2)
}

const SIZES = [16, 24, 32, 44, 48, 50, 64, 128, 150, 256, 512, 1024]

// ---- minimal PNG encoder (RGBA, filter 0) ----------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodeRgbaPng(rgba, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- checkerboard removal ---------------------------------------------------
function stripCheckerboard(bgra, w, h) {
  const at = (x, y) => (y * w + x) * 4
  // Checker shades are neutral grays (r≈g≈b) and light. The logo grays are
  // slate/blue-tinted with larger channel spread, so use both tests.
  const isBgColor = (i) => {
    const b = bgra[i], g = bgra[i + 1], r = bgra[i + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    return (max - min) <= 10 && min >= 170
  }
  const seen = new Uint8Array(w * h)
  const stack = []
  const push = (x, y) => {
    const p = y * w + x
    if (seen[p]) return
    if (!isBgColor(p * 4)) return
    seen[p] = 1
    stack.push(p)
  }
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }
  let cleared = 0
  while (stack.length) {
    const p = stack.pop()
    bgra[p * 4 + 3] = 0
    cleared++
    const x = p % w, y = (p / w) | 0
    if (x > 0) push(x - 1, y)
    if (x < w - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < h - 1) push(x, y + 1)
  }
  // Cleanup: bleed transparency into leftover gray halo pixels that touch
  // transparent areas (JPEG noise rings around the logo edge).
  for (let pass = 0; pass < 3; pass++) {
    const toClear = []
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x
        if (bgra[p * 4 + 3] === 0) continue
        const i = p * 4
        const max = Math.max(bgra[i], bgra[i + 1], bgra[i + 2])
        const min = Math.min(bgra[i], bgra[i + 1], bgra[i + 2])
        if ((max - min) > 14 || min < 160) continue
        if (
          bgra[at(x - 1, y) + 3] === 0 || bgra[at(x + 1, y) + 3] === 0 ||
          bgra[at(x, y - 1) + 3] === 0 || bgra[at(x, y + 1) + 3] === 0
        ) toClear.push(p)
      }
    }
    if (!toClear.length) break
    for (const p of toClear) { bgra[p * 4 + 3] = 0; cleared++ }
  }
  return cleared
}

app.whenReady().then(() => {
  const src = nativeImage.createFromPath(source)
  if (src.isEmpty()) {
    console.error('cannot read source image:', source)
    process.exit(1)
  }

  // Crop to square (drop the extra rows at the bottom).
  let img = src
  const { width, height } = src.getSize()
  const side = Math.min(width, height)
  if (width !== height) {
    img = src.crop({ x: 0, y: 0, width: side, height: side })
  }

  const raw = img.toBitmap() // BGRA on win/linux
  const w = side, h = side
  const cleared = stripCheckerboard(raw, w, h)
  console.log(`checkerboard cleared pixels: ${cleared} / ${w * h}`)

  // BGRA -> RGBA and hand-encode a real PNG with alpha.
  const rgba = Buffer.allocUnsafe(w * h * 4)
  for (let o = 0; o < raw.length; o += 4) {
    rgba[o] = raw[o + 2]
    rgba[o + 1] = raw[o + 1]
    rgba[o + 2] = raw[o]
    rgba[o + 3] = raw[o + 3]
  }
  const fullPng = encodeRgbaPng(rgba, w, h)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'icon-1024.png'), fullPng)

  // Resize from the decoded transparent PNG (alpha preserved).
  const full = nativeImage.createFromBuffer(fullPng)
  for (const size of SIZES) {
    if (size === 1024) continue
    const scaled = full.resize({ width: size, height: size, quality: 'best' })
    writeFileSync(join(outDir, `icon-${size}.png`), scaled.toPNG())
  }
  console.log('wrote sizes:', SIZES.join(', '))
  app.quit()
})
