/**
 * Image Cover Proxy
 *
 * Streams remote album cover artwork and vector Spotify scannables with
 * Access-Control-Allow-Origin: * to prevent HTML5 canvas CORS taint during
 * color palette extraction and high-DPI export.
 */
import { defineEventHandler, getQuery, getMethod, setResponseHeaders, setResponseStatus, sendStream, createError } from 'h3'

function isPrivateHost(hostname: string): boolean {
  let host = hostname.toLowerCase().replace(/\.+$/, '')
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1)
  }

  // IPv6 loopback, unspecified, and local/private addresses
  if (['localhost', '127.0.0.1', '::1', '::', '0.0.0.0'].includes(host)) return true
  if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('::ffff:')) return true

  // Single-label hostnames (e.g. "localhost", "vault", "intranet", "metadata")
  if (!host.includes('.') && !host.includes(':')) return true

  // IPv4 Loopback (127.0.0.0/8)
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true

  // IPv4 Link-Local / Cloud Instance Metadata (169.254.0.0/16)
  if (/^169\.254\.\d+\.\d+$/.test(host)) return true

  // IPv4 Private Networks (RFC 1918)
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true

  // IPv4 Current Network (0.0.0.0/8)
  if (/^0\.\d+\.\d+\.\d+$/.test(host)) return true

  // Carrier-Grade NAT (RFC 6598: 100.64.0.0/10)
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(host)) return true

  // Local/internal domain suffixes
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host.endsWith('.corp') || host.endsWith('.home')) return true

  return false
}

export default defineEventHandler(async (event) => {
  let method = 'GET'
  try {
    method = getMethod(event)
  } catch {
    method = (event as any).method || (event as any).node?.req?.method || 'GET'
  }

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400'
    })
    setResponseStatus(event, 204)
    return ''
  }

  const query = (event as any).context?.query || (event as any).query || getQuery(event) || {}
  const targetUrl = query.url

  if (!targetUrl || typeof targetUrl !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required "url" query parameter'
    })
  }

  let parsed: URL
  try {
    parsed = new URL(targetUrl)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid URL supplied'
    })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid protocol: only HTTP and HTTPS are permitted'
    })
  }

  if (isPrivateHost(parsed.hostname)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access to private and local network addresses is forbidden'
    })
  }

  try {
    const upstreamRes = await fetch(parsed.toString(), {
      method: method === 'HEAD' ? 'HEAD' : 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Spotiframe/1.0)',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!upstreamRes.ok) {
      throw createError({
        statusCode: upstreamRes.status >= 400 && upstreamRes.status < 500 ? upstreamRes.status : 502,
        statusMessage: `Upstream error: ${upstreamRes.statusText}`
      })
    }

    const contentType = upstreamRes.headers.get('content-type') || ''
    const mimeType = contentType.toLowerCase().split(';')[0].trim()
    if (!mimeType.startsWith('image/') || mimeType === 'image/') {
      throw createError({
        statusCode: 415,
        statusMessage: 'Upstream resource is not an image'
      })
    }

    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400'
    }

    const contentLength = upstreamRes.headers.get('content-length')
    if (contentLength) {
      headers['Content-Length'] = contentLength
    }

    setResponseHeaders(event, headers)

    if (method === 'HEAD') {
      setResponseStatus(event, 200)
      return ''
    }

    // Stream response body directly in Cloudflare Workers / Nitro
    if (upstreamRes.body) {
      return sendStream(event, upstreamRes.body)
    }

    return upstreamRes.arrayBuffer()
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to fetch image: ${err.message}`
    })
  }
})
