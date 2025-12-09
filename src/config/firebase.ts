import { initializeApp, cert, getApps } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let firebaseApp: App | null = null;
let firebaseAuth: Auth | null = null;

/**
 * Firebase Admin SDK Configuration
 * Uses service account credentials from environment variables or JSON file
 */
export function initializeFirebase(): App {
  if (firebaseApp) {
    return firebaseApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }

  // Try loading from JSON file first
  const serviceAccountPath = path.join(process.cwd(), 'smatch-badminton-firebase-adminsdk-fbsvc-b4ea537d9e.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('✅ Firebase Admin SDK initialized successfully from JSON file');
      return firebaseApp;
    } catch (error) {
      console.error('❌ Failed to load Firebase config from JSON file:', error);
      // Fall through to env vars
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase configuration missing. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables, or provide the service account JSON file.'
    );
  }

  firebaseApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  console.log('✅ Firebase Admin SDK initialized successfully from environment variables');
  return firebaseApp;
}

/**
 * Get Firebase Auth instance
 * Initializes Firebase if not already done
 */
export function getFirebaseAuth(): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const app = initializeFirebase();
  firebaseAuth = getAuth(app);
  return firebaseAuth;
}

/**
 * Check if Firebase is properly configured
 */
export function isFirebaseConfigured(): boolean {
  const serviceAccountPath = path.join(process.cwd(), 'smatch-badminton-firebase-adminsdk-fbsvc-b4ea537d9e.json');
  if (fs.existsSync(serviceAccountPath)) {
    return true;
  }

  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

