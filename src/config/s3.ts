import { S3Client } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

/**
 * AWS S3 Client Configuration
 * Uses LocalStack for local development and AWS S3 for production
 */
export function initializeS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || 'test';
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || 'test';
  const endpoint = process.env.AWS_ENDPOINT; // Optional: for LocalStack

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS configuration missing. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
    );
  }

  s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    ...(endpoint && {
      endpoint,
      forcePathStyle: true, // Required for LocalStack
    }),
  });

  const envType = endpoint ? 'LocalStack' : 'AWS S3';
  console.log(`✅ S3 Client initialized successfully (${envType})`);

  return s3Client;
}

export function getS3Client(): S3Client {
  if (!s3Client) {
    return initializeS3Client();
  }
  return s3Client;
}

export function isS3Configured(): boolean {
  return s3Client !== null;
}
