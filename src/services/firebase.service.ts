import { getFirebaseAuth } from '../config/firebase.js';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { AuthProvider, DecodedFirebaseToken } from '../types/auth.types.js';
import { AppError } from '../utils/errors.js';

/**
 * Firebase Authentication Service
 * Handles token verification and Firebase user management
 */
export class FirebaseService {
  /**
   * Verify Firebase ID token and return decoded token
   */
  async verifyIdToken(idToken: string): Promise<DecodedFirebaseToken> {
    try {
      const auth = getFirebaseAuth();
      const decodedToken: DecodedIdToken = await auth.verifyIdToken(idToken, true);
      
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
        phone_number: decodedToken.phone_number,
        name: decodedToken.name,
        picture: decodedToken.picture,
        firebase: {
          sign_in_provider: decodedToken.firebase.sign_in_provider,
          identities: decodedToken.firebase.identities,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        // Firebase specific error codes
        if (error.message.includes('auth/id-token-expired')) {
          throw new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
        }
        if (error.message.includes('auth/id-token-revoked')) {
          throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
        }
        if (error.message.includes('auth/invalid-id-token')) {
          throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
        }
        if (error.message.includes('auth/argument-error')) {
          throw new AppError('Invalid token format', 401, 'INVALID_TOKEN_FORMAT');
        }
      }
      throw new AppError('Failed to verify token', 401, 'TOKEN_VERIFICATION_FAILED');
    }
  }

  /**
   * Get Firebase user by UID
   */
  async getFirebaseUser(uid: string) {
    try {
      const auth = getFirebaseAuth();
      return await auth.getUser(uid);
    } catch (error) {
      if (error instanceof Error && error.message.includes('auth/user-not-found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete Firebase user
   */
  async deleteFirebaseUser(uid: string): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      await auth.deleteUser(uid);
    } catch (error) {
      if (error instanceof Error && error.message.includes('auth/user-not-found')) {
        // User already deleted, ignore
        return;
      }
      throw new AppError('Failed to delete Firebase user', 500, 'FIREBASE_DELETE_FAILED');
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeRefreshTokens(uid: string): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      await auth.revokeRefreshTokens(uid);
    } catch (error) {
      throw new AppError('Failed to revoke tokens', 500, 'REVOKE_TOKENS_FAILED');
    }
  }

  /**
   * Extract auth provider from decoded token
   */
  getProviderFromToken(decodedToken: DecodedFirebaseToken): AuthProvider {
    const signInProvider = decodedToken.firebase.sign_in_provider;
    
    switch (signInProvider) {
      case 'google.com':
        return 'google';
      case 'facebook.com':
        return 'facebook';
      case 'password':
        return 'password';
      case 'anonymous':
        return 'anonymous';
      default:
        // Handle other providers or default to password
        return 'password';
    }
  }

  /**
   * Check if token belongs to anonymous user
   */
  isAnonymousToken(decodedToken: DecodedFirebaseToken): boolean {
    return decodedToken.firebase.sign_in_provider === 'anonymous';
  }

  /**
   * Set custom claims for a user (useful for roles)
   */
  async setCustomClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      await auth.setCustomUserClaims(uid, claims);
    } catch (error) {
      throw new AppError('Failed to set custom claims', 500, 'SET_CLAIMS_FAILED');
    }
  }

  /**
   * Create a custom token for a user (useful for server-side auth)
   */
  async createCustomToken(uid: string, claims?: Record<string, unknown>): Promise<string> {
    try {
      const auth = getFirebaseAuth();
      return await auth.createCustomToken(uid, claims);
    } catch (error) {
      throw new AppError('Failed to create custom token', 500, 'CREATE_TOKEN_FAILED');
    }
  }

  /**
   * Update Firebase user email
   */
  async updateUserEmail(uid: string, email: string): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      await auth.updateUser(uid, { email, emailVerified: false });
    } catch (error) {
      if (error instanceof Error && error.message.includes('auth/email-already-exists')) {
        throw new AppError('Email already in use', 409, 'EMAIL_EXISTS');
      }
      throw new AppError('Failed to update email', 500, 'UPDATE_EMAIL_FAILED');
    }
  }

  /**
   * Generate email verification link
   */
  async generateEmailVerificationLink(email: string): Promise<string> {
    try {
      const auth = getFirebaseAuth();
      return await auth.generateEmailVerificationLink(email);
    } catch (error) {
      throw new AppError('Failed to generate verification link', 500, 'GENERATE_LINK_FAILED');
    }
  }

  /**
   * Generate password reset link
   */
  async generatePasswordResetLink(email: string): Promise<string> {
    try {
      const auth = getFirebaseAuth();
      return await auth.generatePasswordResetLink(email);
    } catch (error) {
      if (error instanceof Error && error.message.includes('auth/user-not-found')) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      throw new AppError('Failed to generate reset link', 500, 'GENERATE_LINK_FAILED');
    }
  }
}

export const firebaseService = new FirebaseService();

