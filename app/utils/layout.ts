/**
 * Poster layout engine.
 *
 * Produces a renderer-agnostic list of drawing operations in a fixed
 * coordinate system (paper width = 1000 units, height follows the paper
 * aspect ratio). The SVG preview, the vector PDF and the PNG exporter all
 * consume the same list, so what you see is exactly what gets printed.
 */

export const PAPER_W = 1000

export type PaperFormatId = 'a4' | 'a3' | 'a2'

export interface PaperFormat {
  id: PaperFormatId
  label: string
  /** width x height in millimetres */
  mm: [number, number]
}

export const PAPER_FORMATS: Record<PaperFormatId, PaperFormat> = {
  a4: { id: 'a4', label: 'A4 (210 × 297 mm)', mm: [210, 297] },
  a3: { id: 'a3', label: 'A3 (297 × 420 mm)', mm: [297, 420] },
  a2: { id: 'a2', label: 'A2 (420 × 594 mm)', mm: [420, 594] }
}

export interface PosterContent {
  title: string
  artist: string
  showArtist: boolean
  releaseDate: string
  totalDuration: string
  tracks: string[]
  /** 5 hex colors, light to dark */
  palette: string[]
}

export type Measure = (text: string, size: number, weight: number) => number

export type TextOp = {
  type: 'text'
  x: number
  /** baseline */
  y: number
  text: string
  size: number
  weight: 400 | 500
  anchor: 'start' | 'end'
  fill: string
}
export type RectOp = { type: 'rect'; x: number; y: number; w: number; h: number; fill: string }
export type LineOp = { type: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; stroke: string }
export type CoverOp = { type: 'cover'; x: number; y: number; w: number; h: number }
export type CodeOp = { type: 'code'; x: number; y: number; w: number; h: number }
export type Op = TextOp | RectOp | LineOp | CoverOp | CodeOp

export interface PosterLayout {
  width: number
  height: number
  ops: Op[]
}

// ---- Geometry (paper width = 1000) -----------------------------------------
const MARGIN = 65
const CONTENT_W = PAPER_W - MARGIN * 2 // 870
const INK = '#000000'
const PAPER = '#ffffff'

const HEADER_SIZE = 17
const HEADER_BASELINE = 80
const HEADER_RULE_Y = 92
const COVER_Y = 110
const PALETTE_Y = COVER_Y + CONTENT_W + 18 // 998
const PALETTE_H = 28
const TITLE_SIZE = 54
const TITLE_BASELINE = 1100
const TRACK_SIZE = 17
const TRACK_LINE_HEIGHT = 25
const TRACK_FIRST_BASELINE = 1148
const COL1_X = MARGIN
const COL2_X = 398
const COL1_MAX_W = 315
const COL2_MAX_W = 240
const CODE_W = 290
const CODE_H = 72.5
// the scannable has built-in padding: bars end at 380/400 of its width
const CODE_X = PAPER_W - MARGIN - CODE_W * (380 / 400)
const CODE_Y = 1243
const BOTTOM_MARGIN = 65

/** Replace the tail of `text` with an ellipsis until it fits `maxW` (surrogate-pair safe). */
export function fitText(text: string, size: number, weight: number, maxW: number, measure: Measure): string {
  if (measure(text, size, weight) <= maxW) return text
  const chars = Array.from(text)
  let lo = 0
  let hi = chars.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    const candidate = chars.slice(0, mid).join('').trimEnd() + '…'
    if (measure(candidate, size, weight) <= maxW) lo = mid
    else hi = mid - 1
  }
  return chars.slice(0, lo).join('').trimEnd() + '…'
}

/** Number of rows each track column holds for a given track count. */
export function trackRows(count: number): number {
  if (count <= 8) return Math.max(count, 1)
  if (count <= 16) return 8
  return Math.ceil(count / 2)
}

