import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction, Router } from 'express';
import {
  // Firebase tokens
  mockGoogleIdToken,
  mockFacebookIdToken,
  mockPasswordIdToken,
  mockAnonymousIdToken,
  mockExpiredIdToken,
  mockInvalidIdToken,
  // Decoded tokens
  decodedGoogleToken,
  decodedFacebookToken,
  decodedPasswordToken,
  decodedAnonymousToken,
  // Firebase UIDs
  googleFirebaseUid,
  facebookFirebaseUid,
  passwordFirebaseUid,
  anonymousFirebaseUid,
  newFirebaseUid,
  // Users
  sampleGoogleUser,
  sampleFacebookUser,
  samplePasswordUser,
  sampleAnonymousUser,
  // User IDs
  validUserId,
  anonymousUserId,
  // DTOs
  verifyGoogleTokenDto,
  verifyFacebookTokenDto,
  verifyPasswordTokenDto,
  createAnonymousDto,
  convertAnonymousDto,
  updateProfileDto,
  checkUsernameDto,
  lookupUsernameDto,
  googleUserProfileDto,
  anonymousUserProfileDto,
  sampleBookingHistory,
  // Helpers
  createMockUser,
  createMockDecodedToken,
  invalidUsernameFormats,
  validUsernameFormats,
} from '../../fixtures/index.js';
import { AppError, NotFoundError, BadRequestError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import { errorHandler, notFoundHandler } from '../../../middlewares/index.js';
import type { AuthRequest } from '../../../middlewares/auth.middleware.js';
import type { UserProfileDto, DecodedFirebaseToken } from '../../../types/auth.types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// ==================== Mock Services ====================

const mockUserService = {
  verifyAndGetUser: jest.fn<AnyFn>(),
  createAnonymousUser: jest.fn<AnyFn>(),
  convertAnonymousUser: jest.fn<AnyFn>(),
  getUserById: jest.fn<AnyFn>(),
  getUserByFirebaseUid: jest.fn<AnyFn>(),
  updateProfile: jest.fn<AnyFn>(),
  checkUsernameAvailability: jest.fn<AnyFn>(),
  lookupEmailByUsername: jest.fn<AnyFn>(),
  deleteAccount: jest.fn<AnyFn>(),
  getBookingHistory: jest.fn<AnyFn>(),
  linkBookingsByPhone: jest.fn<AnyFn>(),
  linkBookingsByEmail: jest.fn<AnyFn>(),
};

const mockFirebaseService = {
  verifyIdToken: jest.fn<AnyFn>(),
  getProviderFromToken: jest.fn<AnyFn>(),
  isAnonymousToken: jest.fn<AnyFn>(),
  deleteFirebaseUser: jest.fn<AnyFn>(),
};

// ==================== Map User to DTO Helper ====================

function mapUserToDto(user: typeof sampleGoogleUser): UserProfileDto {
  const hasAddress = user.addressStreet || user.addressWard || user.addressDistrict || user.addressCity;
  
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    username: user.username,
    provider: user.provider as UserProfileDto['provider'],
    isAnonymous: user.isAnonymous,
    firstName: user.firstName,
    lastName: user.lastName,
    gender: user.gender as UserProfileDto['gender'],
    phoneNumber: user.phoneNumber,
    photoUrl: user.photoUrl,
    address: hasAddress
      ? {
          street: user.addressStreet,
          ward: user.addressWard,
          district: user.addressDistrict,
          city: user.addressCity,
        }
      : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

// ==================== Test Controller ====================

class TestAuthController {
  private userService: typeof mockUserService;
  private firebaseService: typeof mockFirebaseService;

  constructor(userService: typeof mockUserService, firebaseService: typeof mockFirebaseService) {
    this.userService = userService;
    this.firebaseService = firebaseService;
  }

  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken, profile } = req.body;

      if (!idToken) {
        throw new AppError('idToken is required', 400, 'MISSING_TOKEN');
      }

      const { user, isNewUser } = await this.userService.verifyAndGetUser(idToken, profile);

      sendSuccess(res, {
        user: mapUserToDto(user),
        isNewUser,
      }, isNewUser ? 201 : 200);
    } catch (error) {
      next(error);
    }
  }

  async createAnonymous(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { firebaseUid } = req.body;

      if (!firebaseUid) {
        throw new AppError('firebaseUid is required', 400, 'MISSING_FIREBASE_UID');
      }

      const { user, isNewUser } = await this.userService.createAnonymousUser(firebaseUid);

      sendSuccess(res, {
        user: mapUserToDto(user),
        isNewUser,
      }, isNewUser ? 201 : 200);
    } catch (error) {
      next(error);
    }
  }

  async checkUsername(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username } = req.body;

      if (!username) {
        throw new AppError('username is required', 400, 'MISSING_USERNAME');
      }

      if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
        throw new AppError(
          'Username must be 3-50 characters and contain only letters, numbers, and underscores',
          400,
          'INVALID_USERNAME_FORMAT'
        );
      }

      const available = await this.userService.checkUsernameAvailability(username);

      sendSuccess(res, {
        username,
        available,
      });
    } catch (error) {
      next(error);
    }
  }

  async lookupUsername(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username } = req.body;

      if (!username) {
        throw new AppError('username is required', 400, 'MISSING_USERNAME');
      }

      const email = await this.userService.lookupEmailByUsername(username);

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

  // Auth middleware simulation
  private async authenticateUser(req: AuthRequest): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authorization header required', 401, 'MISSING_TOKEN');
    }

    const token = authHeader.substring(7);
    const decodedToken = await this.firebaseService.verifyIdToken(token);
    req.firebaseToken = decodedToken;

    const user = await this.userService.getUserByFirebaseUid(decodedToken.uid);
    if (!user) {
      throw new AppError('User not found. Please verify your account first.', 401, 'USER_NOT_FOUND');
    }

    req.user = mapUserToDto(user);
  }

  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.authenticateUser(req);
      sendSuccess(res, { user: req.user });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.authenticateUser(req);
      const user = await this.userService.updateProfile(req.user!.id, req.body);
      sendSuccess(res, { user: mapUserToDto(user) });
    } catch (error) {
      next(error);
    }
  }

  async getBookingHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.authenticateUser(req);
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const status = req.query.status as string | undefined;

      const result = await this.userService.getBookingHistory(req.user!.id, page, limit, status);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async linkBookings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.authenticateUser(req);
      const { phoneNumber, email } = req.body;

      if (!phoneNumber && !email) {
        throw new AppError('phoneNumber or email is required', 400, 'MISSING_IDENTIFIER');
      }

      let linkedCount = 0;
      if (phoneNumber) {
        linkedCount += await this.userService.linkBookingsByPhone(req.user!.id, phoneNumber);
      }
      if (email) {
        linkedCount += await this.userService.linkBookingsByEmail(req.user!.id, email);
      }

      sendSuccess(res, {
        linkedCount,
        message: `${linkedCount} booking(s) linked to your account`,
      });
    } catch (error) {
      next(error);
    }
  }

  async convertAnonymous(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.authenticateUser(req);
      
      if (!req.user!.isAnonymous) {
        throw new AppError('User is already registered', 400, 'ALREADY_REGISTERED');
      }

      const { provider } = req.body;
      if (!provider) {
        throw new AppError('provider is required', 400, 'MISSING_PROVIDER');
      }

      const user = await this.userService.convertAnonymousUser(req.user!.id, req.body);

      sendSuccess(res, {
        user: mapUserToDto(user),
        converted: true,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.authenticateUser(req);
      
      if (req.user!.isAnonymous) {
        throw new AppError('This action requires a registered account', 403, 'ANONYMOUS_NOT_ALLOWED');
      }

      await this.userService.deleteAccount(req.user!.id);
      sendSuccess(res, { message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

// ==================== Test Routes ====================

function createTestAuthRoutes(controller: TestAuthController): Router {
  const router = Router();
  
  // Public routes
  router.post('/verify', (req, res, next) => controller.verify(req, res, next));
  router.post('/anonymous', (req, res, next) => controller.createAnonymous(req, res, next));
  router.post('/username/check', (req, res, next) => controller.checkUsername(req, res, next));
  router.post('/username/lookup', (req, res, next) => controller.lookupUsername(req, res, next));
  
  // Authenticated routes
  router.get('/me', (req, res, next) => controller.getProfile(req as AuthRequest, res, next));
  router.put('/me', (req, res, next) => controller.updateProfile(req as AuthRequest, res, next));
  router.get('/me/bookings', (req, res, next) => controller.getBookingHistory(req as AuthRequest, res, next));
  router.post('/link-bookings', (req, res, next) => controller.linkBookings(req as AuthRequest, res, next));
  router.post('/convert', (req, res, next) => controller.convertAnonymous(req as AuthRequest, res, next));
  router.delete('/account', (req, res, next) => controller.deleteAccount(req as AuthRequest, res, next));
  
  return router;
}

function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  const controller = new TestAuthController(mockUserService, mockFirebaseService);
  app.use('/api/auth', createTestAuthRoutes(controller));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// ==================== Tests ====================

describe('Auth Routes Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockUserService).forEach(mock => mock.mockReset());
    Object.values(mockFirebaseService).forEach(mock => mock.mockReset());
    app = createTestApp();
  });

  // ==================== Sign Up & Login with Google ====================

  describe('POST /api/auth/verify - Google OAuth', () => {
    it('should sign up new user with Google successfully', async () => {
      mockUserService.verifyAndGetUser.mockResolvedValue({
        user: sampleGoogleUser,
        isNewUser: true,
      });

      const response = await request(app)
        .post('/api/auth/verify')
        .send(verifyGoogleTokenDto)
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.provider).toBe('google');
      expect(response.body.data.user.email).toBe('googleuser@gmail.com');
      expect(response.body.data.isNewUser).toBe(true);
      expect(mockUserService.verifyAndGetUser).toHaveBeenCalledWith(mockGoogleIdToken, undefined);
    });

    it('should login existing Google user successfully', async () => {
      mockUserService.verifyAndGetUser.mockResolvedValue({
        user: sampleGoogleUser,
        isNewUser: false,
      });

      const response = await request(app)
        .post('/api/auth/verify')
        .send(verifyGoogleTokenDto)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.provider).toBe('google');
      expect(response.body.data.isNewUser).toBe(false);
    });

    it('should include profile data from Google token', async () => {
      const userWithGoogleData = {
        ...sampleGoogleUser,
        firstName: 'Google',
        lastName: 'User',
        photoUrl: 'https://lh3.googleusercontent.com/photo.jpg',
      };
      mockUserService.verifyAndGetUser.mockResolvedValue({
        user: userWithGoogleData,
        isNewUser: true,
      });

      const response = await request(app)
        .post('/api/auth/verify')
        .send(verifyGoogleTokenDto)
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.data.user.firstName).toBe('Google');
      expect(response.body.data.user.lastName).toBe('User');
      expect(response.body.data.user.photoUrl).toContain('googleusercontent.com');
    });
  });

  // ==================== Sign Up & Login with Facebook ====================

  describe('POST /api/auth/verify - Facebook OAuth', () => {
    it('should sign up new user with Facebook successfully', async () => {
      mockUserService.verifyAndGetUser.mockResolvedValue({
        user: sampleFacebookUser,
        isNewUser: true,
      });

      const response = await request(app)
        .post('/api/auth/verify')
        .send(verifyFacebookTokenDto)
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.provider).toBe('facebook');
      expect(response.body.data.user.email).toBe('fbuser@example.com');
      expect(response.body.data.isNewUser).toBe(true);
    });

    it('should login existing Facebook user successfully', async () => {
      mockUserService.verifyAndGetUser.mockResolvedValue({
        user: sampleFacebookUser,
        isNewUser: false,
      });

      const response = await request(app)
        .post('/api/auth/verify')
        .send(verifyFacebookTokenDto)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.provider).toBe('facebook');
      expect(response.body.data.isNewUser).toBe(false);
    });

    it('should include profile data from Facebook token', async () => {
      const userWithFbData = {
        ...sampleFacebookUser,
        firstName: 'Facebook',
        lastName: 'User',
        photoUrl: 'https://graph.facebook.com/photo.jpg',
      };
      mockUserService.verifyAndGetUser.mockResolvedValue({
        user: userWithFbData,
        isNewUser: true,
      });

      const response = await request(app)
        .post('/api/auth/verify')
        .send(verifyFacebookTokenDto)
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.data.user.firstName).toBe('Facebook');
      expect(response.body.data.user.photoUrl).toContain('facebook.com');
    });
  });

  // ==================== Sign Up & Login with Email/Password ====================

  describe('POST /api/auth/verify - Email/Password', () => {
    it('should sign up new user with email/password successfully', async () => {
      mockUserService.verifyAndGetUser.mockResolvedValue({
        user: samplePasswordUser,
        isNewUser: true,
      });

      const response = await request(app)
        .post('/api/auth/verify')
        .send(verifyPasswordTokenDto)
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.provider).toBe('password');
      expect(response.body.data.user.email).toBe('emailuser@example.com');
      expect(response.body.data.isNewUser).toBe(true);
      expect(mockUserService.verifyAndGetUser).toHaveBeenCalledWith(
        mockPasswordIdToken,
        verifyPasswordTokenDto.profile
      );
    });

    it('should login existing email/password user successfully', async () => {
      mockUserService.verifyAndGetUser.mockResolvedValue({
        user: samplePasswordUser,
        isNewUser: false,
      });

      const response = await request(app)
        .post('/api/auth/verify')
        .send({ idToken: mockPasswordIdToken })
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.provider).toBe('password');
      expect(response.body.data.isNewUser).toBe(false);
    });

    it('should create user with profile data on signup', async () => {
      const userWithProfile = {
        ...samplePasswordUser,
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
      };
      mockUserService.verifyAndGetUser.mockResolvedValue({
        user: userWithProfile,
        isNewUser: true,
      });

      const response = await request(app)
        .post('/api/auth/verify')
        .send(verifyPasswordTokenDto)
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.data.user.username).toBe('newuser');
      expect(response.body.data.user.firstName).toBe('New');
      expect(response.body.data.user.lastName).toBe('User');
    });
  });

  // ==================== Username Lookup (for Login Flow) ====================

  describe('POST /api/auth/username/lookup - Username Login Flow', () => {
    it('should return email for valid username', async () => {
      mockUserService.lookupEmailByUsername.mockResolvedValue('googleuser@gmail.com');

      const response = await request(app)
        .post('/api/auth/username/lookup')
        .send(lookupUsernameDto)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('googleuser');
      expect(response.body.data.email).toBe('googleuser@gmail.com');
    });

    it('should return 404 for non-existent username', async () => {
      mockUserService.lookupEmailByUsername.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/username/lookup')
        .send({ username: 'nonexistent' })
        .set('Content-Type', 'application/json')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Username not found');
    });

    it('should return 400 for missing username', async () => {
      const response = await request(app)
        .post('/api/auth/username/lookup')
        .send({})
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('username is required');
    });
  });

  // ==================== Token Verification Errors ====================

  describe('POST /api/auth/verify - Error Handling', () => {
    it('should return 400 for missing idToken', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({})
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('idToken is required');
    });

    it('should return 401 for expired token', async () => {
      mockUserService.verifyAndGetUser.mockRejectedValue(
        new AppError('Token has expired', 401, 'TOKEN_EXPIRED')
      );

      const response = await request(app)
        .post('/api/auth/verify')
        .send({ idToken: mockExpiredIdToken })
        .set('Content-Type', 'application/json')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Token has expired');
    });

    it('should return 401 for invalid token', async () => {
      mockUserService.verifyAndGetUser.mockRejectedValue(
        new AppError('Invalid token', 401, 'INVALID_TOKEN')
      );

      const response = await request(app)
        .post('/api/auth/verify')
        .send({ idToken: mockInvalidIdToken })
        .set('Content-Type', 'application/json')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid token');
    });

    it('should return 401 for revoked token', async () => {
      mockUserService.verifyAndGetUser.mockRejectedValue(
        new AppError('Token has been revoked', 401, 'TOKEN_REVOKED')
      );

      const response = await request(app)
        .post('/api/auth/verify')
        .send({ idToken: 'revoked-token' })
        .set('Content-Type', 'application/json')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Token has been revoked');
    });
  });

  // ==================== Anonymous User ====================

  describe('POST /api/auth/anonymous', () => {
    it('should create new anonymous user', async () => {
      mockUserService.createAnonymousUser.mockResolvedValue({
        user: sampleAnonymousUser,
        isNewUser: true,
      });

      const response = await request(app)
        .post('/api/auth/anonymous')
        .send(createAnonymousDto)
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.isAnonymous).toBe(true);
      expect(response.body.data.user.provider).toBe('anonymous');
      expect(response.body.data.isNewUser).toBe(true);
    });

    it('should return existing anonymous user', async () => {
      mockUserService.createAnonymousUser.mockResolvedValue({
        user: sampleAnonymousUser,
        isNewUser: false,
      });

      const response = await request(app)
        .post('/api/auth/anonymous')
        .send(createAnonymousDto)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isNewUser).toBe(false);
    });

    it('should return 400 for missing firebaseUid', async () => {
      const response = await request(app)
        .post('/api/auth/anonymous')
        .send({})
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('firebaseUid is required');
    });
  });

  // ==================== Username Availability Check ====================

  describe('POST /api/auth/username/check', () => {
    it('should return available for unused username', async () => {
      mockUserService.checkUsernameAvailability.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/username/check')
        .send(checkUsernameDto)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('newusername');
      expect(response.body.data.available).toBe(true);
    });

    it('should return unavailable for taken username', async () => {
      mockUserService.checkUsernameAvailability.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/username/check')
        .send({ username: 'googleuser' })
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.available).toBe(false);
    });

    it('should return 400 for missing username', async () => {
      const response = await request(app)
        .post('/api/auth/username/check')
        .send({})
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('username is required');
    });

    it.each(invalidUsernameFormats)('should return 400 for invalid username format: %s', async (username) => {
      const response = await request(app)
        .post('/api/auth/username/check')
        .send({ username })
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Username must be');
    });

    it.each(validUsernameFormats)('should accept valid username format: %s', async (username) => {
      mockUserService.checkUsernameAvailability.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/username/check')
        .send({ username })
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ==================== Get Profile ====================

  describe('GET /api/auth/me', () => {
    it('should return user profile for authenticated user', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(validUserId);
      expect(response.body.data.user.email).toBe('googleuser@gmail.com');
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Authorization header required');
    });

    it('should return 401 with invalid token format', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidToken')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Authorization header required');
    });

    it('should return 401 for non-existent user', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('User not found');
    });
  });

  // ==================== Update Profile ====================

  describe('PUT /api/auth/me', () => {
    it('should update user profile successfully', async () => {
      const updatedUser = { ...sampleGoogleUser, ...updateProfileDto };
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);
      mockUserService.updateProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send(updateProfileDto)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe('Updated');
      expect(response.body.data.user.lastName).toBe('Name');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/api/auth/me')
        .send(updateProfileDto)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 409 for duplicate username', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);
      mockUserService.updateProfile.mockRejectedValue(
        new AppError('Username already taken', 409, 'USERNAME_TAKEN')
      );

      const response = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send({ username: 'takenusername' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Username already taken');
    });
  });

  // ==================== Convert Anonymous User ====================

  describe('POST /api/auth/convert', () => {
    it('should convert anonymous user to Google account', async () => {
      const convertedUser = {
        ...sampleAnonymousUser,
        isAnonymous: false,
        provider: 'google',
        email: 'converted@example.com',
        firebaseUid: newFirebaseUid,
      };
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedAnonymousToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleAnonymousUser);
      mockUserService.convertAnonymousUser.mockResolvedValue(convertedUser);

      const response = await request(app)
        .post('/api/auth/convert')
        .set('Authorization', `Bearer ${mockAnonymousIdToken}`)
        .send(convertAnonymousDto)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.isAnonymous).toBe(false);
      expect(response.body.data.user.provider).toBe('google');
      expect(response.body.data.converted).toBe(true);
    });

    it('should convert anonymous user to Facebook account', async () => {
      const convertedUser = {
        ...sampleAnonymousUser,
        isAnonymous: false,
        provider: 'facebook',
        email: 'fbconverted@example.com',
      };
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedAnonymousToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleAnonymousUser);
      mockUserService.convertAnonymousUser.mockResolvedValue(convertedUser);

      const response = await request(app)
        .post('/api/auth/convert')
        .set('Authorization', `Bearer ${mockAnonymousIdToken}`)
        .send({ provider: 'facebook', email: 'fbconverted@example.com' })
        .expect(200);

      expect(response.body.data.user.provider).toBe('facebook');
    });

    it('should convert anonymous user to email/password account', async () => {
      const convertedUser = {
        ...sampleAnonymousUser,
        isAnonymous: false,
        provider: 'password',
        email: 'newpassword@example.com',
        username: 'newpassworduser',
      };
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedAnonymousToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleAnonymousUser);
      mockUserService.convertAnonymousUser.mockResolvedValue(convertedUser);

      const response = await request(app)
        .post('/api/auth/convert')
        .set('Authorization', `Bearer ${mockAnonymousIdToken}`)
        .send({ provider: 'password', email: 'newpassword@example.com', username: 'newpassworduser' })
        .expect(200);

      expect(response.body.data.user.provider).toBe('password');
      expect(response.body.data.user.username).toBe('newpassworduser');
    });

    it('should return 400 for missing provider', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedAnonymousToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleAnonymousUser);

      const response = await request(app)
        .post('/api/auth/convert')
        .set('Authorization', `Bearer ${mockAnonymousIdToken}`)
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('provider is required');
    });

    it('should return 400 for non-anonymous user', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);

      const response = await request(app)
        .post('/api/auth/convert')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send(convertAnonymousDto)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('User is already registered');
    });

    it('should return 409 for duplicate email', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedAnonymousToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleAnonymousUser);
      mockUserService.convertAnonymousUser.mockRejectedValue(
        new AppError('Email already registered', 409, 'EMAIL_EXISTS')
      );

      const response = await request(app)
        .post('/api/auth/convert')
        .set('Authorization', `Bearer ${mockAnonymousIdToken}`)
        .send({ provider: 'password', email: 'existing@example.com' })
        .expect(409);

      expect(response.body.error.message).toBe('Email already registered');
    });
  });

  // ==================== Booking History ====================

  describe('GET /api/auth/me/bookings', () => {
    it('should return booking history with pagination', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);
      mockUserService.getBookingHistory.mockResolvedValue({
        bookings: sampleBookingHistory,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      });

      const response = await request(app)
        .get('/api/auth/me/bookings')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should accept pagination parameters', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);
      mockUserService.getBookingHistory.mockResolvedValue({
        bookings: [sampleBookingHistory[0]],
        pagination: {
          page: 2,
          limit: 1,
          total: 2,
          totalPages: 2,
        },
      });

      const response = await request(app)
        .get('/api/auth/me/bookings?page=2&limit=1')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .expect(200);

      expect(mockUserService.getBookingHistory).toHaveBeenCalledWith(validUserId, 2, 1, undefined);
    });

    it('should filter by status', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);
      mockUserService.getBookingHistory.mockResolvedValue({
        bookings: [sampleBookingHistory[0]],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });

      await request(app)
        .get('/api/auth/me/bookings?status=completed')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .expect(200);

      expect(mockUserService.getBookingHistory).toHaveBeenCalledWith(validUserId, 1, 10, 'completed');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me/bookings')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // ==================== Link Bookings ====================

  describe('POST /api/auth/link-bookings', () => {
    it('should link bookings by phone number', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);
      mockUserService.linkBookingsByPhone.mockResolvedValue(3);

      const response = await request(app)
        .post('/api/auth/link-bookings')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send({ phoneNumber: '0901234567' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.linkedCount).toBe(3);
    });

    it('should link bookings by email', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);
      mockUserService.linkBookingsByEmail.mockResolvedValue(2);

      const response = await request(app)
        .post('/api/auth/link-bookings')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send({ email: 'old@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.linkedCount).toBe(2);
    });

    it('should link bookings by both phone and email', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);
      mockUserService.linkBookingsByPhone.mockResolvedValue(2);
      mockUserService.linkBookingsByEmail.mockResolvedValue(1);

      const response = await request(app)
        .post('/api/auth/link-bookings')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send({ phoneNumber: '0901234567', email: 'old@example.com' })
        .expect(200);

      expect(response.body.data.linkedCount).toBe(3);
    });

    it('should return 400 without identifier', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);

      const response = await request(app)
        .post('/api/auth/link-bookings')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send({})
        .expect(400);

      expect(response.body.error.message).toBe('phoneNumber or email is required');
    });
  });

  // ==================== Delete Account ====================

  describe('DELETE /api/auth/account', () => {
    it('should delete registered user account', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleGoogleUser);
      mockUserService.deleteAccount.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Account deleted successfully');
    });

    it('should return 403 for anonymous user', async () => {
      mockFirebaseService.verifyIdToken.mockResolvedValue(decodedAnonymousToken);
      mockUserService.getUserByFirebaseUid.mockResolvedValue(sampleAnonymousUser);

      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${mockAnonymousIdToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('This action requires a registered account');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete('/api/auth/account')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});

