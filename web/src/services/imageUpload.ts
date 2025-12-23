import {
  ref,
  uploadBytes,
  deleteObject,
  getMetadata,
} from 'firebase/storage';
import { storage } from '../config/firebase';
import { SubmissionAssetSet, SubmissionAssetVariant } from './submissions';

export const IMAGE_CONSTRAINTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MiB
  MIN_WIDTH: 256,
  MIN_HEIGHT: 256,
  MAX_CAPTION_LENGTH: 500,
  SUPPORTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
}

type SupportedImageType = (typeof IMAGE_CONSTRAINTS.SUPPORTED_TYPES)[number];

function isSupportedType(type: string): type is SupportedImageType {
  return (IMAGE_CONSTRAINTS.SUPPORTED_TYPES as readonly string[]).includes(type);
}

export async function validateImage(file: File): Promise<ImageValidationResult> {
  // Check file type
  if (!isSupportedType(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type. Please use JPEG, PNG, or WebP.`,
    };
  }

  // Check file size
  if (file.size > IMAGE_CONSTRAINTS.MAX_FILE_SIZE) {
    const sizeMB = (IMAGE_CONSTRAINTS.MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File is too large. Maximum size is ${sizeMB} MB.`,
    };
  }

  // Check dimensions
  try {
    const dimensions = await getImageDimensions(file);
    if (
      dimensions.width < IMAGE_CONSTRAINTS.MIN_WIDTH ||
      dimensions.height < IMAGE_CONSTRAINTS.MIN_HEIGHT
    ) {
      return {
        valid: false,
        error: `Image is too small. Minimum size is ${IMAGE_CONSTRAINTS.MIN_WIDTH}x${IMAGE_CONSTRAINTS.MIN_HEIGHT} pixels.`,
      };
    }

    return {
      valid: true,
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch {
    return {
      valid: false,
      error: 'Could not read image dimensions. Please try a different file.',
    };
  }
}

export function validateCaption(caption: string): { valid: boolean; error?: string } {
  if (caption.length > IMAGE_CONSTRAINTS.MAX_CAPTION_LENGTH) {
    return {
      valid: false,
      error: `Caption is too long. Maximum length is ${IMAGE_CONSTRAINTS.MAX_CAPTION_LENGTH} characters.`,
    };
  }
  return { valid: true };
}

function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

async function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  outputType: 'image/webp' | 'image/jpeg' = 'image/webp'
): Promise<ProcessedImage> {
  const dimensions = await getImageDimensions(file);
  let { width, height } = dimensions;

  // Calculate new dimensions maintaining aspect ratio
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Create canvas and draw resized image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const img = await createImageBitmap(file);
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create blob'));
      },
      outputType,
      quality
    );
  });

  return {
    blob,
    width,
    height,
    mimeType: outputType,
  };
}

async function createThumbnail(
  file: File,
  size: number,
  quality: number
): Promise<ProcessedImage> {
  const dimensions = await getImageDimensions(file);
  const { width, height } = dimensions;

  // Calculate crop dimensions for square thumbnail
  const cropSize = Math.min(width, height);
  const cropX = (width - cropSize) / 2;
  const cropY = (height - cropSize) / 2;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const img = await createImageBitmap(file);
  ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, size, size);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create blob'));
      },
      'image/webp',
      quality
    );
  });

  return {
    blob,
    width: size,
    height: size,
    mimeType: 'image/webp',
  };
}

export function generateUploadId(): string {
  return crypto.randomUUID();
}

export async function processAndUploadImage(
  file: File,
  contestId: string,
  uploadId: string
): Promise<SubmissionAssetSet> {
  // Get storage bucket name
  const bucketName = storage.app.options.storageBucket;
  if (!bucketName) {
    throw new Error('Storage bucket not configured');
  }

  // Generate variants
  const [archive, display, thumbnail] = await Promise.all([
    // Archive: original quality, just ensure reasonable format
    resizeImage(file, 4096, 4096, 0.9, 'image/jpeg'),
    // Display: max 1920px, WebP
    resizeImage(file, 1920, 1920, 0.8, 'image/webp'),
    // Thumbnail: 512x512 square crop
    createThumbnail(file, 512, 0.7),
  ]);

  const basePath = `submissions/${contestId}/${uploadId}`;

  // Upload all variants in parallel
  const [archiveVariant, displayVariant, thumbnailVariant] = await Promise.all([
    uploadVariant(bucketName, `${basePath}/archive.jpg`, archive),
    uploadVariant(bucketName, `${basePath}/display.webp`, display),
    uploadVariant(bucketName, `${basePath}/thumbnail.webp`, thumbnail),
  ]);

  return {
    archive: archiveVariant,
    display: displayVariant,
    thumbnail: thumbnailVariant,
  };
}

async function uploadVariant(
  bucket: string,
  path: string,
  image: ProcessedImage
): Promise<SubmissionAssetVariant> {
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, image.blob, {
    contentType: image.mimeType,
    cacheControl: 'public, max-age=31536000, immutable',
  });

  return {
    bucket,
    path,
    mimeType: image.mimeType,
    size: image.blob.size,
    width: image.width,
    height: image.height,
  };
}

export async function deleteImageVariants(
  assets: SubmissionAssetSet
): Promise<void> {
  const deletePromises = [
    deleteObject(ref(storage, assets.archive.path)).catch(() => {
      // Ignore errors if file doesn't exist
    }),
    deleteObject(ref(storage, assets.display.path)).catch(() => {}),
    deleteObject(ref(storage, assets.thumbnail.path)).catch(() => {}),
  ];

  await Promise.all(deletePromises);
}

export async function checkFileExists(path: string): Promise<boolean> {
  try {
    await getMetadata(ref(storage, path));
    return true;
  } catch {
    return false;
  }
}
