// Generates flat-color rounded-square PNG app icons with a checkmark glyph,
// using only Node's zlib (no image library dependency).
// Run with: node scripts/gen-icons.cjs
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const BG = [67, 56, 202, 255] // #4338ca
const FG = [255, 255, 255, 255]

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)))
  const cx = ax + t * abx
  const cy = ay + t * aby
  return Math.hypot(px - cx, py - cy)
}

function makeIcon(size) {
  const radius = size * 0.22
  const strokeWidth = size * 0.09
  // checkmark points, in 0..1 space of the icon
  const p1 = [size * 0.28, size * 0.52]
  const p2 = [size * 0.44, size * 0.68]
  const p3 = [size * 0.74, size * 0.33]

  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      // rounded-corner mask
      let inside = true
      const corners = [
        [radius, radius],
        [size - radius, radius],
        [radius, size - radius],
        [size - radius, size - radius],
      ]
      if (x < radius && y < radius) inside = Math.hypot(x - corners[0][0], y - corners[0][1]) <= radius
      else if (x > size - radius && y < radius) inside = Math.hypot(x - corners[1][0], y - corners[1][1]) <= radius
      else if (x < radius && y > size - radius) inside = Math.hypot(x - corners[2][0], y - corners[2][1]) <= radius
      else if (x > size - radius && y > size - radius)
        inside = Math.hypot(x - corners[3][0], y - corners[3][1]) <= radius

      if (!inside) {
        pixels[idx] = 0
        pixels[idx + 1] = 0
        pixels[idx + 2] = 0
        pixels[idx + 3] = 0
        continue
      }

      const dCheck = Math.min(
        distToSegment(x, y, p1[0], p1[1], p2[0], p2[1]),
        distToSegment(x, y, p2[0], p2[1], p3[0], p3[1]),
      )
      const color = dCheck <= strokeWidth / 2 ? FG : BG
      pixels[idx] = color[0]
      pixels[idx + 1] = color[1]
      pixels[idx + 2] = color[2]
      pixels[idx + 3] = color[3]
    }
  }
  return pixels
}

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter type: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const idat = zlib.deflateSync(raw)

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = path.join(__dirname, '..', 'public')
for (const size of [192, 512]) {
  const png = encodePng(size, makeIcon(size))
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png)
  console.log(`wrote icon-${size}.png`)
}
const apple = encodePng(180, makeIcon(180))
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), apple)
console.log('wrote apple-touch-icon.png')
