// Member-facing pixels. Upstream's logo and labeled placeholder stay out of the view.
import { deflateSync } from 'node:zlib'

function crc32(bytes) {
  let crc = ~0
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

function png(width, height, channels, paint) {
  const stride = width * channels + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const row = y * stride
    raw[row] = 0
    for (let x = 0; x < width; x++) paint(raw, row + 1 + x * channels)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = channels === 4 ? 6 : 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** Same panel color as the vendored placeholder, with the English label removed. */
export function blankTemplatePng() {
  return png(1200, 900, 3, (raw, index) => {
    raw[index] = 49
    raw[index + 1] = 52
    raw[index + 2] = 61
  })
}

/** Transparent stand-in. The editor draws its own document mark in chrome.css. */
export function blankLogoPng() {
  return png(1, 1, 4, (raw, index) => {
    raw[index + 3] = 0
  })
}
