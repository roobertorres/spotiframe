/**
 * Turns the Spotify scannable SVG into plain vector shapes (path data + fill)
 * that the SVG preview, canvas PNG export and PDF export can all draw.
 */

export interface VectorShape {
  /** SVG path data in the code's own coordinate system */
  d: string
  fill: string
  /** accumulated translate of ancestor groups */
  tx: number
  ty: number
}

export interface VectorCode {
  width: number
  height: number
  shapes: VectorShape[]
}

const num = (v: string | null, fallback = 0) => {
  const n = parseFloat(v ?? '')
  return Number.isFinite(n) ? n : fallback
}

function rectPath(x: number, y: number, w: number, h: number, rx: number, ry: number): string {
  rx = Math.min(rx || ry, w / 2)
  ry = Math.min(ry || rx, h / 2)
  if (!rx || !ry) return `M${x} ${y}h${w}v${h}h${-w}z`
  return (
    `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}` +
    `a${rx} ${ry} 0 0 1 ${-rx} ${ry}h${-(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}` +
    `v${-(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${rx} ${-ry}z`
  )
}

function circlePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`
}

function translateOf(el: Element): [number, number] {
  const m = /translate\(\s*([-\d.]+)[\s,]*([-\d.]+)?\s*\)/.exec(el.getAttribute('transform') ?? '')
  return m ? [parseFloat(m[1]!), parseFloat(m[2] ?? '0')] : [0, 0]
}

function isWhite(fill: string): boolean {
  const f = fill.trim().toLowerCase()
  return f === '#fff' || f === '#ffffff' || f === 'white' || f === 'none' || f === 'transparent'
}

export function parseSpotifyCode(svg: string): VectorCode {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  const vb = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
  const width = vb.length === 4 && vb[2] ? vb[2] : num(root.getAttribute('width'), 400)
  const height = vb.length === 4 && vb[3] ? vb[3] : num(root.getAttribute('height'), 100)
  const ox = vb.length === 4 ? vb[0]! : 0
  const oy = vb.length === 4 ? vb[1]! : 0

  const shapes: VectorShape[] = []
  const walk = (el: Element, tx: number, ty: number) => {
    const [dx, dy] = translateOf(el)
    tx += dx
    ty += dy
    const tag = el.localName
    const fill = el.getAttribute('fill') ?? '#000000'
    let d = ''
    if (tag === 'rect') {
      d = rectPath(num(el.getAttribute('x')), num(el.getAttribute('y')), num(el.getAttribute('width')), num(el.getAttribute('height')), num(el.getAttribute('rx')), num(el.getAttribute('ry')))
    } else if (tag === 'path') {
      d = el.getAttribute('d') ?? ''
    } else if (tag === 'circle') {
      const r = num(el.getAttribute('r'))
      d = circlePath(num(el.getAttribute('cx')), num(el.getAttribute('cy')), r, r)
    } else if (tag === 'ellipse') {
      d = circlePath(num(el.getAttribute('cx')), num(el.getAttribute('cy')), num(el.getAttribute('rx')), num(el.getAttribute('ry')))
    }
    // The white background plate is dropped: the poster paper is already white.
    if (d && !isWhite(fill)) shapes.push({ d, fill, tx: tx - ox, ty: ty - oy })
    for (const child of Array.from(el.children)) walk(child, tx, ty)
  }
  walk(root, 0, 0)
  return { width, height, shapes }
}
