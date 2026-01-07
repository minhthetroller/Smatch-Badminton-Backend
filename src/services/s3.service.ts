import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client } from '../config/s3.js';
import { config } from '../config/index.js';

/**
 * S3 Service for file storage operations
 * Handles upload, delete, and presigned URL generation
 */
export class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = getS3Client();
  }

  /**
   * Upload file to S3 bucket
   * @param buffer File buffer
   * @param key S3 object key (path)
   * @param contentType MIME type
   * @param bucketName Optional bucket name (defaults to profile bucket)
   * @returns S3 URL of uploaded file
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
    bucketName?: string
  ): Promise<string> {
    const bucket = bucketName || config.aws.s3.bucketProfile;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);

    // Generate URL based on endpoint (LocalStack vs AWS)
    if (config.aws.endpoint) {
      // LocalStack: Use proxy through localhost:3000
      const port = config.port || 3000;
      return `http://localhost:${port}/api/s3-proxy/${bucket}/${key}`;
    } else {
      // AWS S3 URL format
      return `https://${bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
    }
  }

  /**
   * Delete file from S3 bucket
   * @param key S3 object key (path)
   * @param bucketName Optional bucket name (defaults to profile bucket)
   */
  async deleteFile(key: string, bucketName?: string): Promise<void> {
    const bucket = bucketName || config.aws.s3.bucketProfile;

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  /**
   * Generate presigned URL for temporary access
   * @param key S3 object key (path)
   * @param bucketName Optional bucket name
   * @param expiresIn Expiration time in seconds (default: 3600)
   * @returns Presigned URL
   */
  async generatePresignedUrl(
    key: string,
    bucketName?: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const bucket = bucketName || config.aws.s3.bucketProfile;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Check if bucket exists
   * @param bucketName Bucket name
   * @returns True if bucket exists
   */
  async checkBucketExists(bucketName: string): Promise<boolean> {
    try {
      const command = new HeadBucketCommand({ Bucket: bucketName });
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create bucket if it doesn't exist
   * @param bucketName Bucket name
   */
  async createBucket(bucketName: string): Promise<void> {
    const exists = await this.checkBucketExists(bucketName);
    if (exists) {
      console.log(`✅ S3 bucket already exists: ${bucketName}`);
      return;
    }

    const command = new CreateBucketCommand({ Bucket: bucketName });
    await this.s3Client.send(command);
    console.log(`✅ S3 bucket created: ${bucketName}`);
  }

  /**
   * Extract S3 key from URL
   * @param url S3 URL
   * @returns S3 key or null
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      // Handle LocalStack URL format: http://localhost:4566/bucket/key
      if (url.includes(config.aws.endpoint || '')) {
        const parts = url.split('/');
        // Remove protocol, domain, port, and bucket name
        return parts.slice(4).join('/');
      }

      // Handle AWS S3 URL format: https://bucket.s3.region.amazonaws.com/key
      const match = url.match(/\.amazonaws\.com\/(.+)$/);
      return match?.[1] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Delete file by URL
   * @param url S3 URL
   * @param bucketName Optional bucket name
   */
  async deleteFileByUrl(url: string, bucketName?: string): Promise<void> {
    const key = this.extractKeyFromUrl(url);
    if (!key) {
      console.warn(`⚠️ Could not extract S3 key from URL: ${url}`);
      return;
    }
    await this.deleteFile(key, bucketName);
  }
}

export const s3Service = new S3Service();
