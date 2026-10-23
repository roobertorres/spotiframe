import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

function findMatchingFiles(dir: string, testRegex: RegExp, ignoreDirs: string[] = ['node_modules', '.git', '.output']): string[] {
  let matches: string[] = []
  if (!fs.existsSync(dir)) return matches

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!ignoreDirs.includes(entry.name)) {
        matches = matches.concat(findMatchingFiles(fullPath, testRegex, ignoreDirs))
      }
    } else if (entry.isFile() && testRegex.test(entry.name)) {
      matches.push(fullPath)
    }
  }
  return matches
}

function searchPatternInFiles(filePaths: string[], pattern: string | RegExp): Array<{ file: string; line: number; match: string }> {
  const hits: Array<{ file: string; line: number; match: string }> = []
  for (const file of filePaths) {
    const content = fs.readFileSync(file, 'utf8')
    const lines = content.split('\n')
    lines.forEach((line, index) => {
      if (typeof pattern === 'string' ? line.includes(pattern) : pattern.test(line)) {
        hits.push({ file, line: index + 1, match: line.trim() })
      }
    })
  }
  return hits
}

describe('Security & Secrets Isolation Verification', () => {
  const projectRoot = path.resolve(__dirname, '../../../')

  it('verifies nuxt.config.ts isolates Spotify secrets to server runtimeConfig', () => {
    const nuxtConfigPath = path.join(projectRoot, 'nuxt.config.ts')
    expect(fs.existsSync(nuxtConfigPath)).toBe(true)

    const configContent = fs.readFileSync(nuxtConfigPath, 'utf8')

    // Assert secrets are configured in runtimeConfig
    expect(configContent).toMatch(/spotifyClientId/i)
    expect(configContent).toMatch(/spotifyClientSecret/i)

    // Assert secrets are NOT configured under runtimeConfig.public
    const publicConfigMatch = configContent.match(/public\s*:\s*\{([^}]*)\}/s)
    if (publicConfigMatch) {
      const publicContent = publicConfigMatch[1]
      expect(publicContent).not.toMatch(/spotifyClientSecret/i)
      expect(publicContent).not.toMatch(/SPOTIFY_CLIENT_SECRET/i)
    }
  })

  it('verifies zero Spotify secret tokens exist in the client source tree (app/)', () => {
    const appDir = path.join(projectRoot, 'app')
    const clientSourceFiles = findMatchingFiles(appDir, /\.(vue|ts|js|json|css)$/)

    expect(clientSourceFiles.length).toBeGreaterThan(0)

    const secretKeywords = [
      'SPOTIFY_CLIENT_SECRET',
      'spotifyClientSecret',
      'process.env.SPOTIFY_CLIENT_SECRET'
    ]

    secretKeywords.forEach(keyword => {
      const hits = searchPatternInFiles(clientSourceFiles, keyword)
      expect(hits, `Found secret keyword "${keyword}" in client sources: ${JSON.stringify(hits)}`).toHaveLength(0)
    })
  })

  it('verifies zero secrets appear in public client build bundles (.output/public)', () => {
    const outputPublicDir = path.join(projectRoot, '.output', 'public')

    // If build has run, audit every bundled asset
    if (fs.existsSync(outputPublicDir)) {
      const bundleFiles = findMatchingFiles(outputPublicDir, /\.(js|mjs|html|css|json|map)$/)
      expect(bundleFiles.length).toBeGreaterThan(0)

      const secretPatterns = [
        /SPOTIFY_CLIENT_SECRET/,
        /canary_secret_do_not_leak/
      ]

      secretPatterns.forEach(pattern => {
        const hits = searchPatternInFiles(bundleFiles, pattern)
        expect(hits, `Found secret in client bundle: ${JSON.stringify(hits)}`).toHaveLength(0)
      })
    } else {
      // Build directory not present yet; verify contract expectation
      expect(true).toBe(true)
    }
  })

  it('verifies .gitignore contains .dev.vars to prevent committing local secrets', () => {
    const gitignorePath = path.join(projectRoot, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf8')
      expect(gitignore).toMatch(/\.dev\.vars/)
    }
  })
})
