export interface PngPhysChunk {
  pixelsPerUnitX: number;
  pixelsPerUnitY: number;
  unitSpecifier: number; // 1 = meters, 0 = unknown
  dpiX: number;
  dpiY: number;
  is300Dpi: boolean;
}

export interface PngMetadata {
  validSignature: boolean;
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  chunks: string[];
  pHYs?: PngPhysChunk;
}

/**
 * Parses and verifies binary PNG headers, chunks, dimensions, and the pHYs resolution chunk.
 * 300 DPI corresponds to 11811 pixels/meter (300 / 0.0254 = 11811.02).
 */
export function parsePng(buffer: Buffer | Uint8Array | ArrayBuffer): PngMetadata {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer);

  // Validate PNG signature: [137, 80, 78, 71, 13, 10, 26, 10]
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  let validSignature = buf.length >= 8;
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== pngSig[i]) {
      validSignature = false;
      break;
    }
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const chunks: string[] = [];
  let pHYs: PngPhysChunk | undefined;

  let offset = 8;
  while (offset + 8 <= buf.length) {
    const chunkLength = buf.readUInt32BE(offset);
    const chunkType = buf.subarray(offset + 4, offset + 8).toString('ascii');
    chunks.push(chunkType);

    const dataOffset = offset + 8;
    if (chunkType === 'IHDR' && chunkLength >= 13) {
      width = buf.readUInt32BE(dataOffset);
      height = buf.readUInt32BE(dataOffset + 4);
      bitDepth = buf.readUInt8(dataOffset + 8);
      colorType = buf.readUInt8(dataOffset + 9);
    } else if (chunkType === 'pHYs' && chunkLength >= 9) {
      const ppuX = buf.readUInt32BE(dataOffset);
      const ppuY = buf.readUInt32BE(dataOffset + 4);
      const unit = buf.readUInt8(dataOffset + 8);
      const dpiX = unit === 1 ? Math.round(ppuX * 0.0254) : 0;
      const dpiY = unit === 1 ? Math.round(ppuY * 0.0254) : 0;

      pHYs = {
        pixelsPerUnitX: ppuX,
        pixelsPerUnitY: ppuY,
        unitSpecifier: unit,
        dpiX,
        dpiY,
        is300Dpi: unit === 1 && Math.abs(dpiX - 300) <= 1 && Math.abs(dpiY - 300) <= 1,
      };
    }

    offset += 12 + chunkLength; // 4 (length) + 4 (type) + length (data) + 4 (CRC)
    if (chunkType === 'IEND') break;
  }

  return {
    validSignature,
    width,
    height,
    bitDepth,
    colorType,
    chunks,
    pHYs,
  };
}
