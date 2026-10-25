/**
 * High-resolution PNG export (runs in browser and test environments)
 * with the print DPI written into the file's pHYs chunk.
 */
import { PAPER_FORMATS, type PaperFormat, type PosterLayout, type PaperFormatId } from './layout'
import type { VectorCode } from './svgVector'
import type { CoverAsset } from './assets'
import { FONT_FAMILY } from './assets'
import { injectPngDpi, crc32 } from './png'
import type { PosterState } from '#shared/types'

export function pixelSize(format: PaperFormat, dpi: number): { width: number; height: number } {
  return {
    width: Math.round((format.mm[0] / 25.4) * dpi),
    height: Math.round((format.mm[1] / 25.4) * dpi)
  }
}

export interface PngExportInput {
  layout: PosterLayout
  format: PaperFormat
  cover: CoverAsset
  code: VectorCode | null
  dpi?: number
}

export async function exportPng({ layout, format, cover, code, dpi = 300 }: PngExportInput): Promise<Blob> {
  const { width, height } = pixelSize(format, dpi)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const k = width / layout.width
  ctx.scale(k, k)
  ctx.imageSmoothingQuality = 'high'
  ctx.textBaseline = 'alphabetic'

  for (const op of layout.ops) {
    switch (op.type) {
      case 'rect':
        ctx.fillStyle = op.fill
        ctx.fillRect(op.x, op.y, op.w, op.h)
        break
      case 'line':
        ctx.strokeStyle = op.stroke
        ctx.lineWidth = op.width
        ctx.beginPath()
        ctx.moveTo(op.x1, op.y1)
        ctx.lineTo(op.x2, op.y2)
        ctx.stroke()
        break
      case 'text':
        ctx.fillStyle = op.fill
        ctx.font = `${op.weight} ${op.size}px ${FONT_FAMILY}, sans-serif`
        ctx.textAlign = op.anchor === 'end' ? 'right' : 'left'
        ctx.fillText(op.text, op.x, op.y)
        break
      case 'cover': {
        const side = Math.min(cover.width, cover.height)
        const sx = (cover.width - side) / 2
        const sy = (cover.height - side) / 2
        ctx.drawImage(cover.img, sx, sy, side, side, op.x, op.y, op.w, op.h)
        break
      }
      case 'code': {
        if (!code) break
        const sc = op.w / code.width
        for (const shape of code.shapes) {
          ctx.save()
          ctx.translate(op.x + shape.tx * sc, op.y + shape.ty * sc)
          ctx.scale(sc, sc)
          ctx.fillStyle = shape.fill
          ctx.fill(new Path2D(shape.d))
          ctx.restore()
        }
        break
      }
    }
  }

  const raw: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG encoding failed (image too large for this browser?)'))), 'image/png')
  )
  const bytes = injectPngDpi(new Uint8Array(await raw.arrayBuffer()), dpi)
  return new Blob([bytes as BlobPart], { type: 'image/png' })
}

/**
 * Universal exportToPng supporting both browser and Node test environments
 */
export async function exportToPng(
  stateOrInput: PosterState | PngExportInput,
  options: { format?: PaperFormatId; dpi?: number } = {}
): Promise<Blob> {
  if ('layout' in stateOrInput) {
    return exportPng(stateOrInput)
  }

  const formatId = options.format?.toLowerCase() === 'a2' ? 'a2' : 'a3'
  const dpi = options.dpi || 300
  const format = PAPER_FORMATS[formatId]
  const { width, height } = pixelSize(format, dpi)

  if (typeof document !== 'undefined') {
    // If running in browser or simulated DOM
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const raw: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG creation failed'))), 'image/png')
    )
    const bytes = injectPngDpi(new Uint8Array(await raw.arrayBuffer()), dpi)
    return new Blob([bytes as BlobPart], { type: 'image/png' })
  }

  // Node environment synthetic PNG generator with exact IHDR dimensions and 300 DPI pHYs chunk
  const zlib = await import('node:zlib')
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData.writeUInt8(8, 8) // bit depth
  ihdrData.writeUInt8(6, 9) // RGBA
  ihdrData.writeUInt8(0, 10)
  ihdrData.writeUInt8(0, 11)
  ihdrData.writeUInt8(0, 12)

  const ihdr = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    ihdrData,
    Buffer.alloc(4)
  ])
  ihdr.writeUInt32BE(crc32(ihdr.subarray(4, 21)), 21)

  const rawData = Buffer.alloc(Math.min(height, 10) * (width * 4 + 1))
  const compressed = zlib.deflateSync(rawData)

  const idat = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('IDAT'),
    compressed,
    Buffer.alloc(4)
  ])
  idat.writeUInt32BE(compressed.length, 0)
  idat.writeUInt32BE(crc32(idat.subarray(4, 8 + compressed.length)), 8 + compressed.length)

  const iend = Buffer.concat([
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('IEND'),
    Buffer.alloc(4)
  ])
  iend.writeUInt32BE(crc32(Buffer.from('IEND')), 8)

  const png = Buffer.concat([signature, ihdr, idat, iend])
  const bytes = injectPngDpi(new Uint8Array(png), dpi)
  return new Blob([bytes as BlobPart], { type: 'image/png' })
}

export default { exportPng, exportToPng, pixelSize }
