import sharp from 'sharp';

sharp.cache(false);

export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB
export const DEFAULT_MIN_DIMENSION = 256;
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
export const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

export type ImageValidationErrorCode =
  | 'UNSUPPORTED_TYPE'
  | 'MAGIC_BYTES_MISMATCH'
  | 'DIMENSIONS_OUT_OF_RANGE';

export class ImageValidationError extends Error {
  constructor(
    public readonly code: ImageValidationErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message);
    this.name = 'ImageValidationError';
    if (cause instanceof Error) {
      this.stack = cause.stack;
    }
  }
}

export function isSupportedImageType(name?: string | null, mimeType?: string | null): boolean {
  if (mimeType && ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return true;
  }

  const normalized = name?.toLowerCase() ?? '';
  return [...ALLOWED_EXTENSIONS].some((ext) => normalized.endsWith(ext));
}

export async function detectMimeType(buffer: Buffer, fallback?: string | null): Promise<string> {
  const signature = buffer.subarray(0, 12);

  if (
    signature.length >= 3 &&
    signature[0] === 0xff &&
    signature[1] === 0xd8 &&
    signature[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    signature.length >= 8 &&
    signature[0] === 0x89 &&
    signature[1] === 0x50 &&
    signature[2] === 0x4e &&
    signature[3] === 0x47
  ) {
    return 'image/png';
  }

  if (
    signature.length >= 12 &&
    signature.toString('ascii', 0, 4) === 'RIFF' &&
    signature.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (signature.length >= 12 && signature.toString('ascii', 4, 8) === 'ftyp') {
    return 'image/heic';
  }

  if (fallback && ALLOWED_MIME_TYPES.has(fallback.toLowerCase())) {
    return fallback.toLowerCase();
  }

  throw new ImageValidationError('MAGIC_BYTES_MISMATCH', 'Attachment is not a supported image.');
}

export interface ImageMetadata {
  width: number;
  height: number;
}

export async function extractImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  try {
    const metadata = await sharp(buffer).metadata();

    if (!metadata.width || !metadata.height) {
      throw new ImageValidationError(
        'DIMENSIONS_OUT_OF_RANGE',
        'Image dimensions could not be determined.'
      );
    }

    return {
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    if (error instanceof ImageValidationError) {
      throw error;
    }

    throw new ImageValidationError('MAGIC_BYTES_MISMATCH', 'Image could not be parsed.', error);
  }
}

export function ensureDimensions(
  width: number,
  height: number,
  minWidth = DEFAULT_MIN_DIMENSION,
  minHeight = DEFAULT_MIN_DIMENSION
): void {
  if (width < minWidth || height < minHeight) {
    throw new ImageValidationError(
      'DIMENSIONS_OUT_OF_RANGE',
      `Image must be at least ${minWidth}x${minHeight}px.`
    );
  }
}
