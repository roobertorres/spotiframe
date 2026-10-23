import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

export interface PdfMetadata {
  version: string;
  pageCount: number;
  mediaBox: { x1: number; y1: number; width: number; height: number };
  extractedText: string[];
  fullText: string;
  hasVectorText: boolean;
  hasEmbeddedImage: boolean;
  hasVectorLines: boolean;
}

/**
 * Extracts text content and structural metadata from a PDF buffer.
 * Performs deep inspection of PostScript PDF streams, FlateDecode decompression,
 * and text extraction operators (Tj, TJ, ', ") equivalent to pdftotext.
 */
export function parsePdf(buffer: Buffer | Uint8Array | ArrayBuffer): PdfMetadata {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer);
  const rawStr = buf.toString('latin1');

  // Extract PDF version
  const versionMatch = rawStr.match(/%PDF-([0-9.]+)/);
  const version = versionMatch ? versionMatch[1] : 'unknown';

  // Extract MediaBox dimensions: [x1, y1, width, height]
  let mediaBox = { x1: 0, y1: 0, width: 0, height: 0 };
  const mediaBoxMatch = rawStr.match(/\/MediaBox\s*\[\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s*\]/);
  if (mediaBoxMatch) {
    mediaBox = {
      x1: parseFloat(mediaBoxMatch[1]),
      y1: parseFloat(mediaBoxMatch[2]),
      width: parseFloat(mediaBoxMatch[3]),
      height: parseFloat(mediaBoxMatch[4]),
    };
  }

  // Count pages
  const pageMatches = rawStr.match(/\/Type\s*\/Page\b(?!\s*s)/g);
  const pageCount = pageMatches ? pageMatches.length : 1;

  // Check for embedded images
  const hasEmbeddedImage = /\/Subtype\s*\/Image\b/.test(rawStr) || /\/Type\s*\/XObject\b/.test(rawStr);

  // Check for vector lines / paths (stroke / fill operators: re, m, l, S, f)
  const hasVectorLines = /\b(re|m|l)\b/.test(rawStr) && /\b(S|f|B)\b/.test(rawStr);

  // Extract and decompress all streams
  const textTokens: string[] = [];
  const streamRegex = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(rawStr)) !== null) {
    const dict = match[1];
    const streamStart = match.index + match[0].indexOf('stream') + (match[0].includes('stream\r\n') ? 8 : 7);
    const streamEnd = match.index + match[0].lastIndexOf('endstream') - (rawStr[match.index + match[0].lastIndexOf('endstream') - 2] === '\r' ? 2 : 1);
    const streamBytes = buf.subarray(streamStart, streamEnd);

    let streamContent = '';
    const isFlate = /\/Filter\s*\/FlateDecode\b/.test(dict);

    if (isFlate) {
      try {
        const decompressed = zlib.inflateSync(streamBytes);
        streamContent = decompressed.toString('latin1');
      } catch {
        // Stream may not be zlib or partial
        streamContent = '';
      }
    } else {
      streamContent = streamBytes.toString('latin1');
    }

    if (streamContent) {
      // Parse BT (Begin Text) ... ET (End Text) blocks
      const btRegex = /BT([\s\S]*?)ET/g;
      let btMatch: RegExpExecArray | null;
      while ((btMatch = btRegex.exec(streamContent)) !== null) {
        const textBlock = btMatch[1];

        // Match (string) Tj or ' or "
        const tjRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
        let tjMatch: RegExpExecArray | null;
        while ((tjMatch = tjRegex.exec(textBlock)) !== null) {
          const unescaped = decodePdfString(tjMatch[1]);
          if (unescaped.trim()) {
            textTokens.push(unescaped.trim());
          }
        }

        // Match [ (item1) -120 (item2) ] TJ
        const arrayTjRegex = /\[([\s\S]*?)\]\s*TJ/g;
        let arrayMatch: RegExpExecArray | null;
        while ((arrayMatch = arrayTjRegex.exec(textBlock)) !== null) {
          const arrayBody = arrayMatch[1];
          const innerStrRegex = /\(([\s\S]*?)\)/g;
          let innerMatch: RegExpExecArray | null;
          let combined = '';
          while ((innerMatch = innerStrRegex.exec(arrayBody)) !== null) {
            combined += decodePdfString(innerMatch[1]);
          }
          if (combined.trim()) {
            textTokens.push(combined.trim());
          }
        }
      }
    }
  }

  // Fallback: also check if uncompressed text appears directly in the raw string
  if (textTokens.length === 0) {
    const rawTj = /\(([\s\S]*?)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = rawTj.exec(rawStr)) !== null) {
      const decoded = decodePdfString(m[1]).trim();
      if (decoded) textTokens.push(decoded);
    }
  }

  const fullText = textTokens.join(' ');
  const hasVectorText = textTokens.length > 0;

  return {
    version,
    pageCount,
    mediaBox,
    extractedText: textTokens,
    fullText,
    hasVectorText,
    hasEmbeddedImage,
    hasVectorLines,
  };
}

/**
 * Executes system pdftotext CLI if installed, falling back to pure Node parser.
 */
export function extractPdfTextWithCliFallback(pdfBuffer: Buffer): string {
  try {
    const tmpFile = `/tmp/test_pdf_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;
    fs.writeFileSync(tmpFile, pdfBuffer);
    try {
      const output = execSync(`pdftotext "${tmpFile}" -`, { timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] });
      return output.toString('utf-8');
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  } catch {
    // CLI not installed or failed, use pure Node extractor
    return parsePdf(pdfBuffer).fullText;
  }
}

/**
 * Decodes PDF string escape sequences (e.g. \(, \), \\, \ddd octal escapes).
 */
function decodePdfString(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}
