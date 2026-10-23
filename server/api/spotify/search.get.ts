import { defineEventHandler, getQuery } from 'h3'
import { searchMockAlbums, formatReleaseDate } from '~~/shared/mockData'
import type { SearchResult, SearchResultItem } from '~~/shared/types'

let cachedToken: { token: string; expiresAt: number } | null = null

async function getSpotifyAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.token
  }

  const basicAuth = btoa(`${clientId}:${clientSecret}`)
  const response = await $fetch<{ access_token: string; expires_in: number }>('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })

  cachedToken = {
    token: response.access_token,
    expiresAt: now + (response.expires_in * 1000)
  }

  return response.access_token
}

export default defineEventHandler(async (event): Promise<SearchResult> => {
  const query = (event as any).context?.query || (event as any).query || getQuery(event) || {}
  const q = String(query.q || '').trim()
  const forceMock = query.mock === 'true' || query.mock === '1' || query.mock === true

  if (!q) {
    return { results: [], isMock: true }
  }

  let clientId = ''
  let clientSecret = ''
  try {
    const config = useRuntimeConfig(event)
    clientId = config.spotifyClientId
    clientSecret = config.spotifyClientSecret
  } catch {
    // Fallback if useRuntimeConfig is not available in mock test harness
  }

  clientId = clientId || (event.context as any)?.cloudflare?.env?.SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID || ''
  clientSecret = clientSecret || (event.context as any)?.cloudflare?.env?.SPOTIFY_CLIENT_SECRET || process.env.SPOTIFY_CLIENT_SECRET || ''

  const isCredentialsMissing = !clientId || !clientSecret ||
    clientId === 'YOUR_CLIENT_ID' || clientId === 'dummy' ||
    clientSecret === 'YOUR_CLIENT_SECRET' || clientSecret === 'dummy'

  if (forceMock || isCredentialsMissing) {
    const results = searchMockAlbums(q)
    return { results, isMock: true }
  }

  try {
    const token = await getSpotifyAccessToken(clientId, clientSecret)
    const spotifyRes = await $fetch<any>('https://api.spotify.com/v1/search', {
      query: { q, type: 'album', limit: 10 },
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    const albums = spotifyRes?.albums?.items || []
    const results: SearchResultItem[] = albums.map((album: any) => ({
      id: album.id,
      name: album.name,
      artist: album.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
      releaseDate: formatReleaseDate(album.release_date),
      coverUrl: album.images?.[0]?.url || '',
      totalTracks: album.total_tracks || 0,
      spotifyUri: album.uri || `spotify:album:${album.id}`
    }))

    return { results, isMock: false }
  } catch (error) {
    console.warn('[Spotify Search API] Request failed, using mock fallback:', error)
    const results = searchMockAlbums(q)
    return { results, isMock: true }
  }
})
