/**
 * Color palette extraction (median cut). Pure function over RGBA pixel data,
 * so it is testable without a DOM. Result is ordered light to dark.
 */

type Px = [number, number, number]

const toHex = (c: number) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')
const hex = (p: Px) => `#${toHex(p[0])}${toHex(p[1])}${toHex(p[2])}`
const luminance = (p: Px) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]

function average(pixels: Px[]): Px {
  const sum: Px = [0, 0, 0]
  for (const p of pixels) {
    sum[0] += p[0]
    sum[1] += p[1]
    sum[2] += p[2]
  }
  const n = pixels.length || 1
  return [sum[0] / n, sum[1] / n, sum[2] / n]
}

function widestChannel(pixels: Px[]): { channel: 0 | 1 | 2; range: number } {
  const min = [255, 255, 255]
  const max = [0, 0, 0]
  for (const p of pixels) {
    for (let c = 0; c < 3; c++) {
      if (p[c]! < min[c]!) min[c] = p[c]!
      if (p[c]! > max[c]!) max[c] = p[c]!
    }
  }
  const ranges = [max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!]
  const channel = ranges[0]! >= ranges[1]! && ranges[0]! >= ranges[2]! ? 0 : ranges[1]! >= ranges[2]! ? 1 : 2
  return { channel, range: ranges[channel]! }
}

export function extractPalette(rgba: ArrayLike<number>, count = 5): string[] {
  const pixels: Px[] = []
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3]! < 128) continue
    pixels.push([rgba[i]!, rgba[i + 1]!, rgba[i + 2]!])
  }
  if (!pixels.length) return Array.from({ length: count }, () => '#808080')

  const boxes: Px[][] = [pixels]
  while (boxes.length < count) {
    let bestIdx = -1
    let bestScore = 0
    boxes.forEach((box, i) => {
      if (box.length < 2) return
      const { range } = widestChannel(box)
      const score = range * Math.sqrt(box.length)
      if (range > 0 && score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    })
    if (bestIdx < 0) break
    const box = boxes[bestIdx]!
    const { channel } = widestChannel(box)
    box.sort((a, b) => a[channel] - b[channel])
    const mid = box.length >> 1
    boxes.splice(bestIdx, 1, box.slice(0, mid), box.slice(mid))
  }

  const colors = boxes.map(average).sort((a, b) => luminance(b) - luminance(a))

  // Flat images can yield fewer than `count` distinct colors: pad with a light→dark ramp.
  while (colors.length < count) {
    const first = colors[0]!
    const last = colors[colors.length - 1]!
    const t = colors.length / count
    colors.push([first[0] + (last[0] - first[0]) * t, first[1] + (last[1] - first[1]) * t, first[2] + (last[2] - first[2]) * t])
    colors.sort((a, b) => luminance(b) - luminance(a))
  }
  return colors.map(hex)
}

/** Browser helper: sample the image on a small canvas and extract the palette. */
export function paletteFromImage(img: CanvasImageSource, count = 5): string[] {
  const size = 96
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, size, size)
  return extractPalette(ctx.getImageData(0, 0, size, size).data, count)
}
