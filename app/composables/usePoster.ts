import type { AlbumData, SearchResultItem } from '#shared/types'
import { coverFromBlob, disposeCover, loadCover, type CoverAsset } from '~/utils/assets'
import { paletteFromImage } from '~/utils/palette'
import { parseSpotifyCode, type VectorCode } from '~/utils/svgVector'
import type { PosterContent } from '~/utils/layout'

const DEFAULT_PALETTE = ['#c1c0c3', '#607894', '#3e5976', '#1b334f', '#000000']

/** All poster state: album data, editable fields, cover, palette and Spotify code. */
export function usePoster() {
  const content = reactive<PosterContent>({
    title: '',
    artist: '',
    showArtist: false,
    releaseDate: '',
    totalDuration: '',
    tracks: [],
    palette: [...DEFAULT_PALETTE]
  })
  const cover = shallowRef<CoverAsset | null>(null)
  const coverSource = ref('')
  const code = shallowRef<VectorCode | null>(null)
  const loading = ref(false)
  const error = ref('')
  const isMock = ref(false)

  async function setCover(next: CoverAsset, source: string, recolor = true) {
    disposeCover(cover.value)
    cover.value = next
    coverSource.value = source
    if (recolor) content.palette = paletteFromImage(next.img)
  }

  async function useUploadedCover(file: File) {
    error.value = ''
    try {
      await setCover(await coverFromBlob(file), 'upload')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Could not read that image'
    }
  }

  function recomputePalette() {
    if (cover.value) content.palette = paletteFromImage(cover.value.img)
  }

  async function search(q: string): Promise<SearchResultItem[]> {
    const res = await $fetch<{ results: SearchResultItem[]; isMock?: boolean }>('/api/spotify/search', { query: { q } })
    isMock.value = !!res.isMock
    return res.results
  }

  async function selectAlbum(id: string) {
    loading.value = true
    error.value = ''
    try {
      const album = await $fetch<AlbumData>(`/api/spotify/album/${encodeURIComponent(id)}`)
      isMock.value = !!album.isMock
      content.title = album.title
      content.artist = album.artist
      content.releaseDate = album.releaseDate
      content.totalDuration = album.totalDuration
      content.tracks = album.tracks.map(t => t.name)

      const [coverResult, svg] = await Promise.allSettled([
        loadCover(album.coverUrl),
        album.spotifyCodeSvg
          ? Promise.resolve(album.spotifyCodeSvg)
          : $fetch<{ svg: string }>(`/api/spotify/code/${encodeURIComponent(album.id)}`, {
              query: { format: 'json', uri: album.spotifyUri, bg: 'ffffff', color: '000000' }
            }).then(r => r.svg)
      ])

      if (coverResult.status === 'fulfilled') {
        await setCover(coverResult.value, album.coverSource ?? 'spotify')
      } else {
        error.value = 'Não foi possível baixar a capa. Envie a imagem manualmente.'
      }
      code.value = svg.status === 'fulfilled' ? parseSpotifyCode(svg.value) : null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Falha ao carregar o álbum'
    } finally {
      loading.value = false
    }
  }

  onBeforeUnmount(() => disposeCover(cover.value))

  return { content, cover, coverSource, code, loading, error, isMock, search, selectAlbum, useUploadedCover, recomputePalette }
}
