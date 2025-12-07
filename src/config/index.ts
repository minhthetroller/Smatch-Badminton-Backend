import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    url: process.env.DATABASE_URL || '',
  },
  tileServerUrl: process.env.TILE_SERVER_URL || 'http://localhost:7800',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
  },
  zalopay: {
    appId: process.env.ZALOPAY_APP_ID || '',
    key1: process.env.ZALOPAY_KEY1 || '', // Key for creating MAC
    key2: process.env.ZALOPAY_KEY2 || '', // Key for verifying callback MAC
    endpoint: process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn', // Sandbox by default
    callbackUrl: process.env.ZALOPAY_CALLBACK_URL || '', // Public callback URL
  },
  payment: {
    slotLockTtlSeconds: Number(process.env.SLOT_LOCK_TTL_SECONDS) || 600, // 10 minutes
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
  },
} as const;

export { initializeFirebase, getFirebaseAuth, isFirebaseConfigured } from './firebase.js';
