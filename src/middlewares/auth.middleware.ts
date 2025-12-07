import type { Request, Response, NextFunction } from 'express';
import { firebaseService } from '../services/firebase.service.js';
import { userService } from '../services/user.service.js';
import { AppError } from '../utils/errors.js';
import type { UserProfileDto, DecodedFirebaseToken, mapUserToDto } from '../types/auth.types.js';
import { mapUserToDto as mapUser } from '../types/auth.types.js';

/**
 * Extended Express Request with auth info
 */
export interface AuthRequest extends Request {
  user?: UserProfileDto;
  firebaseToken?: DecodedFirebaseToken;
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Authentication middleware - requires valid Firebase token
 * Verifies token and attaches user to request
 */
export async function requireAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);
    
    if (!token) {
      throw new AppError('Authorization header required', 401, 'MISSING_TOKEN');
    }

    // Verify Firebase token
    const decodedToken = await firebaseService.verifyIdToken(token);
    req.firebaseToken = decodedToken;

    // Get or create user from database
    const user = await userService.getUserByFirebaseUid(decodedToken.uid);
    
    if (!user) {
      throw new AppError('User not found. Please verify your account first.', 401, 'USER_NOT_FOUND');
    }

    req.user = mapUser(user);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if valid token provided, but doesn't fail if no token
 */
export async function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);
    
    if (!token) {
      // No token provided, continue without user
      next();
      return;
    }

    // Verify Firebase token
    const decodedToken = await firebaseService.verifyIdToken(token);
    req.firebaseToken = decodedToken;

    // Get user from database
    const user = await userService.getUserByFirebaseUid(decodedToken.uid);
    
    if (user) {
      req.user = mapUser(user);
    }

    next();
  } catch (error) {
    // Token invalid, but optional - continue without user
    // Log for debugging but don't fail
    console.warn('Optional auth failed:', error instanceof Error ? error.message : 'Unknown error');
    next();
  }
}

/**
 * Require authenticated non-anonymous user
 */
export async function requireRegisteredUser(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);
    
    if (!token) {
      throw new AppError('Authorization header required', 401, 'MISSING_TOKEN');
    }

    // Verify Firebase token
    const decodedToken = await firebaseService.verifyIdToken(token);
    req.firebaseToken = decodedToken;

    // Get user from database
    const user = await userService.getUserByFirebaseUid(decodedToken.uid);
    
    if (!user) {
      throw new AppError('User not found. Please verify your account first.', 401, 'USER_NOT_FOUND');
    }

    if (user.isAnonymous) {
      throw new AppError('This action requires a registered account', 403, 'ANONYMOUS_NOT_ALLOWED');
    }

    req.user = mapUser(user);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Require anonymous user (for conversion endpoint)
 */
export async function requireAnonymousUser(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);
    
    if (!token) {
      throw new AppError('Authorization header required', 401, 'MISSING_TOKEN');
    }

    // Verify Firebase token
    const decodedToken = await firebaseService.verifyIdToken(token);
    req.firebaseToken = decodedToken;

    // Get user from database
    const user = await userService.getUserByFirebaseUid(decodedToken.uid);
    
    if (!user) {
      throw new AppError('User not found. Please create an anonymous session first.', 401, 'USER_NOT_FOUND');
    }

    if (!user.isAnonymous) {
      throw new AppError('User is already registered', 400, 'ALREADY_REGISTERED');
    }

    req.user = mapUser(user);
    next();
  } catch (error) {
    next(error);
  }
}

