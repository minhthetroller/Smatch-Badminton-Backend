import sharp from 'sharp';

/**
 * Image Service for processing and optimization
 * Handles compression, resizing, and format conversion
 */
export class ImageService {
  /**
   * Compress and resize image
   * @param buffer Image buffer
   * @param maxWidth Maximum width in pixels
   * @param maxHeight Maximum height in pixels
   * @param quality JPEG quality (1-100, default: 80)
   * @returns Processed image buffer
   */
  async compressAndResize(
    buffer: Buffer,
    maxWidth: number,
    maxHeight: number,
    quality: number = 80
  ): Promise<Buffer> {
    return await sharp(buffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }

  /**
   * Create thumbnail from image
   * @param buffer Image buffer
   * @param size Thumbnail size (default: 200x200)
   * @param quality JPEG quality (default: 80)
   * @returns Thumbnail buffer
   */
  async createThumbnail(
    buffer: Buffer,
    size: number = 200,
    quality: number = 80
  ): Promise<Buffer> {
    return await sharp(buffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }

  /**
   * Compress profile photo
   * @param buffer Image buffer
   * @returns Compressed image buffer (500x500 max)
   */
  async compressProfilePhoto(buffer: Buffer): Promise<Buffer> {
    return await this.compressAndResize(buffer, 500, 500, 85);
  }

  /**
   * Compress match image
   * @param buffer Image buffer
   * @returns Compressed image buffer (1920x1080 max)
   */
  async compressMatchImage(buffer: Buffer): Promise<Buffer> {
    return await this.compressAndResize(buffer, 1920, 1080, 80);
  }

  /**
   * Get image metadata
   * @param buffer Image buffer
   * @returns Image metadata
   */
  async getMetadata(buffer: Buffer): Promise<sharp.Metadata> {
    return await sharp(buffer).metadata();
  }

  /**
   * Validate image buffer
   * @param buffer Image buffer
   * @returns True if valid image
   */
  async isValidImage(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(buffer);
      return !!(metadata.format && metadata.width && metadata.height);
    } catch {
      return false;
    }
  }
}

export const imageService = new ImageService();
