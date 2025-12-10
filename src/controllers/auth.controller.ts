import type { Response, NextFunction } from 'express';
import { userService } from '../services/index.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/errors.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import type {
  VerifyTokenDto,
  CreateAnonymousDto,
  ConvertAnonymousDto,
  UpdateProfileDto,
  CheckUsernameDto,
  LookupUsernameDto,
  mapUserToDto,
} from '../types/auth.types.js';
import { mapUserToDto as mapUser } from '../types/auth.types.js';

export class AuthController {
  /**
   * POST /auth/verify
   * Verify Firebase token and create/get user
   */
  async verify(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken, profile }: VerifyTokenDto = req.body;

      if (!idToken) {
        throw new AppError('idToken is required', 400, 'MISSING_TOKEN');
      }

      const { user, isNewUser } = await userService.verifyAndGetUser(idToken, profile);

      sendSuccess(res, {
        user: mapUser(user),
        isNewUser,
      }, isNewUser ? 201 : 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/anonymous
   * Create or get anonymous user
   */
  async createAnonymous(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { firebaseUid }: CreateAnonymousDto = req.body;

      if (!firebaseUid) {
        throw new AppError('firebaseUid is required', 400, 'MISSING_FIREBASE_UID');
      }

      const { user, isNewUser } = await userService.createAnonymousUser(firebaseUid);

      sendSuccess(res, {
        user: mapUser(user),
        isNewUser,
      }, isNewUser ? 201 : 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/convert
   * Convert anonymous user to registered user
   * Requires: authenticated anonymous user
   */
  async convertAnonymous(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: ConvertAnonymousDto = req.body;

      if (!data.provider) {
        throw new AppError('provider is required', 400, 'MISSING_PROVIDER');
      }

      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }

      const user = await userService.convertAnonymousUser(req.user.id, data);

      sendSuccess(res, {
        user: mapUser(user),
        converted: true,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/me
   * Get current user profile
   * Requires: authenticated user
   */
  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }

      sendSuccess(res, { user: req.user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /auth/me
   * Update current user profile
   * Requires: authenticated user
   */
  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: UpdateProfileDto = req.body;

      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }

      const user = await userService.updateProfile(req.user.id, data);

      sendSuccess(res, { user: mapUser(user) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/me/bookings
   * Get current user's booking history
   * Requires: authenticated user
   */
  async getBookingHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }

      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const status = req.query.status as string | undefined;

      const result = await userService.getBookingHistory(req.user.id, page, limit, status);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/username/check
   * Check if username is available
   */
  async checkUsername(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username }: CheckUsernameDto = req.body;

      if (!username) {
        throw new AppError('username is required', 400, 'MISSING_USERNAME');
      }

      // Validate username format
      if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
        throw new AppError(
          'Username must be 3-50 characters and contain only letters, numbers, and underscores',
          400,
          'INVALID_USERNAME_FORMAT'
        );
      }

      const available = await userService.checkUsernameAvailability(username);

      sendSuccess(res, {
        username,
        available,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/username/lookup
   * Lookup email by username (for login flow)
   */
  async lookupUsername(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username }: LookupUsernameDto = req.body;

      if (!username) {
        throw new AppError('username is required', 400, 'MISSING_USERNAME');
      }

      const email = await userService.lookupEmailByUsername(username);

      if (!email) {
        throw new AppError('Username not found', 404, 'USERNAME_NOT_FOUND');
      }

      sendSuccess(res, {
        username,
        email,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /auth/account
   * Delete current user account
   * Requires: authenticated registered user
   */
  async deleteAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }

      await userService.deleteAccount(req.user.id);

      sendSuccess(res, { message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/link-bookings
   * Link existing bookings to user by phone or email
   * Requires: authenticated user
   */
  async linkBookings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }

      const { phoneNumber, email } = req.body as { phoneNumber?: string; email?: string };

      if (!phoneNumber && !email) {
        throw new AppError('phoneNumber or email is required', 400, 'MISSING_IDENTIFIER');
      }

      let linkedCount = 0;

      if (phoneNumber) {
        linkedCount += await userService.linkBookingsByPhone(req.user.id, phoneNumber);
      }

      if (email) {
        linkedCount += await userService.linkBookingsByEmail(req.user.id, email);
      }

      sendSuccess(res, {
        linkedCount,
        message: `${linkedCount} booking(s) linked to your account`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

