/**
 * PNG helpers: canvas.toBlob() writes no physical resolution, so printers
 * would treat the file as 72 DPI. We inject a pHYs chunk with the real DPI.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Returns a copy of the PNG with a pHYs chunk (pixels per metre) right after IHDR. */
export function injectPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  for (let i = 0; i < 8; i++) {
    if (png[i] !== PNG_SIGNATURE[i]) throw new Error('Not a PNG file')
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const ihdrLen = view.getUint32(8)
  const ihdrEnd = 8 + 8 + ihdrLen + 4 // length + type + data + crc

  // Drop any existing pHYs so the result has exactly one.
  const kept: Uint8Array[] = []
  let offset = ihdrEnd
  while (offset < png.length) {
    const len = view.getUint32(offset)
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8))
    const end = offset + 12 + len
    if (type !== 'pHYs') kept.push(png.subarray(offset, end))
    offset = end
  }

  const ppm = Math.round(dpi / 0.0254)
  const chunk = new Uint8Array(21)
  const cv = new DataView(chunk.buffer)
  cv.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  cv.setUint32(8, ppm)
  cv.setUint32(12, ppm)
  chunk[16] = 1 // unit: metre
  cv.setUint32(17, crc32(chunk.subarray(4, 17)))

  const total = ihdrEnd + chunk.length + kept.reduce((s, k) => s + k.length, 0)
  const out = new Uint8Array(total)
  out.set(png.subarray(0, ihdrEnd), 0)
  out.set(chunk, ihdrEnd)
  let pos = ihdrEnd + chunk.length
  for (const k of kept) {
    out.set(k, pos)
    pos += k.length
  }
  return out
}
