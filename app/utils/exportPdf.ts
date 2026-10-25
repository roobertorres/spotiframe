/**
 * Vector PDF export (runs in browser and test environments).
 * Text and the Spotify code are drawn as vectors; cover is embedded at full resolution.
 */
import { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { PAPER_FORMATS, type PaperFormat, type PosterLayout, type PaperFormatId } from './layout'
import type { VectorCode } from './svgVector'
import type { CoverAsset } from './assets'
import type { PosterState } from '#shared/types'

const MM_TO_PT = 72 / 25.4

function color(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.replace(/./g, c => c + c) : h
  const n = parseInt(full, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  if (typeof window === 'undefined') {
    // Node environment fallback for font loading
    try {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const filePath = path.join(process.cwd(), 'public', url.replace(/^\//, ''))
      if (fs.existsSync(filePath)) {
        return new Uint8Array(fs.readFileSync(filePath))
      }
    } catch {
      // fallback
    }
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url}`)
  return new Uint8Array(await res.arrayBuffer())
}

/** Re-encode formats PDF cannot embed natively (webp, avif, svg…) as lossless PNG. */
async function toPngBytes(cover: CoverAsset): Promise<Uint8Array> {
  const maxSide = 6000
  const scale = Math.min(1, maxSide / Math.max(cover.width, cover.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(cover.width * scale))
  canvas.height = Math.max(1, Math.round(cover.height * scale))
  canvas.getContext('2d')!.drawImage(cover.img, 0, 0, canvas.width, canvas.height)
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG conversion failed'))), 'image/png')
  )
  return new Uint8Array(await blob.arrayBuffer())
}

async function embedCover(doc: PDFDocument, cover: CoverAsset) {
  const bytes = new Uint8Array(await cover.blob.arrayBuffer())
  if (cover.mime === 'image/jpeg') return doc.embedJpg(bytes)
  if (cover.mime === 'image/png') return doc.embedPng(bytes)
  return doc.embedPng(await toPngBytes(cover))
}

export interface PdfExportInput {
  layout: PosterLayout
  format: PaperFormat
  cover: CoverAsset
  code: VectorCode | null
  title: string
}

export async function exportPdf({ layout, format, cover, code, title }: PdfExportInput): Promise<Uint8Array> {
  const pageW = format.mm[0] * MM_TO_PT
  const pageH = format.mm[1] * MM_TO_PT
  const k = pageW / layout.width // layout unit → pt

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(`${title} — Spotiframe`)
  doc.setProducer('Spotiframe')
  doc.setCreator('Spotiframe')

  const [regularBytes, mediumBytes] = await Promise.all([
    fetchBytes('/fonts/Inter-Regular.ttf'),
    fetchBytes('/fonts/Inter-Medium.ttf')
  ])
  const fonts = {
    400: await doc.embedFont(regularBytes, { subset: true }),
    500: await doc.embedFont(mediumBytes, { subset: true })
  }
  const coverImage = await embedCover(doc, cover)

  const page = doc.addPage([pageW, pageH])
  const py = (y: number) => pageH - y * k

  for (const op of layout.ops) {
    switch (op.type) {
      case 'rect':
        page.drawRectangle({ x: op.x * k, y: py(op.y + op.h), width: op.w * k, height: op.h * k, color: color(op.fill) })
        break
      case 'line':
        page.drawLine({
          start: { x: op.x1 * k, y: py(op.y1) },
          end: { x: op.x2 * k, y: py(op.y2) },
          thickness: op.width * k,
          color: color(op.stroke)
        })
        break
      case 'text': {
        const font = fonts[op.weight]
        const size = op.size * k
        const w = font.widthOfTextAtSize(op.text, size)
        page.drawText(op.text, { x: op.anchor === 'end' ? op.x * k - w : op.x * k, y: py(op.y), size, font, color: color(op.fill) })
        break
      }
      case 'cover': {
        const box = op.w * k
        const s = box / Math.min(coverImage.width, coverImage.height)
        const dw = coverImage.width * s
        const dh = coverImage.height * s
        const bx = op.x * k
        const by = py(op.y + op.h)
        page.pushOperators(pushGraphicsState(), rectangle(bx, by, box, box), clip(), endPath())
        page.drawImage(coverImage, { x: bx - (dw - box) / 2, y: by - (dh - box) / 2, width: dw, height: dh })
        page.pushOperators(popGraphicsState())
        break
      }
      case 'code': {
        if (!code) break
        const sc = op.w / code.width
        for (const shape of code.shapes) {
          page.drawSvgPath(shape.d, {
            x: (op.x + shape.tx * sc) * k,
            y: py(op.y + shape.ty * sc),
            scale: sc * k,
            color: color(shape.fill),
            borderWidth: 0
          })
        }
        break
      }
    }
  }

  return doc.save()
}

/**
 * Universal exportToPdf accepting PosterState or PdfExportInput
 */
export async function exportToPdf(stateOrInput: PosterState | PdfExportInput, options: { format?: PaperFormatId } = {}): Promise<Blob> {
  if ('layout' in stateOrInput) {
    const bytes = await exportPdf(stateOrInput)
    return new Blob([bytes as BlobPart], { type: 'application/pdf' })
  }

  const state = stateOrInput as PosterState
  const formatId = options.format?.toLowerCase() === 'a2' ? 'a2' : 'a3'
  const format = PAPER_FORMATS[formatId]
  const pageW = format.mm[0] * MM_TO_PT
  const pageH = format.mm[1] * MM_TO_PT

  const doc = await PDFDocument.create()
  doc.setTitle(`${state.title} — Spotiframe`)
  doc.setProducer('Spotiframe')
  doc.setCreator('Spotiframe')

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([pageW, pageH])

  const margin = pageW * 0.065
  const contentW = pageW - margin * 2

  // Top rule
  page.drawLine({
    start: { x: margin, y: pageH - 85 },
    end: { x: pageW - margin, y: pageH - 85 },
    thickness: 1,
    color: rgb(0, 0, 0)
  })

  // Header text
  if (state.releaseDate) {
    page.drawText(state.releaseDate, { x: margin, y: pageH - 75, font: fontBold, size: 14, color: rgb(0, 0, 0) })
  }
  if (state.totalDuration) {
    const durW = fontBold.widthOfTextAtSize(state.totalDuration, 14)
    page.drawText(state.totalDuration, { x: pageW - margin - durW, y: pageH - 75, font: fontBold, size: 14, color: rgb(0, 0, 0) })
  }

  // Cover image embedding
  let imgEmbedded = false
  if (state.coverUrl) {
    try {
      if (state.coverUrl.startsWith('data:image/png;base64,')) {
        const base64 = state.coverUrl.split(',')[1]!
        const buf = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const img = await doc.embedPng(buf)
        page.drawImage(img, { x: margin, y: pageH - 85 - contentW, width: contentW, height: contentW })
        imgEmbedded = true
      }
    } catch {
      // fallback
    }
  }

  if (!imgEmbedded) {
    // 1x1 placeholder transparent PNG
    const tinyPng = Uint8Array.from(
      atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
      c => c.charCodeAt(0)
    )
    const img = await doc.embedPng(tinyPng)
    page.drawImage(img, { x: margin, y: pageH - 85 - contentW, width: contentW, height: contentW })
  }

  // Palette swatches
  const palette = state.palette?.length ? state.palette : ['#c1c0c3', '#607894', '#3e5976', '#1b334f', '#000000']
  const swatchW = contentW / palette.length
  palette.forEach((hex, i) => {
    page.drawRectangle({
      x: margin + i * swatchW,
      y: pageH - 85 - contentW - 25,
      width: swatchW,
      height: 20,
      color: color(hex)
    })
  })

  // Title
  if (state.title) {
    page.drawText(state.title, {
      x: margin,
      y: pageH - 85 - contentW - 70,
      font: fontBold,
      size: 32,
      color: rgb(0, 0, 0)
    })
  }

  // Tracks in two columns
  const tracks = state.tracks || []
  const half = Math.ceil(tracks.length / 2)
  tracks.forEach((track, i) => {
    const col = i < half ? 0 : 1
    const row = i < half ? i : i - half
    const x = col === 0 ? margin : margin + contentW * 0.42
    const y = pageH - 85 - contentW - 105 - row * 18
    if (y > margin + 50) {
      page.drawText(track, { x, y, font, size: 11, color: rgb(0, 0, 0) })
    }
  })

  // Bottom rule
  page.drawLine({
    start: { x: margin, y: margin + 35 },
    end: { x: pageW - margin, y: margin + 35 },
    thickness: 1,
    color: rgb(0, 0, 0)
  })

  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export default { exportPdf, exportToPdf }
