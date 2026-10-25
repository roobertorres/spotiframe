import { ref } from 'vue'
import { extractPalette, paletteFromImage } from '~/utils/palette'

export { extractPalette, paletteFromImage }

export function usePalette(initialPalette: string[] = ['#c1c0c3', '#607894', '#3e5976', '#1b334f', '#000000']) {
  const palette = ref<string[]>([...initialPalette])

  function extractFromImage(img: CanvasImageSource, count = 5) {
    const colors = paletteFromImage(img, count)
    palette.value = colors
    return colors
  }

  function setSwatch(index: number, color: string) {
    if (index >= 0 && index < palette.value.length) {
      palette.value[index] = color
    }
  }

  return {
    palette,
    extractFromImage,
    setSwatch
  }
}

export default usePalette
