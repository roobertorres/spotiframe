import { describe, it, expect } from 'vitest'
import { buildLayout, fitText, trackRows, PAPER_FORMATS, type PosterContent, type TextOp } from '~/utils/layout'
import { extractPalette } from '~/utils/palette'
import { injectPngDpi, crc32 } from '~/utils/png'
import { pixelSize } from '~/utils/exportPng'

// Deterministic fake metrics: every code point is 0.5em wide.
const measure = (t: string, size: number) => Array.from(t).length * size * 0.5

const californication: PosterContent = {
  title: 'Californication',
  artist: 'Red Hot Chili Peppers',
  showArtist: false,
  releaseDate: 'June 8, 1999',
  totalDuration: '1h 7min',
  tracks: [
    'Around the World', 'Parallel Universe', 'Scar Tissue', 'Otherside', 'Get on Top', 'Californication', 'Easily', 'Porcelain',
    'Emit Remmus', 'I Like Dirt', 'This Velvet Glove', 'Savior', 'Purple Stain', 'Right on Time', "Road Trippin'"
  ],
  palette: ['#c1c0c3', '#607894', '#3e5976', '#1b334f', '#000000']
}

const texts = (ops: ReturnType<typeof buildLayout>['ops']) => ops.filter((o): o is TextOp => o.type === 'text')

describe('layout', () => {
  it('lays out the reference poster: header, cover, 5 palette segments, title, 2 columns, code', () => {
    const layout = buildLayout(californication, PAPER_FORMATS.a3, measure)
    const t = texts(layout.ops)
    expect(t.find(o => o.text === 'June 8, 1999')?.anchor).toBe('start')
    expect(t.find(o => o.text === '1h 7min')?.anchor).toBe('end')
    expect(layout.ops.filter(o => o.type === 'cover')).toHaveLength(1)
    expect(layout.ops.filter(o => o.type === 'code')).toHaveLength(1)
    const bar = layout.ops.filter(o => o.type === 'rect' && o.h === 28)
    expect(bar).toHaveLength(5)
    expect(texts(layout.ops).filter(o => o.size < 20 && o.weight === 400)).toHaveLength(15)
  })

  it('splits 15 tracks as 8 + 7 (column-major) like the reference', () => {
    const t = texts(buildLayout(californication, PAPER_FORMATS.a3, measure).ops)
    const left = t.filter(o => o.x === 65 && o.weight === 400)
    const right = t.filter(o => o.x === 398)
    expect(left).toHaveLength(8)
    expect(right).toHaveLength(7)
    expect(left[0]!.text).toBe('Around the World')
    expect(right[0]!.text).toBe('Emit Remmus')
  })

  it('palette order is preserved light → dark', () => {
    const layout = buildLayout(californication, PAPER_FORMATS.a3, measure)
    const fills = layout.ops.filter(o => o.type === 'rect' && o.h === 28).map(o => (o as { fill: string }).fill)
    expect(fills).toEqual(californication.palette)
  })

  it('keeps A-series proportions for A4, A3 and A2', () => {
    for (const f of Object.values(PAPER_FORMATS)) {
      const { width, height } = buildLayout(californication, f, measure)
      expect(height / width).toBeCloseTo(f.mm[1] / f.mm[0], 6)
    }
  })

  it('shrinks the row pitch for very long tracklists instead of overflowing', () => {
    const many = { ...californication, tracks: Array.from({ length: 40 }, (_, i) => `Track ${i + 1}`) }
    const t = texts(buildLayout(many, PAPER_FORMATS.a3, measure).ops).filter(o => o.weight === 400 && o.size < 17)
    expect(t.length).toBe(40)
    expect(Math.max(...t.map(o => o.y))).toBeLessThan(1349)
    expect(trackRows(40)).toBe(20)
  })

  it('editing a field changes the layout', () => {
    const a = buildLayout(californication, PAPER_FORMATS.a3, measure)
    const b = buildLayout({ ...californication, title: 'Other' }, PAPER_FORMATS.a3, measure)
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b))
  })

  it('truncation never splits a surrogate pair', () => {
    const out = fitText('🎵🎵🎵🎵🎵🎵🎵🎵', 10, 400, 30, measure)
    expect(out.endsWith('…')).toBe(true)
    expect(() => encodeURIComponent(out)).not.toThrow()
  })

  it('shows the artist only when asked', () => {
    const off = texts(buildLayout(californication, PAPER_FORMATS.a3, measure).ops)
    const on = texts(buildLayout({ ...californication, showArtist: true }, PAPER_FORMATS.a3, measure).ops)
    expect(off.some(o => o.text === 'Red Hot Chili Peppers')).toBe(false)
    expect(on.some(o => o.text === 'Red Hot Chili Peppers')).toBe(true)
  })
})

describe('palette', () => {
  it('returns 5 hex colors ordered light to dark', () => {
    const px: number[] = []
    const shades = [240, 180, 120, 60, 5]
    for (const s of shades) for (let i = 0; i < 200; i++) px.push(s, s, Math.min(255, s + 20), 255)
    const p = extractPalette(px, 5)
    expect(p).toHaveLength(5)
    expect(p.every(c => /^#[0-9a-f]{6}$/.test(c))).toBe(true)
    const lum = (c: string) => parseInt(c.slice(1, 3), 16)
    for (let i = 1; i < p.length; i++) expect(lum(p[i]!)).toBeLessThanOrEqual(lum(p[i - 1]!))
  })

  it('still returns 5 colors for a flat image', () => {
    const px: number[] = []
    for (let i = 0; i < 100; i++) px.push(10, 20, 30, 255)
    expect(extractPalette(px, 5)).toHaveLength(5)
  })
})

describe('png dpi + export sizes', () => {
  // 1x1 transparent PNG
  const tiny = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
    c => c.charCodeAt(0)
  )

  it('injects a valid pHYs chunk of 11811 px/m for 300 DPI', () => {
    const out = injectPngDpi(tiny, 300)
    const dv = new DataView(out.buffer)
    const at = 8 + 8 + 13 + 4
    expect(String.fromCharCode(...out.subarray(at + 4, at + 8))).toBe('pHYs')
    expect(dv.getUint32(at + 8)).toBe(11811)
    expect(dv.getUint32(at + 12)).toBe(11811)
    expect(out[at + 16]).toBe(1)
    expect(dv.getUint32(at + 17)).toBe(crc32(out.subarray(at + 4, at + 17)))
    // idempotent: re-injecting keeps exactly one pHYs
    const again = injectPngDpi(out, 300)
    expect(again.length).toBe(out.length)
  })

  it('A3 and A2 at 300 DPI have the expected pixel sizes', () => {
    expect(pixelSize(PAPER_FORMATS.a3, 300)).toEqual({ width: 3508, height: 4961 })
    expect(pixelSize(PAPER_FORMATS.a2, 300)).toEqual({ width: 4961, height: 7016 })
  })
})