export function buildLayout(content: PosterContent, format: PaperFormat, measure: Measure): PosterLayout {
  const height = (PAPER_W * format.mm[1]) / format.mm[0]
  const ops: Op[] = []

  ops.push({ type: 'rect', x: 0, y: 0, w: PAPER_W, h: height, fill: PAPER })

  // Header: date (left), duration (right), rule below
  const dateText = fitText(content.releaseDate, HEADER_SIZE, 500, CONTENT_W / 2 - 10, measure)
  const durText = fitText(content.totalDuration, HEADER_SIZE, 500, CONTENT_W / 2 - 10, measure)
  if (dateText) {
    ops.push({ type: 'text', x: MARGIN, y: HEADER_BASELINE, text: dateText, size: HEADER_SIZE, weight: 500, anchor: 'start', fill: INK })
  }
  if (durText) {
    ops.push({ type: 'text', x: PAPER_W - MARGIN, y: HEADER_BASELINE, text: durText, size: HEADER_SIZE, weight: 500, anchor: 'end', fill: INK })
  }
  ops.push({ type: 'line', x1: MARGIN, y1: HEADER_RULE_Y, x2: PAPER_W - MARGIN, y2: HEADER_RULE_Y, width: 1.2, stroke: INK })

  // Cover (square)
  ops.push({ type: 'cover', x: MARGIN, y: COVER_Y, w: CONTENT_W, h: CONTENT_W })

  // Palette bar: 5 equal segments
  const colors = content.palette.length ? content.palette : ['#c1c0c3', '#607894', '#3e5976', '#1b334f', '#000000']
  const segW = CONTENT_W / colors.length
  colors.forEach((fill, i) => {
    ops.push({ type: 'rect', x: MARGIN + i * segW, y: PALETTE_Y, w: segW, h: PALETTE_H, fill })
  })

  // Title (+ optional artist on the same baseline, right aligned)
  let titleMax = CONTENT_W
  if (content.showArtist && content.artist) {
    const artistText = fitText(content.artist, 22, 400, CONTENT_W * 0.38, measure)
    ops.push({ type: 'text', x: PAPER_W - MARGIN, y: TITLE_BASELINE, text: artistText, size: 22, weight: 400, anchor: 'end', fill: INK })
    titleMax = CONTENT_W - measure(artistText, 22, 400) - 30
  }
  if (content.title) {
    const natural = measure(content.title, TITLE_SIZE, 500)
    const size = natural > titleMax ? Math.max(30, (TITLE_SIZE * titleMax) / natural) : TITLE_SIZE
    const text = fitText(content.title, size, 500, titleMax, measure)
    ops.push({ type: 'text', x: MARGIN, y: TITLE_BASELINE, text, size, weight: 500, anchor: 'start', fill: INK })
  }

  // Tracklist: column-major, two columns
  const tracks = content.tracks.filter(t => t.trim().length > 0)
  const rows = trackRows(tracks.length)
  // Keep the last baseline above the bottom rule: 8 rows fit at full size.
  const scale = rows > 8 ? Math.max(0.3, 7 / (rows - 1)) : 1
  const tSize = TRACK_SIZE * scale
  const tLine = TRACK_LINE_HEIGHT * scale
  tracks.forEach((name, i) => {
    const col = Math.floor(i / rows)
    if (col > 1) return
    const row = i % rows
    const x = col === 0 ? COL1_X : COL2_X
    const maxW = col === 0 ? COL1_MAX_W : COL2_MAX_W
    ops.push({
      type: 'text',
      x,
      y: TRACK_FIRST_BASELINE + row * tLine,
      text: fitText(name.trim(), tSize, 400, maxW, measure),
      size: tSize,
      weight: 400,
      anchor: 'start',
      fill: INK
    })
  })

  // Spotify code, bottom right
  ops.push({ type: 'code', x: CODE_X, y: CODE_Y, w: CODE_W, h: CODE_H })

  // Bottom rule, anchored to the bottom margin
  const bottomY = height - BOTTOM_MARGIN
  ops.push({ type: 'line', x1: MARGIN, y1: bottomY, x2: PAPER_W - MARGIN, y2: bottomY, width: 1.2, stroke: INK })

  return { width: PAPER_W, height, ops }
}
