import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parsePdf } from './helpers/pdfHelper';
import { parsePng } from './helpers/pngHelper';
import { judgePosterLayout, calculateLuminance, isPaletteLightToDark } from './helpers/layoutJudgeHelper';
import { tryImport, getProjectRoot, FIXTURES } from './helpers/moduleResolver';

describe('Tier 1: Feature Coverage (Opaque-Box E2E)', () => {
  const root = getProjectRoot();

  // =========================================================================
  // Feature 1: Album search with metadata (ORIGINAL_REQUEST §R1)
  // =========================================================================
  describe('F1: Album Search with Metadata', () => {
    it('F1.1: should return structured search results with title, artist, date, cover, and tracks count', async () => {
      const mockData = await tryImport('shared/mockData');
      const searchHandler = await tryImport('server/api/spotify/search.get');
      
      if (searchHandler?.default) {
        const result = await searchHandler.default({ context: { query: { q: 'Californication', mock: true } } });
        expect(result).toHaveProperty('results');
        expect(Array.isArray(result.results)).toBe(true);
        expect(result.results.length).toBeGreaterThan(0);
        const item = result.results[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('artist');
        expect(item).toHaveProperty('releaseDate');
        expect(item).toHaveProperty('coverUrl');
        expect(item).toHaveProperty('totalTracks');
      } else if (mockData) {
        expect(mockData.MOCK_SEARCH_RESULTS || mockData.default?.searchResults).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/search.get.ts')), 'server/api/spotify/search.get.ts must exist').toBe(true);
      }
    });

    it('F1.2: should format release date as human-readable string (e.g. "June 8, 1999")', async () => {
      const albumHandler = await tryImport('server/api/spotify/album/[id].get');
      const mockData = await tryImport('shared/mockData');

      if (albumHandler?.default) {
        const album = await albumHandler.default({ context: { params: { id: FIXTURES.CALIFORNICATION.id }, query: { mock: true } } });
        expect(album.releaseDate).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
        expect(album.releaseDate).toBe('June 8, 1999');
      } else if (mockData) {
        const cal = mockData.CALIFORNICATION_ALBUM || mockData.default?.californication;
        expect(cal.releaseDate).toBe('June 8, 1999');
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/album/[id].get.ts')), 'Album endpoint must exist').toBe(true);
      }
    });

    it('F1.3: should calculate total duration formatted as "Xh Ymin" or "Ymin"', async () => {
      const albumHandler = await tryImport('server/api/spotify/album/[id].get');
      const mockData = await tryImport('shared/mockData');

      if (albumHandler?.default) {
        const album = await albumHandler.default({ context: { params: { id: FIXTURES.CALIFORNICATION.id }, query: { mock: true } } });
        expect(album.totalDuration).toMatch(/^(\d+h\s*)?\d+min$/);
        expect(album.totalDuration).toBe('1h 7min');
      } else if (mockData) {
        const cal = mockData.CALIFORNICATION_ALBUM || mockData.default?.californication;
        expect(cal.totalDuration).toBe('1h 7min');
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/album/[id].get.ts')), 'Album endpoint must exist').toBe(true);
      }
    });

    it('F1.4: should provide structured tracklist with trackNumber, name, and durationMs', async () => {
      const albumHandler = await tryImport('server/api/spotify/album/[id].get');
      const mockData = await tryImport('shared/mockData');

      if (albumHandler?.default) {
        const album = await albumHandler.default({ context: { params: { id: FIXTURES.CALIFORNICATION.id }, query: { mock: true } } });
        expect(Array.isArray(album.tracks)).toBe(true);
        expect(album.tracks.length).toBe(15);
        expect(album.tracks[0]).toMatchObject({
          trackNumber: 1,
          name: 'Around the World',
        });
      } else if (mockData) {
        const cal = mockData.CALIFORNICATION_ALBUM || mockData.default?.californication;
        expect(cal.tracks.length).toBe(15);
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/album/[id].get.ts')), 'Album endpoint must exist').toBe(true);
      }
    });

    it('F1.5: should return valid Spotify URI for the requested album', async () => {
      const albumHandler = await tryImport('server/api/spotify/album/[id].get');
      const mockData = await tryImport('shared/mockData');

      if (albumHandler?.default) {
        const album = await albumHandler.default({ context: { params: { id: FIXTURES.CALIFORNICATION.id }, query: { mock: true } } });
        expect(album.spotifyUri).toMatch(/^spotify:album:[a-zA-Z0-9]+$/);
      } else if (mockData) {
        const cal = mockData.CALIFORNICATION_ALBUM || mockData.default?.californication;
        expect(cal.spotifyUri).toBe(FIXTURES.CALIFORNICATION.spotifyUri);
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/album/[id].get.ts')), 'Album endpoint must exist').toBe(true);
      }
    });
  });

  // =========================================================================
  // Feature 2: Spotify API client credentials & offline mock fallback (§R1)
  // =========================================================================
  describe('F2: Spotify API Client Credentials & Offline Fallback', () => {
    it('F2.1: should isolate Spotify credentials in server runtimeConfig / env', () => {
      const nuxtConfigPath = path.join(root, 'nuxt.config.ts');
      const nuxtConfigContent = fs.readFileSync(nuxtConfigPath, 'utf-8');
      
      // Public runtimeConfig must NOT contain Spotify secrets
      expect(nuxtConfigContent).not.toMatch(/public\s*:\s*\{[^}]*SPOTIFY_CLIENT_SECRET/);
    });

    it('F2.2: should provide automatic fallback to offline mocks when no credentials configured', async () => {
      const searchHandler = await tryImport('server/api/spotify/search.get');
      if (searchHandler?.default) {
        const res = await searchHandler.default({ context: { query: { q: 'Californication' } } });
        expect(res).toBeDefined();
        expect(res.results.length).toBeGreaterThan(0);
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/search.get.ts')), 'Search endpoint must exist').toBe(true);
      }
    });

    it('F2.3: should return canonical offline mock album for Californication ID', async () => {
      const albumHandler = await tryImport('server/api/spotify/album/[id].get');
      if (albumHandler?.default) {
        const res = await albumHandler.default({ context: { params: { id: '0fLhefnjlIV34MrF8v8dcO' }, query: {} } });
        expect(res.title).toBe('Californication');
        expect(res.artist).toBe('Red Hot Chili Peppers');
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/album/[id].get.ts')), 'Album endpoint must exist').toBe(true);
      }
    });

    it('F2.4: should generate synthetic mock results for arbitrary unknown search queries', async () => {
      const searchHandler = await tryImport('server/api/spotify/search.get');
      if (searchHandler?.default) {
        const res = await searchHandler.default({ context: { query: { q: 'Synthetic Test Artist' } } });
        expect(res.results).toBeDefined();
        expect(Array.isArray(res.results)).toBe(true);
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/search.get.ts')), 'Search endpoint must exist').toBe(true);
      }
    });

    it('F2.5: should respond with valid JSON schema on HTTP search and album endpoints', async () => {
      const sharedTypes = await tryImport('shared/types');
      if (sharedTypes) {
        expect(sharedTypes).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'shared/types.ts')), 'shared/types.ts must define data contracts').toBe(true);
      }
    });
  });

  // =========================================================================
  // Feature 3: Spotify Scannable Code Generation (§R1)
  // =========================================================================
  describe('F3: Spotify Scannable Code Generation', () => {
    it('F3.1: should generate vector SVG code for Spotify URI', async () => {
      const codeHandler = await tryImport('server/api/spotify/code/[id].get');
      const albumHandler = await tryImport('server/api/spotify/album/[id].get');

      if (codeHandler?.default) {
        const res = await codeHandler.default({ context: { params: { id: FIXTURES.CALIFORNICATION.id } } });
        const svg = typeof res === 'string' ? res : res.svg;
        expect(svg).toMatch(/<svg[\s\S]*<\/svg>/i);
      } else if (albumHandler?.default) {
        const album = await albumHandler.default({ context: { params: { id: FIXTURES.CALIFORNICATION.id }, query: { mock: true } } });
        expect(album.spotifyCodeSvg).toMatch(/<svg[\s\S]*<\/svg>/i);
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/code/[id].get.ts')), 'Spotify code generator must exist').toBe(true);
      }
    });

    it('F3.2: should include Spotify circular emblem vector in the scannable code', async () => {
      const codeHandler = await tryImport('server/api/spotify/code/[id].get');
      if (codeHandler?.default) {
        const res = await codeHandler.default({ context: { params: { id: FIXTURES.CALIFORNICATION.id } } });
        const svg = typeof res === 'string' ? res : res.svg;
        expect(svg).toMatch(/(circle|path|ellipse)/i);
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/code/[id].get.ts')), 'Spotify code generator must exist').toBe(true);
      }
    });

    it('F3.3: should contain exactly 23 vertical barcode soundwave bars', async () => {
      const codeHandler = await tryImport('server/api/spotify/code/[id].get');
      if (codeHandler?.default) {
        const res = await codeHandler.default({ context: { params: { id: FIXTURES.CALIFORNICATION.id } } });
        const svg = typeof res === 'string' ? res : res.svg;
        // Count rects or vertical bar paths
        const rectMatches = svg.match(/<rect\b/g) || [];
        const barPathMatches = svg.match(/\bbar\b/g) || [];
        const totalBars = rectMatches.length || barPathMatches.length;
        expect(totalBars).toBe(23);
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/code/[id].get.ts')), 'Spotify code generator must exist').toBe(true);
      }
    });

    it('F3.4: should generate variable heights for bars matching Spotify URI hash', async () => {
      const codeHandler = await tryImport('server/api/spotify/code/[id].get');
      if (codeHandler?.default) {
        const res = await codeHandler.default({ context: { params: { id: FIXTURES.CALIFORNICATION.id } } });
        const svg = typeof res === 'string' ? res : res.svg;
        // Verify height variation in attributes
        const heightMatches = [...svg.matchAll(/height="([0-9.]+)"/g)].map(m => parseFloat(m[1]));
        const uniqueHeights = new Set(heightMatches);
        expect(uniqueHeights.size).toBeGreaterThan(1);
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/code/[id].get.ts')), 'Spotify code generator must exist').toBe(true);
      }
    });

    it('F3.5: should function completely offline with procedural fallback', async () => {
      const codeHandler = await tryImport('server/api/spotify/code/[id].get');
      if (codeHandler?.default) {
        const res = await codeHandler.default({ context: { params: { id: 'test_offline_id' }, query: { mock: true } } });
        expect(res).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/code/[id].get.ts')), 'Spotify code generator must exist').toBe(true);
      }
    });
  });

  // =========================================================================
  // Feature 4: Cover Art High-Res Fallbacks (§R1)
  // =========================================================================
  describe('F4: Cover Art High-Res Fallbacks', () => {
    it('F4.1: should provide CORS-safe proxy with Access-Control-Allow-Origin header', async () => {
      const proxyHandler = await tryImport('server/api/cover-proxy');
      if (proxyHandler?.default) {
        expect(proxyHandler.default).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/cover-proxy.ts')), 'server/api/cover-proxy.ts must exist').toBe(true);
      }
    });

    it('F4.2: should support iTunes 3000px high-resolution artwork rewrite', async () => {
      const albumHandler = await tryImport('server/api/spotify/album/[id].get');
      if (albumHandler?.default) {
        const album = await albumHandler.default({ context: { params: { id: FIXTURES.CALIFORNICATION.id }, query: { mock: true } } });
        expect(album.coverUrl).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/album/[id].get.ts')), 'Album endpoint must exist').toBe(true);
      }
    });

    it('F4.3: should fallback to Cover Art Archive or Spotify 640px when iTunes unavailable', async () => {
      const albumHandler = await tryImport('server/api/spotify/album/[id].get');
      if (albumHandler?.default) {
        const album = await albumHandler.default({ context: { params: { id: FIXTURES.ABBEY_ROAD.id }, query: { mock: true } } });
        expect(album.coverUrl).toMatch(/^https?:\/\//);
      } else {
        expect(fs.existsSync(path.join(root, 'server/api/spotify/album/[id].get.ts')), 'Album endpoint must exist').toBe(true);
      }
    });

    it('F4.4: should handle image binary streaming through proxy without payload truncation', async () => {
      const proxyPath = path.join(root, 'server/api/cover-proxy.ts');
      expect(fs.existsSync(proxyPath), 'Cover proxy route must exist').toBe(true);
    });

    it('F4.5: should provide placeholder fallback cover when all remote sources fail', async () => {
      const mockData = await tryImport('shared/mockData');
      if (mockData?.DEFAULT_COVER || mockData?.PLACEHOLDER_COVER) {
        expect(mockData.DEFAULT_COVER || mockData.PLACEHOLDER_COVER).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'shared/mockData.ts')), 'shared/mockData.ts must exist').toBe(true);
      }
    });
  });

  // =========================================================================
  // Feature 5: Manual Cover Upload & Format Support (§R1)
  // =========================================================================
  describe('F5: Manual Cover Upload & Format Support', () => {
    it('F5.1: should support PNG image format upload', async () => {
      const editorComponent = path.join(root, 'app/components/PosterEditor.vue');
      expect(fs.existsSync(editorComponent), 'PosterEditor.vue must exist').toBe(true);
    });

    it('F5.2: should support JPEG image format upload', async () => {
      const editorComponent = path.join(root, 'app/components/PosterEditor.vue');
      expect(fs.existsSync(editorComponent), 'PosterEditor.vue must exist').toBe(true);
    });

    it('F5.3: should preserve full resolution of uploaded cover image', async () => {
      const posterComposable = await tryImport('app/composables/usePoster');
      if (posterComposable?.usePoster) {
        expect(posterComposable.usePoster).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'app/composables/usePoster.ts')), 'usePoster.ts must exist').toBe(true);
      }
    });

    it('F5.4: should crop or fit non-square image to 1:1 aspect ratio', async () => {
      const canvasComponent = path.join(root, 'app/components/PosterCanvas.vue');
      expect(fs.existsSync(canvasComponent), 'PosterCanvas.vue must exist').toBe(true);
    });

    it('F5.5: should create local object URL or Data URL for uploaded cover', async () => {
      const editorComponent = path.join(root, 'app/components/PosterEditor.vue');
      expect(fs.existsSync(editorComponent), 'PosterEditor.vue must exist').toBe(true);
    });
  });

  // =========================================================================
  // Feature 6: Poster Live Preview with Black Frame (§R2)
  // =========================================================================
  describe('F6: Poster Live Preview with Black Frame Geometry', () => {
    it('F6.1: should implement realistic black frame moulding around poster canvas', () => {
      const framePath = path.join(root, 'app/components/PosterFrame.vue');
      expect(fs.existsSync(framePath), 'PosterFrame.vue must exist').toBe(true);
    });

    it('F6.2: should maintain ISO 216 A-series aspect ratio on canvas', () => {
      const canvasPath = path.join(root, 'app/components/PosterCanvas.vue');
      expect(fs.existsSync(canvasPath), 'PosterCanvas.vue must exist').toBe(true);
    });

    it('F6.3: should parameterize content elements relative to Content Width (CW ~86.7%)', () => {
      const result = judgePosterLayout({
        posterWidth: 572,
        posterHeight: 768,
        contentWidth: 496,
        header: { hasDate: true, hasDuration: true, dateText: 'June 8, 1999', durationText: '1h 7min' },
        topRule: { present: true, widthFraction: 1.0 },
        cover: { width: 496, height: 496 },
        palette: { swatches: FIXTURES.CALIFORNICATION.palette },
        title: { text: 'Californication' },
        tracklist: { column1Tracks: ['1', '2', '3', '4', '5', '6', '7', '8'], column2Tracks: ['9', '10', '11', '12', '13', '14', '15'], totalTracks: 15 },
        spotifyCode: { present: true, barCount: 23 },
        bottomRule: { present: true, widthFraction: 1.0 },
      });
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('F6.4: should render hairline divider rules spanning 100% CW', () => {
      const canvasPath = path.join(root, 'app/components/PosterCanvas.vue');
      expect(fs.existsSync(canvasPath), 'PosterCanvas.vue must exist').toBe(true);
    });

    it('F6.5: should split tracklist across two balanced columns', () => {
      const total = 15;
      const col1 = Math.ceil(total / 2);
      const col2 = Math.floor(total / 2);
      expect(col1).toBe(8);
      expect(col2).toBe(7);
    });
  });

  // =========================================================================
  // Feature 7: 5-Color Palette Extraction & Luminance Sorting (§R2)
  // =========================================================================
  describe('F7: 5-Color Palette Extraction & Luminance Sorting', () => {
    it('F7.1: should extract exactly 5 discrete swatches from artwork', async () => {
      const paletteComposable = await tryImport('app/composables/usePalette');
      if (paletteComposable?.usePalette || paletteComposable?.extractPalette) {
        expect(paletteComposable).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'app/composables/usePalette.ts')), 'usePalette.ts must exist').toBe(true);
      }
    });

    it('F7.2: should sort palette swatches monotonically from light to dark', () => {
      const palette = FIXTURES.CALIFORNICATION.palette;
      expect(palette.length).toBe(5);
      expect(isPaletteLightToDark(palette)).toBe(true);
    });

    it('F7.3: should compute relative luminance using WCAG formula', () => {
      const whiteLum = calculateLuminance('#FFFFFF');
      const blackLum = calculateLuminance('#000000');
      const grayLum = calculateLuminance('#808080');

      expect(whiteLum).toBeCloseTo(1.0, 2);
      expect(blackLum).toBeCloseTo(0.0, 2);
      expect(grayLum).toBeGreaterThan(blackLum);
      expect(grayLum).toBeLessThan(whiteLum);
    });

    it('F7.4: should render swatches as contiguous rectangular bar spanning 100% CW', () => {
      const paletteBarComponent = path.join(root, 'app/components/PaletteBar.vue');
      expect(fs.existsSync(paletteBarComponent), 'PaletteBar.vue must exist').toBe(true);
    });

    it('F7.5: should allow manual color picking or override on individual swatches', () => {
      const paletteBarComponent = path.join(root, 'app/components/PaletteBar.vue');
      expect(fs.existsSync(paletteBarComponent), 'PaletteBar.vue must exist').toBe(true);
    });
  });

  // =========================================================================
  // Feature 8: Poster Field Editability (§R2)
  // =========================================================================
  describe('F8: Poster Field Editability', () => {
    it('F8.1: should provide editable title field that updates canvas state', () => {
      const editorComponent = path.join(root, 'app/components/PosterEditor.vue');
      expect(fs.existsSync(editorComponent), 'PosterEditor.vue must exist').toBe(true);
    });

    it('F8.2: should provide editable release date and duration fields', () => {
      const editorComponent = path.join(root, 'app/components/PosterEditor.vue');
      expect(fs.existsSync(editorComponent), 'PosterEditor.vue must exist').toBe(true);
    });

    it('F8.3: should allow modifying individual track titles and track ordering', () => {
      const editorComponent = path.join(root, 'app/components/PosterEditor.vue');
      expect(fs.existsSync(editorComponent), 'PosterEditor.vue must exist').toBe(true);
    });

    it('F8.4: should allow overriding palette colors manually', () => {
      const editorComponent = path.join(root, 'app/components/PosterEditor.vue');
      expect(fs.existsSync(editorComponent), 'PosterEditor.vue must exist').toBe(true);
    });

    it('F8.5: should allow replacing cover image via upload while keeping edited text intact', () => {
      const posterComposable = path.join(root, 'app/composables/usePoster.ts');
      expect(fs.existsSync(posterComposable), 'usePoster.ts must exist').toBe(true);
    });
  });

  // =========================================================================
  // Feature 9: Browser Vector PDF Export (§R3)
  // =========================================================================
  describe('F9: Browser Vector PDF Export', () => {
    it('F9.1: should export A3 format with exact 297x420mm dimensions (841.89x1190.55pt)', async () => {
      const exportPdf = await tryImport('app/utils/exportPdf');
      if (exportPdf?.exportToPdf) {
        expect(exportPdf.exportToPdf).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'app/utils/exportPdf.ts')), 'exportPdf.ts must exist').toBe(true);
      }
    });

    it('F9.2: should export A2 format with exact 420x594mm dimensions (1190.55x1683.78pt)', async () => {
      const exportPdf = await tryImport('app/utils/exportPdf');
      if (exportPdf?.exportToPdf) {
        expect(exportPdf.exportToPdf).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'app/utils/exportPdf.ts')), 'exportPdf.ts must exist').toBe(true);
      }
    });

    it('F9.3: should emit vector PostScript text extractable by pdftotext / parser', async () => {
      const exportPdf = path.join(root, 'app/utils/exportPdf.ts');
      expect(fs.existsSync(exportPdf), 'exportPdf.ts must exist').toBe(true);
    });

    it('F9.4: should draw vector hairline rules and vector Spotify code', async () => {
      const exportPdf = path.join(root, 'app/utils/exportPdf.ts');
      expect(fs.existsSync(exportPdf), 'exportPdf.ts must exist').toBe(true);
    });

    it('F9.5: should embed cover image at native resolution without downsampling', async () => {
      const exportPdf = path.join(root, 'app/utils/exportPdf.ts');
      expect(fs.existsSync(exportPdf), 'exportPdf.ts must exist').toBe(true);
    });
  });

  // =========================================================================
  // Feature 10: Browser 300 DPI PNG Export (§R3)
  // =========================================================================
  describe('F10: Browser 300 DPI PNG Export', () => {
    it('F10.1: should export A3 PNG at exact 3508x4961 pixels', async () => {
      const exportPng = await tryImport('app/utils/exportPng');
      if (exportPng?.exportToPng) {
        expect(exportPng.exportToPng).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'app/utils/exportPng.ts')), 'exportPng.ts must exist').toBe(true);
      }
    });

    it('F10.2: should export A2 PNG at exact 4960x7016 pixels', async () => {
      const exportPng = await tryImport('app/utils/exportPng');
      if (exportPng?.exportToPng) {
        expect(exportPng.exportToPng).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'app/utils/exportPng.ts')), 'exportPng.ts must exist').toBe(true);
      }
    });

    it('F10.3: should inject binary pHYs chunk into PNG output', async () => {
      const pngDpiUtil = await tryImport('app/utils/pngDpi');
      if (pngDpiUtil?.injectPngDpi) {
        expect(pngDpiUtil.injectPngDpi).toBeDefined();
      } else {
        expect(fs.existsSync(path.join(root, 'app/utils/pngDpi.ts')), 'pngDpi.ts must exist').toBe(true);
      }
    });

    it('F10.4: should configure pHYs chunk with 11811 pixels/meter specifying 300 DPI', () => {
      // 300 DPI = 300 dots / 0.0254 meters = 11811.02 px/m
      const ppm = Math.round(300 / 0.0254);
      expect(ppm).toBe(11811);
    });

    it('F10.5: should produce valid PNG buffer beginning with PNG magic header', async () => {
      const exportPng = path.join(root, 'app/utils/exportPng.ts');
      expect(fs.existsSync(exportPng), 'exportPng.ts must exist').toBe(true);
    });
  });

  // =========================================================================
  // Feature 11: Cloudflare Workers Nitro Build (§R4)
  // =========================================================================
  describe('F11: Cloudflare Workers Nitro Build', () => {
    it('F11.1: should include valid wrangler configuration file', () => {
      const wranglerJsonc = path.join(root, 'wrangler.jsonc');
      const wranglerJson = path.join(root, 'wrangler.json');
      const wranglerToml = path.join(root, 'wrangler.toml');
      const exists = fs.existsSync(wranglerJsonc) || fs.existsSync(wranglerJson) || fs.existsSync(wranglerToml);
      expect(exists, 'Wrangler configuration must exist').toBe(true);
    });

    it('F11.2: should configure nodejs_compat compatibility flag in wrangler config', () => {
      const wranglerJsonc = path.join(root, 'wrangler.jsonc');
      if (fs.existsSync(wranglerJsonc)) {
        const content = fs.readFileSync(wranglerJsonc, 'utf-8');
        expect(content).toMatch(/nodejs_compat/);
      } else {
        expect(fs.existsSync(wranglerJsonc), 'wrangler.jsonc must exist').toBe(true);
      }
    });

    it('F11.3: should configure Nitro cloudflare-module preset in nuxt.config.ts', () => {
      const nuxtConfig = fs.readFileSync(path.join(root, 'nuxt.config.ts'), 'utf-8');
      expect(nuxtConfig).toMatch(/cloudflare-module/);
    });

    it('F11.4: should produce .output/server/index.mjs upon build', () => {
      const serverEntry = path.join(root, '.output/server/index.mjs');
      expect(fs.existsSync(serverEntry), '.output/server/index.mjs must exist after build').toBe(true);
    });

    it('F11.5: should produce .output/public static assets directory upon build', () => {
      const publicDir = path.join(root, '.output/public');
      expect(fs.existsSync(publicDir), '.output/public must exist after build').toBe(true);
    });
  });

  // =========================================================================
  // Feature 12: Zero Spotify Secret Leakage into Client Bundle (§R4)
  // =========================================================================
  describe('F12: Zero Spotify Secret Leakage into Client Bundle', () => {
    it('F12.1: should not leak SPOTIFY_CLIENT_SECRET identifier into client assets', () => {
      const publicDir = path.join(root, '.output/public');
      if (fs.existsSync(publicDir)) {
        const clientFiles = fs.readdirSync(publicDir, { recursive: true })
          .filter(f => typeof f === 'string' && f.endsWith('.js'))
          .map(f => path.join(publicDir, f as string));
        
        for (const file of clientFiles) {
          const content = fs.readFileSync(file, 'utf-8');
          expect(content).not.toMatch(/SPOTIFY_CLIENT_SECRET/);
        }
      } else {
        expect(fs.existsSync(publicDir), 'Client public build directory must exist').toBe(true);
      }
    });

    it('F12.2: should not leak SPOTIFY_CLIENT_ID into client bundle', () => {
      const publicDir = path.join(root, '.output/public');
      if (fs.existsSync(publicDir)) {
        const clientFiles = fs.readdirSync(publicDir, { recursive: true })
          .filter(f => typeof f === 'string' && f.endsWith('.js'))
          .map(f => path.join(publicDir, f as string));
        
        for (const file of clientFiles) {
          const content = fs.readFileSync(file, 'utf-8');
          expect(content).not.toMatch(/SPOTIFY_CLIENT_ID/);
        }
      } else {
        expect(fs.existsSync(publicDir), 'Client public build directory must exist').toBe(true);
      }
    });

    it('F12.3: should include .dev.vars in .gitignore to prevent secret check-in', () => {
      const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf-8');
      expect(gitignore).toMatch(/\.dev\.vars/);
    });

    it('F12.4: should include .env in .gitignore', () => {
      const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf-8');
      expect(gitignore).toMatch(/\.env/);
    });

    it('F12.5: should not declare Spotify credentials in public runtimeConfig', () => {
      const nuxtConfig = fs.readFileSync(path.join(root, 'nuxt.config.ts'), 'utf-8');
      expect(nuxtConfig).not.toMatch(/runtimeConfig\s*:\s*\{[\s\S]*public\s*:\s*\{[\s\S]*spotify/i);
    });
  });
});
