import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createApp, toWebHandler } from 'h3'
import coverProxyHandler from '../../../server/api/cover-proxy'

describe('Milestone 1 Challenger 2: Proxy Input Validation & Packaging Verification', () => {
  const root = path.resolve(__dirname, '../../../')
  let app: any
  let webHandler: (req: Request) => Promise<Response>
  let originalFetch: typeof globalThis.fetch
  let fetchCalls: Array<{ url: string; options: any }> = []

  beforeEach(() => {
    app = createApp()
    app.use('/api/cover-proxy', coverProxyHandler)
    webHandler = toWebHandler(app)

    fetchCalls = []
    originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: any, options: any) => {
      fetchCalls.push({ url: String(url), options })
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '4'
        }
      })
    }) as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // =========================================================================
  // 1. Proxy Input Validation & Scheme Enforcement
  // =========================================================================
  describe('1. Proxy Input Validation & Scheme Enforcement', () => {
    it('rejects missing or empty url parameter with 400 Bad Request', async () => {
      const resMissing = await webHandler(new Request('http://localhost/api/cover-proxy'))
      expect(resMissing.status).toBe(400)
      const dataMissing = await resMissing.json()
      expect(dataMissing.statusMessage).toContain('Missing required "url"')

      const resEmpty = await webHandler(new Request('http://localhost/api/cover-proxy?url='))
      expect(resEmpty.status).toBe(400)
    })

    it('rejects malformed URL strings with 400 Bad Request', async () => {
      const malformedUrls = [
        'not-a-valid-url',
        'http://',
        '://missing-protocol',
        'http://[::zz]',
        'http://%99'
      ]

      for (const badUrl of malformedUrls) {
        const res = await webHandler(new Request(`http://localhost/api/cover-proxy?url=${encodeURIComponent(badUrl)}`))
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.statusMessage).toContain('Invalid URL supplied')
      }
    })

    it('rejects non-HTTP/HTTPS schemes (ftp, file, javascript, data, gopher) with 400 Bad Request', async () => {
      const invalidSchemes = [
        'ftp://mirror.example.com/cover.jpg',
        'file:///etc/passwd',
        'javascript:alert(document.cookie)',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'gopher://gopher.floodgap.com/0/test.jpg'
      ]

      for (const url of invalidSchemes) {
        const res = await webHandler(new Request(`http://localhost/api/cover-proxy?url=${encodeURIComponent(url)}`))
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.statusMessage).toContain('Invalid protocol')
      }
      expect(fetchCalls.length).toBe(0)
    })

    it('allows valid HTTP and HTTPS target URLs to reach fetch', async () => {
      const validUrls = [
        'https://i.scdn.co/image/ab67616d0000b2730fLhefnjlIV34MrF8v8dcO',
        'http://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f/634904078164.png/3000x3000bb.jpg'
      ]

      for (const url of validUrls) {
        fetchCalls = []
        const res = await webHandler(new Request(`http://localhost/api/cover-proxy?url=${encodeURIComponent(url)}`))
        expect(res.status).toBe(200)
        expect(fetchCalls.length).toBe(1)
        expect(fetchCalls[0].url).toBe(url)
      }
    })
  })

  // =========================================================================
  // 2. SSRF Protection & Private Network Rejection
  // =========================================================================
  describe('2. SSRF Protection & Private Network Rejection', () => {
    it('blocks known IPv4 localhost and private RFC 1918 subnets with 403 Forbidden', async () => {
      const blockedHosts = [
        'http://localhost/secret.jpg',
        'http://localhost:8080/image.png',
        'http://127.0.0.1/admin.jpg',
        'http://127.0.0.1:3000/api',
        'http://0.0.0.0/test.png',
        'http://10.0.0.1/vault.png',
        'http://10.254.0.1/private.jpg',
        'http://192.168.1.1/router.png',
        'http://192.168.0.254/status.jpg',
        'http://172.16.0.1/internal.jpg',
        'http://172.31.255.255/internal.jpg',
        'http://gateway.local/cam.jpg',
        'http://service.internal/secret.jpg'
      ]

      for (const url of blockedHosts) {
        fetchCalls = []
        const res = await webHandler(new Request(`http://localhost/api/cover-proxy?url=${encodeURIComponent(url)}`))
        expect(res.status).toBe(403)
        const data = await res.json()
        expect(data.statusMessage).toContain('Access to private and local network addresses is forbidden')
        expect(fetchCalls.length).toBe(0)
      }
    })

    it('blocks all 127.0.0.0/8 loopback addresses with 403 Forbidden', async () => {
      const loopbacks = [
        'http://127.0.0.2/internal-service.png',
        'http://127.1.2.3:8080/secret.jpg',
        'http://127.127.127.127/admin'
      ]

      for (const url of loopbacks) {
        fetchCalls = []
        const res = await webHandler(new Request(`http://localhost/api/cover-proxy?url=${encodeURIComponent(url)}`))
        expect(res.status).toBe(403)
        const data = await res.json()
        expect(data.statusMessage).toContain('Access to private and local network addresses is forbidden')
        expect(fetchCalls.length).toBe(0)
      }
    })

    it('blocks cloud instance metadata endpoint (169.254.169.254 and 169.254.0.0/16) with 403 Forbidden', async () => {
      const metadataUrls = [
        'http://169.254.169.254/latest/meta-data/',
        'http://169.254.1.1/secret.jpg'
      ]

      for (const url of metadataUrls) {
        fetchCalls = []
        const res = await webHandler(new Request(`http://localhost/api/cover-proxy?url=${encodeURIComponent(url)}`))
        expect(res.status).toBe(403)
        const data = await res.json()
        expect(data.statusMessage).toContain('Access to private and local network addresses is forbidden')
        expect(fetchCalls.length).toBe(0)
      }
    })

    it('blocks IPv6 loopback ([::1]) and unspecified ([::]) with 403 Forbidden', async () => {
      const ipv6Urls = [
        'http://[::1]/secret.jpg',
        'http://[::]/admin.png'
      ]

      for (const url of ipv6Urls) {
        fetchCalls = []
        const res = await webHandler(new Request(`http://localhost/api/cover-proxy?url=${encodeURIComponent(url)}`))
        expect(res.status).toBe(403)
        const data = await res.json()
        expect(data.statusMessage).toContain('Access to private and local network addresses is forbidden')
        expect(fetchCalls.length).toBe(0)
      }
    })

    it('blocks single-label internal hosts with 403 Forbidden', async () => {
      const singleLabelUrls = [
        'http://vault/secret.png',
        'http://metadata/credentials',
        'http://intranet/status.jpg'
      ]

      for (const url of singleLabelUrls) {
        fetchCalls = []
        const res = await webHandler(new Request(`http://localhost/api/cover-proxy?url=${encodeURIComponent(url)}`))
        expect(res.status).toBe(403)
        const data = await res.json()
        expect(data.statusMessage).toContain('Access to private and local network addresses is forbidden')
        expect(fetchCalls.length).toBe(0)
      }
    })
  })

  // =========================================================================
  // 3. CORS Headers & HTTP Methods (GET, HEAD, OPTIONS)
  // =========================================================================
  describe('3. CORS Headers & HTTP Methods', () => {
    it('returns 204 with required CORS headers on OPTIONS preflight', async () => {
      const res = await webHandler(new Request('http://localhost/api/cover-proxy', {
        method: 'OPTIONS'
      }))

      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
      expect(res.headers.get('access-control-allow-methods')).toBe('GET, HEAD, OPTIONS')
      expect(res.headers.get('access-control-allow-headers')).toBe('*')
      expect(res.headers.get('access-control-max-age')).toBe('86400')
    })

    it('returns 200 with Access-Control-Allow-Origin: * and Cache-Control on GET', async () => {
      const targetUrl = 'https://i.scdn.co/image/test.jpg'
      const res = await webHandler(new Request(`http://localhost/api/cover-proxy?url=${encodeURIComponent(targetUrl)}`, {
        method: 'GET'
      }))

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
      expect(res.headers.get('access-control-allow-methods')).toBe('GET, HEAD, OPTIONS')
      expect(res.headers.get('content-type')).toBe('image/jpeg')
      expect(res.headers.get('cache-control')).toContain('public')
      expect(res.headers.get('cache-control')).toContain('max-age=604800')
    })

    it('returns 200 with Access-Control-Allow-Origin: * and empty body on HEAD', async () => {
      const targetUrl = 'https://i.scdn.co/image/test.jpg'
      const res = await webHandler(new Request(`http://localhost/api/cover-proxy?url=${encodeURIComponent(targetUrl)}`, {
        method: 'HEAD'
      }))

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
      expect(res.headers.get('content-type')).toBe('image/jpeg')
      expect(res.headers.get('content-length')).toBe('4')

      const body = await res.text()
      expect(body).toBe('')
      expect(fetchCalls[0].options.method).toBe('HEAD')
    })
  })

  // =========================================================================
  // 4. Content-Type Filtering & Validation
  // =========================================================================
  describe('4. Content-Type Filtering & Validation', () => {
    it('accepts legitimate image MIME types', async () => {
      const validMimes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'image/gif',
        'image/svg+xml'
      ]

      for (const mime of validMimes) {
        globalThis.fetch = (async () => new Response('data', {
          status: 200,
          headers: { 'content-type': mime }
        })) as any

        const res = await webHandler(new Request('http://localhost/api/cover-proxy?url=https://example.com/test'))
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toBe(mime)
      }
    })

    it('rejects non-image MIME types (HTML, JSON, text, PDF, binaries) with 415', async () => {
      const invalidMimes = [
        'text/html',
        'text/html; charset=utf-8',
        'application/json',
        'text/plain',
        'application/pdf',
        'application/octet-stream',
        'application/javascript'
      ]

      for (const mime of invalidMimes) {
        globalThis.fetch = (async () => new Response('payload', {
          status: 200,
          headers: { 'content-type': mime }
        })) as any

        const res = await webHandler(new Request('http://localhost/api/cover-proxy?url=https://example.com/test'))
        expect(res.status).toBe(415)
        const data = await res.json()
        expect(data.statusMessage).toContain('Upstream resource is not an image')
      }
    })

    it('rejects arbitrary XML payloads (text/xml, application/xml, application/xhtml+xml) with 415', async () => {
      const xmlMimes = [
        'application/xml',
        'text/xml',
        'application/xhtml+xml'
      ]

      for (const mime of xmlMimes) {
        globalThis.fetch = (async () => new Response('<rss><item>data</item></rss>', {
          status: 200,
          headers: { 'content-type': mime }
        })) as any

        const res = await webHandler(new Request('http://localhost/api/cover-proxy?url=https://example.com/feed.xml'))
        expect(res.status).toBe(415)
        const data = await res.json()
        expect(data.statusMessage).toContain('Upstream resource is not an image')
      }
    })
  })

  // =========================================================================
  // 5. Cloudflare Worker Bundle & Packaging Verification
  // =========================================================================
  describe('5. Cloudflare Worker Bundle & Packaging Verification', () => {
    it('verifies .output/server/index.mjs is a valid ES module with default export', async () => {
      const serverEntryPath = path.join(root, '.output/server/index.mjs')
      expect(fs.existsSync(serverEntryPath), '.output/server/index.mjs must exist').toBe(true)

      const content = fs.readFileSync(serverEntryPath, 'utf-8')
      expect(content).toContain('export{')
      expect(content).toContain('as default}')

      // Verify ES module syntax via node --check
      expect(() => {
        execSync(`node --check "${serverEntryPath}"`, { stdio: 'pipe' })
      }).not.toThrow()
    })

    it('verifies wrangler.jsonc contains valid Cloudflare Workers configuration', () => {
      const wranglerPath = path.join(root, 'wrangler.jsonc')
      expect(fs.existsSync(wranglerPath), 'wrangler.jsonc must exist').toBe(true)

      const raw = fs.readFileSync(wranglerPath, 'utf-8')
      const config = JSON.parse(raw)

      expect(config.name).toBe('spotiframe')
      expect(config.main).toBe('.output/server/index.mjs')
      expect(config.compatibility_date).toBeDefined()
      expect(config.compatibility_flags).toContain('nodejs_compat')
      expect(config.assets).toBeDefined()
      expect(config.assets.directory).toBe('.output/public')
      expect(config.assets.binding).toBe('ASSETS')
    })

    it('verifies npx wrangler deploy --dry-run completes successfully with exit code 0', () => {
      const nodeBin = '/home/robertorres/.nvm/versions/node/v24.21.0/bin'
      const output = execSync('npx wrangler deploy --dry-run', {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${nodeBin}:${process.env.PATH}`
        },
        encoding: 'utf-8'
      })

      expect(output).toContain('Total Upload:')
      expect(output).toContain('--dry-run: exiting now.')
      expect(output).toContain('env.ASSETS')
    }, 15000)

    it('verifies .output/public contains zero sensitive tokens or client credentials', () => {
      const publicDir = path.join(root, '.output/public')
      expect(fs.existsSync(publicDir), '.output/public must exist').toBe(true)

      // Search recursively for sensitive tokens
      const grepPatterns = [
        'SPOTIFY_CLIENT_SECRET',
        'SPOTIFY_CLIENT_ID',
        'client_secret'
      ]

      for (const pattern of grepPatterns) {
        let matches = ''
        try {
          matches = execSync(`grep -rn "${pattern}" "${publicDir}" || true`, {
            encoding: 'utf-8'
          }).trim()
        } catch {
          matches = ''
        }
        expect(matches).toBe('')
      }
    })
  })
})
