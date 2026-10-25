/**
 * Re-export PNG DPI utilities for E2E tests and components
 */
export * from './png'
export { injectPngDpi, crc32 } from './png'
export default { injectPngDpi: (await import('./png')).injectPngDpi }
