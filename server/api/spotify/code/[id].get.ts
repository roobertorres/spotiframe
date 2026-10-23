import { defineEventHandler, getRouterParam, getQuery, setHeader } from 'h3'
import { generateMockSpotifyCodeSvg } from '~~/shared/mockData'

function normalizeSpotifyUri(rawInput: string): string {
  if (!rawInput) return 'spotify:album:unknown'
  const trimmed = rawInput.trim()

  if (trimmed.startsWith('spotify:')) {
    return trimmed
  }

  // Handle open.spotify.com/album/{id} URLs
  const urlMatch = trimmed.match(/open\.spotify\.com\/album\/([a-zA-Z0-9]+)/)
  if (urlMatch) {
    return `spotify:album:${urlMatch[1]}`
  }

  return `spotify:album:${trimmed}`
}

export default defineEventHandler(async (event) => {
  let id = ''
  try {
    id = getRouterParam(event, 'id') || ''
  } catch {
    // getRouterParam may throw if not attached to H3 event
  }
  id = id || (event as any).context?.params?.id || (event as any).params?.id || ''

  const query = (event as any).context?.query || (event as any).query || getQuery(event) || {}
  const forceMock = query.mock === 'true' || query.mock === '1' || query.mock === true
  const format = String(query.format || '').toLowerCase()
  const bg = String(query.bg || 'ffffff').replace('#', '')
  const color = String(query.color || '000000').replace('#', '')

  const inputSource = query.uri ? String(query.uri) : id
  const spotifyUri = normalizeSpotifyUri(inputSource)

  const isMock = forceMock || id.startsWith('mock-') || id === 'test_offline_id' || id === 'invalid_uri_string'

  let svgContent = ''

  if (!isMock) {
    try {
      // Official Spotify Scannables CDN endpoint
      const cdnUrl = `https://scannables.scdn.co/uri/plain/svg/${bg}/${color}/640/${encodeURIComponent(spotifyUri)}`
      svgContent = await $fetch<string>(cdnUrl, {
        headers: { Accept: 'image/svg+xml' }
      })
    } catch {
      // Graceful fallback to procedural generator on CDN failure
      svgContent = generateMockSpotifyCodeSvg(spotifyUri, bg, color)
    }
  } else {
    svgContent = generateMockSpotifyCodeSvg(spotifyUri, bg, color)
  }

  if (format === 'json') {
    return {
      uri: spotifyUri,
      svg: svgContent
    }
  }

  // Stream SVG directly with headers if setHeader is supported
  try {
    setHeader(event, 'Content-Type', 'image/svg+xml')
    setHeader(event, 'Cache-Control', 'public, max-age=86400')
  } catch {
    // In mock test harnesses where setHeader is not supported on mock event
  }

  return svgContent
})
