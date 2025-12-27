import {
  isSupportedImageType,
  detectMimeType,
  ensureDimensions,
  ImageValidationError,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
} from './imageValidation';

describe('imageValidation', () => {
  describe('isSupportedImageType', () => {
    it('should return true for supported mime types', () => {
      expect(isSupportedImageType(null, 'image/jpeg')).toBe(true);
      expect(isSupportedImageType(null, 'image/png')).toBe(true);
      expect(isSupportedImageType(null, 'image/webp')).toBe(true);
      expect(isSupportedImageType(null, 'image/heic')).toBe(true);
      expect(isSupportedImageType(null, 'image/heif')).toBe(true);
    });

    it('should be case insensitive for mime types', () => {
      expect(isSupportedImageType(null, 'IMAGE/JPEG')).toBe(true);
      expect(isSupportedImageType(null, 'Image/PNG')).toBe(true);
    });

    it('should return true for supported file extensions', () => {
      expect(isSupportedImageType('photo.jpg', null)).toBe(true);
      expect(isSupportedImageType('photo.jpeg', null)).toBe(true);
      expect(isSupportedImageType('photo.png', null)).toBe(true);
      expect(isSupportedImageType('photo.webp', null)).toBe(true);
      expect(isSupportedImageType('photo.heic', null)).toBe(true);
      expect(isSupportedImageType('PHOTO.JPG', null)).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(isSupportedImageType('video.mp4', 'video/mp4')).toBe(false);
      expect(isSupportedImageType('document.pdf', null)).toBe(false);
      expect(isSupportedImageType(null, 'image/gif')).toBe(false);
      expect(isSupportedImageType('photo.gif', null)).toBe(false);
    });

    it('should return false for null/undefined inputs', () => {
      expect(isSupportedImageType(null, null)).toBe(false);
      expect(isSupportedImageType(undefined, undefined)).toBe(false);
    });

    it('should prefer mime type over extension', () => {
      // Valid mime type with wrong extension
      expect(isSupportedImageType('photo.gif', 'image/jpeg')).toBe(true);
    });
  });

  describe('detectMimeType', () => {
    it('should detect JPEG from magic bytes', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00]);
      const result = await detectMimeType(jpegBuffer);
      expect(result).toBe('image/jpeg');
    });

    it('should detect PNG from magic bytes', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const result = await detectMimeType(pngBuffer);
      expect(result).toBe('image/png');
    });

    it('should detect WebP from magic bytes', async () => {
      // RIFF....WEBP
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      const result = await detectMimeType(webpBuffer);
      expect(result).toBe('image/webp');
    });

    it('should detect HEIC from magic bytes', async () => {
      // ....ftyp
      const heicBuffer = Buffer.from([
        0x00, 0x00, 0x00, 0x00, // size
        0x66, 0x74, 0x79, 0x70, // ftyp
        0x00, 0x00, 0x00, 0x00,
      ]);
      const result = await detectMimeType(heicBuffer);
      expect(result).toBe('image/heic');
    });

    it('should use fallback when magic bytes do not match', async () => {
      const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const result = await detectMimeType(unknownBuffer, 'image/png');
      expect(result).toBe('image/png');
    });

    it('should throw when no match and no valid fallback', async () => {
      const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);

      await expect(detectMimeType(unknownBuffer)).rejects.toThrow(ImageValidationError);
      await expect(detectMimeType(unknownBuffer)).rejects.toThrow(
        'Attachment is not a supported image.'
      );
    });

    it('should reject invalid fallback mime type', async () => {
      const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);

      await expect(detectMimeType(unknownBuffer, 'video/mp4')).rejects.toThrow(
        ImageValidationError
      );
    });
  });

  describe('ensureDimensions', () => {
    it('should not throw for valid dimensions', () => {
      expect(() => ensureDimensions(1920, 1080)).not.toThrow();
      expect(() => ensureDimensions(256, 256)).not.toThrow();
      expect(() => ensureDimensions(4000, 3000)).not.toThrow();
    });

    it('should throw for dimensions below minimum', () => {
      expect(() => ensureDimensions(100, 100)).toThrow(ImageValidationError);
      expect(() => ensureDimensions(100, 100)).toThrow('Image must be at least 256x256px.');
    });

    it('should throw when width is below minimum', () => {
      expect(() => ensureDimensions(100, 500)).toThrow(ImageValidationError);
    });

    it('should throw when height is below minimum', () => {
      expect(() => ensureDimensions(500, 100)).toThrow(ImageValidationError);
    });

    it('should respect custom minimum dimensions', () => {
      expect(() => ensureDimensions(100, 100, 50, 50)).not.toThrow();
      expect(() => ensureDimensions(100, 100, 200, 200)).toThrow(ImageValidationError);
    });
  });

  describe('ALLOWED_MIME_TYPES', () => {
    it('should contain expected types', () => {
      expect(ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/png')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/webp')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/heic')).toBe(true);
      expect(ALLOWED_MIME_TYPES.has('image/heif')).toBe(true);
    });

    it('should not contain unsupported types', () => {
      expect(ALLOWED_MIME_TYPES.has('image/gif')).toBe(false);
      expect(ALLOWED_MIME_TYPES.has('image/bmp')).toBe(false);
    });
  });

  describe('ALLOWED_EXTENSIONS', () => {
    it('should contain expected extensions', () => {
      expect(ALLOWED_EXTENSIONS.has('.jpg')).toBe(true);
      expect(ALLOWED_EXTENSIONS.has('.jpeg')).toBe(true);
      expect(ALLOWED_EXTENSIONS.has('.png')).toBe(true);
      expect(ALLOWED_EXTENSIONS.has('.webp')).toBe(true);
      expect(ALLOWED_EXTENSIONS.has('.heic')).toBe(true);
      expect(ALLOWED_EXTENSIONS.has('.heif')).toBe(true);
    });
  });

  describe('ImageValidationError', () => {
    it('should have correct properties', () => {
      const error = new ImageValidationError('UNSUPPORTED_TYPE', 'Test message');

      expect(error.code).toBe('UNSUPPORTED_TYPE');
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('ImageValidationError');
    });

    it('should capture cause stack', () => {
      const cause = new Error('Original error');
      const error = new ImageValidationError('MAGIC_BYTES_MISMATCH', 'Wrapped', cause);

      expect(error.stack).toBe(cause.stack);
    });
  });
});
