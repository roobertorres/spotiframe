/**
 * Browser-side asset helpers: fonts, text measurement and cover loading.
 */
import type { Measure } from './layout'

export const FONT_FAMILY = 'Poppins'

let fontsPromise: Promise<void> | null = null

/** Load the poster fonts once; layout depends on their metrics. */
export function ensureFonts(): Promise<void> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      document.fonts.load(`400 20px ${FONT_FAMILY}`),
      document.fonts.load(`500 20px ${FONT_FAMILY}`)
    ]).then(() => undefined)
  }
  return fontsPromise
}

let measureCtx: CanvasRenderingContext2D | null = null

export const measureText: Measure = (text, size, weight) => {
  measureCtx ??= document.createElement('canvas').getContext('2d')!
  measureCtx.font = `${weight} 100px ${FONT_FAMILY}, sans-serif`
  return (measureCtx.measureText(text).width * size) / 100
}

export interface CoverAsset {
  blob: Blob
  /** object URL for display; revoke with disposeCover */
  objectUrl: string
  img: HTMLImageElement
  width: number
  height: number
  mime: string
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode the cover image'))
    img.src = url
  })
}

export async function coverFromBlob(blob: Blob): Promise<CoverAsset> {
  const objectUrl = URL.createObjectURL(blob)
  try {
    const img = await loadImage(objectUrl)
    return { blob, objectUrl, img, width: img.naturalWidth, height: img.naturalHeight, mime: blob.type }
  } catch (e) {
    URL.revokeObjectURL(objectUrl)
    throw e
  }
}

/** Fetches a cover through the same-origin proxy so the canvas is never tainted. */
export async function loadCover(url: string): Promise<CoverAsset> {
  const direct = url.startsWith('data:') || url.startsWith('blob:')
  const res = await fetch(direct ? url : `/api/cover-proxy?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error(`Cover download failed (${res.status})`)
  return coverFromBlob(await res.blob())
}

export function disposeCover(cover: CoverAsset | null) {
  if (cover) URL.revokeObjectURL(cover.objectUrl)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function slugify(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'poster'
  )
}
