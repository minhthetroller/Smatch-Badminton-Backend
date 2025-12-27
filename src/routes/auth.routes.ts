import { Router } from 'express';
import { authController } from '../controllers/index.js';
import {
  requireAuth,
  requireAnonymousUser,
  requireRegisteredUser,
} from '../middlewares/auth.middleware.js';

const router = Router();

// ==================== Public Routes ====================

/**
 * POST /auth/verify
 * Verify Firebase token and create/get user
 * Used for all login types: Google, Facebook, Email/Password
 */
router.post('/verify', (req, res, next) => authController.verify(req, res, next));

/**
 * POST /auth/anonymous
 * Create or get anonymous user session
 * Used for anonymous booking flow
 */
router.post('/anonymous', (req, res, next) => authController.createAnonymous(req, res, next));

/**
 * POST /auth/username/check
 * Check if username is available
 */
router.post('/username/check', (req, res, next) => authController.checkUsername(req, res, next));

/**
 * POST /auth/username/lookup
 * Lookup email by username (for login flow)
 */
router.post('/username/lookup', (req, res, next) => authController.lookupUsername(req, res, next));

// ==================== Authenticated Routes ====================

/**
 * GET /auth/me
 * Get current user profile
 * Requires: authenticated user (anonymous or registered)
 */
router.get('/me', requireAuth, (req, res, next) => authController.getProfile(req, res, next));

/**
 * PUT /auth/me
 * Update current user profile
 * Requires: authenticated user
 */
router.put('/me', requireAuth, (req, res, next) => authController.updateProfile(req, res, next));

/**
 * GET /auth/me/bookings
 * Get user's booking history
 * Requires: authenticated user (anonymous or registered)
 */
router.get('/me/bookings', requireAuth, (req, res, next) =>
  authController.getBookingHistory(req, res, next)
);

/**
 * POST /auth/link-bookings
 * Link existing bookings to user by phone or email
 * Requires: authenticated user
 */
router.post('/link-bookings', requireAuth, (req, res, next) =>
  authController.linkBookings(req, res, next)
);

// ==================== Anonymous User Routes ====================

/**
 * POST /auth/convert
 * Convert anonymous user to registered user
 * Requires: authenticated anonymous user
 */
router.post('/convert', requireAnonymousUser, (req, res, next) =>
  authController.convertAnonymous(req, res, next)
);

// ==================== Registered User Routes ====================

/**
 * DELETE /auth/account
 * Delete current user account
 * Requires: authenticated registered user
 */
router.delete('/account', requireRegisteredUser, (req, res, next) =>
  authController.deleteAccount(req, res, next)
);

// ==================== FCM Token Routes ====================

/**
 * POST /auth/fcm-token
 * Register FCM token for push notifications
 * Requires: authenticated user
 */
router.post('/fcm-token', requireAuth, (req, res, next) =>
  authController.registerFcmToken(req, res, next)
);

/**
 * DELETE /auth/fcm-token
 * Unregister FCM token
 * Requires: authenticated user
 */
router.delete('/fcm-token', requireAuth, (req, res, next) =>
  authController.unregisterFcmToken(req, res, next)
);

export { router as authRoutes };

