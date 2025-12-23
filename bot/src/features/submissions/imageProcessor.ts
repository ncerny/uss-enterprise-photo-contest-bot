import sharp, { Sharp } from 'sharp';

sharp.cache(false);

const DEFAULT_DISPLAY_MAX = 1920;
const DEFAULT_THUMB_SIZE = 512;

export interface ImageVariant {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  size: number;
  width: number;
  height: number;
}

export interface ImageVariantSet {
  archive: ImageVariant;
  display: ImageVariant;
  thumbnail: ImageVariant;
}

export interface ImageProcessorOptions {
  displayMaxDimension?: number;
  thumbnailSize?: number;
}

export async function generateImageVariants(
  input: Buffer,
  sourceMimeType: string,
  options: ImageProcessorOptions = {}
): Promise<ImageVariantSet> {
  const metadata = await sharp(input).metadata();
  const hasAlpha = Boolean(metadata.hasAlpha);
  const archiveFormat = selectArchiveFormat(sourceMimeType, hasAlpha);
  const displayMax = options.displayMaxDimension ?? DEFAULT_DISPLAY_MAX;
  const thumbSize = options.thumbnailSize ?? DEFAULT_THUMB_SIZE;

  const archive = await buildVariant(
    sharp(input)
      .rotate()
      .toFormat(
        archiveFormat === 'png' ? 'png' : 'jpeg',
        archiveFormat === 'png' ? { compressionLevel: 9 } : { quality: 90, mozjpeg: true }
      ),
    archiveFormat === 'png' ? 'image/png' : 'image/jpeg',
    archiveFormat === 'png' ? 'png' : 'jpg'
  );

  const display = await buildVariant(
    sharp(input)
      .rotate()
      .resize({
        width: displayMax,
        height: displayMax,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80, effort: 4 }),
    'image/webp',
    'webp'
  );

  const thumbnail = await buildVariant(
    sharp(input)
      .rotate()
      .resize(thumbSize, thumbSize, {
        fit: 'cover',
        position: 'attention',
      })
      .webp({ quality: 70, effort: 3 }),
    'image/webp',
    'webp'
  );

  return {
    archive,
    display,
    thumbnail,
  };
}

function selectArchiveFormat(sourceMimeType: string, hasAlpha: boolean): 'png' | 'jpg' {
  if (hasAlpha && sourceMimeType.toLowerCase() === 'image/png') {
    return 'png';
  }

  return 'jpg';
}

async function buildVariant(
  instance: Sharp,
  mimeType: string,
  extension: string
): Promise<ImageVariant> {
  const { data, info } = await instance.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    mimeType,
    extension,
    size: info.size,
    width: info.width ?? 0,
    height: info.height ?? 0,
  };
}
