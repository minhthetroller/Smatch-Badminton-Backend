/**
 * S3 Proxy Routes
 * Proxies S3 requests through localhost:3000 to LocalStack
 */

import { Router } from 'express';
import { getS3Client } from '../config/s3.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const router = Router();

/**
 * Proxy S3 requests to LocalStack
 * GET /s3-proxy/:bucket/...
 * Uses regex to capture bucket and remaining path
 */
router.get(/^\/([^\/]+)\/(.+)$/, async (req, res, next) => {
  try {
    const bucket = req.params[0];
    const key = req.params[1];

    if (!key) {
      return res.status(400).json({ error: 'File key is required' });
    }

    const s3Client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);

    // Set appropriate headers
    if (response.ContentType) {
      res.setHeader('Content-Type', response.ContentType);
    }
    if (response.ContentLength) {
      res.setHeader('Content-Length', response.ContentLength);
    }
    if (response.CacheControl) {
      res.setHeader('Cache-Control', response.CacheControl);
    } else {
      // Default cache for images
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
    if (response.ETag) {
      res.setHeader('ETag', response.ETag);
    }

    // Stream the file
    if (response.Body) {
      const stream = response.Body as NodeJS.ReadableStream;
      stream.pipe(res);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'File not found' });
    }
    next(error);
  }
});

export { router as s3ProxyRoutes };
