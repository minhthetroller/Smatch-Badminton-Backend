import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction, Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import {
  // Match fixtures
  MATCH_ID_PUBLIC,
  MATCH_ID_PRIVATE,
  MATCH_ID_FREE,
  MATCH_ID_FULL,
  MATCH_ID_WITH_IMAGES,
  MATCH_ID_CONFLICT_1,
  HOST_USER_ID,
  PLAYER_USER_ID_1,
  PLAYER_USER_ID_2,
  samplePublicMatch,
  samplePrivateMatch,
  sampleFreeMatch,
  sampleFullMatch,
  sampleMatchWithImages,
  sampleConflictMatch1,
  sampleMatchPlayerAccepted,
  sampleMatchPlayerPending,
  sampleMatchPlayerPendingPayment,
  matchWithCourt,
  matchWithPlayers,
  createPublicMatchDto,
  createPrivateMatchDto,
  createMatchWithImagesDto,
  updateMatchDto,
  joinMatchDto,
  respondToRequestDto,
  invalidMatchDtos,
  matchQueryParams,
} from '../../fixtures/match.fixtures.js';
import {
  // Auth fixtures
  mockGoogleIdToken,
  decodedGoogleToken,
  sampleGoogleUser,
} from '../../fixtures/auth.fixtures.js';
import {
  // Payment fixtures
  samplePaymentSuccess,
  samplePaymentPending,
  createPaymentDto,
  zaloPayCreateOrderSuccess,
} from '../../fixtures/payment.fixtures.js';
import { AppError, NotFoundError, BadRequestError, ForbiddenError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import { errorHandler, notFoundHandler } from '../../../middlewares/index.js';
import type { AuthRequest } from '../../../middlewares/auth.middleware.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// ==================== Mock Services ====================

const mockMatchService = {
  createMatch: jest.fn<AnyFn>(),
  getAllMatches: jest.fn<AnyFn>(),
  getMatchById: jest.fn<AnyFn>(),
  updateMatch: jest.fn<AnyFn>(),
  joinMatch: jest.fn<AnyFn>(),
  leaveMatch: jest.fn<AnyFn>(),
  cancelMatch: jest.fn<AnyFn>(),
  getHostedMatches: jest.fn<AnyFn>(),
  getJoinedMatches: jest.fn<AnyFn>(),
  respondToJoinRequest: jest.fn<AnyFn>(),
};

const mockPaymentService = {
  createPayment: jest.fn<AnyFn>(),
  getPaymentByMatchPlayerId: jest.fn<AnyFn>(),
  checkPaymentStatus: jest.fn<AnyFn>(),
};

const mockFirebaseService = {
  verifyIdToken: jest.fn<AnyFn>(),
};

const mockUserService = {
  getUserByFirebaseUid: jest.fn<AnyFn>(),
};

const mockS3Service = {
  uploadFile: jest.fn<AnyFn>(),
  deleteFileByUrl: jest.fn<AnyFn>(),
};

const mockImageService = {
  compressMatchImage: jest.fn<AnyFn>(),
};

// ==================== Setup Express App ====================

let app: Express;

beforeEach(() => {
  jest.clearAllMocks();

  app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mock auth middleware
  app.use((req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return next();
    }
    
    try {
      const decoded = mockFirebaseService.verifyIdToken(token);
      if (decoded) {
        const user = mockUserService.getUserByFirebaseUid(decoded.uid);
        if (user) {
          req.user = user;
        }
      }
    } catch (error) {
      // Let auth middleware handle
    }
    next();
  });

  // Mock routes
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 3 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed'));
      }
    },
  });

  // GET /api/matches - List all matches
  router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const result = await mockMatchService.getAllMatches(req.query, userId);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/matches - Create match (with optional multipart image upload)
  router.post('/', upload.array('images', 3), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }

      const files = req.files as Express.Multer.File[] | undefined;
      let images: string[] = [];

      if (files && files.length > 0) {
        // Simulate image compression and upload
        const uploadPromises = files.map(async (file) => {
          const compressed = await mockImageService.compressMatchImage(file.buffer);
          const url = await mockS3Service.uploadFile(compressed, 'smatch-matches', `temp-${Date.now()}.jpg`);
          return url;
        });
        images = await Promise.all(uploadPromises);
      } else if (req.body.images) {
        images = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
      }

      const matchData = { ...req.body, images };
      const match = await mockMatchService.createMatch(matchData, req.user.id);
      
      return sendSuccess(res, match, 201);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/matches/:id - Get match details
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const match = await mockMatchService.getMatchById(req.params.id);
      return sendSuccess(res, match);
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/matches/:id - Update match
  router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const match = await mockMatchService.updateMatch(req.params.id, req.body, req.user.id);
      return sendSuccess(res, match);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/matches/:id/join - Join match
  router.post('/:id/join', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const matchPlayer = await mockMatchService.joinMatch(req.params.id, req.user.id, req.body);
      return sendSuccess(res, matchPlayer, 201);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/matches/:id/leave - Leave match
  router.post('/:id/leave', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      await mockMatchService.leaveMatch(req.params.id, req.user.id);
      return sendSuccess(res, { message: 'Left match successfully' });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/matches/:id/cancel - Cancel match
  router.post('/:id/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const match = await mockMatchService.cancelMatch(req.params.id, req.user.id);
      return sendSuccess(res, match);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/matches/me/hosted - Get hosted matches
  router.get('/me/hosted', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const result = await mockMatchService.getHostedMatches(req.user.id, req.query);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/matches/me/joined - Get joined matches
  router.get('/me/joined', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const result = await mockMatchService.getJoinedMatches(req.user.id, req.query);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/matches/:matchId/requests/:userId - Respond to join request
  router.post('/:matchId/requests/:userId', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const matchPlayer = await mockMatchService.respondToJoinRequest(
        req.params.matchId,
        req.params.userId,
        req.user.id,
        req.body.status
      );
      return sendSuccess(res, matchPlayer);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/matches/:matchId/payment - Create payment for match
  router.post('/:matchId/payment', async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const payment = await mockPaymentService.createPayment({
        ...req.body,
        userId: req.user.id,
        matchId: req.params.matchId,
      });
      return sendSuccess(res, payment, 201);
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/matches', router);
  
  // Handle multer errors
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: { message: 'File size exceeds 5MB limit', code: 'FILE_TOO_LARGE' }
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          error: { message: 'Too many files. Maximum 3 images allowed', code: 'TOO_MANY_FILES' }
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          error: { message: 'Unexpected field', code: 'UNEXPECTED_FIELD' }
        });
      }
    }
    if (err.message && err.message.includes('Invalid file type')) {
      return res.status(400).json({
        success: false,
        error: { message: err.message, code: 'INVALID_FILE_TYPE' }
      });
    }
    next(err);
  });
  
  app.use(notFoundHandler);
  app.use(errorHandler);
});

// ==================== Test Suites ====================

describe('Match Routes Integration Tests', () => {
  // ==================== List Matches ====================

  describe('GET /api/matches', () => {
    it('should return paginated list of matches', async () => {
      mockMatchService.getAllMatches.mockResolvedValue({
        matches: [matchWithCourt],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const response = await request(app)
        .get('/api/matches')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matches).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });

    it('should filter by court ID', async () => {
      mockMatchService.getAllMatches.mockResolvedValue({
        matches: [matchWithCourt],
        total: 1,
      });

      await request(app)
        .get('/api/matches')
        .query(matchQueryParams.byCourtId)
        .expect(200);

      expect(mockMatchService.getAllMatches).toHaveBeenCalledWith(
        expect.objectContaining(matchQueryParams.byCourtId),
        undefined
      );
    });

    it('should filter by skill level', async () => {
      mockMatchService.getAllMatches.mockResolvedValue({
        matches: [matchWithCourt],
        total: 1,
      });

      await request(app)
        .get('/api/matches')
        .query(matchQueryParams.bySkillLevel)
        .expect(200);

      expect(mockMatchService.getAllMatches).toHaveBeenCalledWith(
        expect.objectContaining(matchQueryParams.bySkillLevel),
        undefined
      );
    });

    it('should filter by date range', async () => {
      mockMatchService.getAllMatches.mockResolvedValue({
        matches: [],
        total: 0,
      });

      await request(app)
        .get('/api/matches')
        .query(matchQueryParams.byDateRange)
        .expect(200);

      expect(mockMatchService.getAllMatches).toHaveBeenCalledWith(
        expect.objectContaining(matchQueryParams.byDateRange),
        undefined
      );
    });

    it('should exclude joined matches when authenticated', async () => {
      mockFirebaseService.verifyIdToken.mockReturnValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockReturnValue({
        ...sampleGoogleUser,
        id: PLAYER_USER_ID_1,
      });
      mockMatchService.getAllMatches.mockResolvedValue({
        matches: [matchWithCourt],
        total: 1,
      });

      await request(app)
        .get('/api/matches')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .expect(200);

      expect(mockMatchService.getAllMatches).toHaveBeenCalledWith(
        expect.anything(),
        PLAYER_USER_ID_1
      );
    });

    it('should return empty array when no matches found', async () => {
      mockMatchService.getAllMatches.mockResolvedValue({
        matches: [],
        total: 0,
      });

      const response = await request(app)
        .get('/api/matches')
        .expect(200);

      expect(response.body.data.matches).toHaveLength(0);
    });
  });

  // ==================== Create Match (JSON) ====================

  describe('POST /api/matches (JSON)', () => {
    beforeEach(() => {
      mockFirebaseService.verifyIdToken.mockReturnValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockReturnValue({
        ...sampleGoogleUser,
        id: HOST_USER_ID,
      });
    });

    it('should create public match with JSON data', async () => {
      mockMatchService.createMatch.mockResolvedValue(samplePublicMatch);

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send(createPublicMatchDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: samplePublicMatch.id,
        courtId: samplePublicMatch.courtId,
        hostUserId: samplePublicMatch.hostUserId,
        title: samplePublicMatch.title,
        description: samplePublicMatch.description,
        skillLevel: samplePublicMatch.skillLevel,
        shuttleType: samplePublicMatch.shuttleType,
        playerFormat: samplePublicMatch.playerFormat,
        isPrivate: samplePublicMatch.isPrivate,
        price: samplePublicMatch.price,
        slotsNeeded: samplePublicMatch.slotsNeeded,
        status: samplePublicMatch.status,
      });
      expect(mockMatchService.createMatch).toHaveBeenCalledWith(
        expect.objectContaining(createPublicMatchDto),
        HOST_USER_ID
      );
    });

    it('should create private match', async () => {
      mockMatchService.createMatch.mockResolvedValue(samplePrivateMatch);

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send(createPrivateMatchDto)
        .expect(201);

      expect(response.body.data.isPrivate).toBe(true);
    });

    it('should create match with image URLs', async () => {
      mockMatchService.createMatch.mockResolvedValue(sampleMatchWithImages);

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send(createMatchWithImagesDto)
        .expect(201);

      expect(response.body.data.images).toHaveLength(3);
    });

    it('should return 400 for missing required fields', async () => {
      mockMatchService.createMatch.mockRejectedValue(
        new BadRequestError('Missing required fields')
      );

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send(invalidMatchDtos.missingRequired)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid skill level', async () => {
      mockMatchService.createMatch.mockRejectedValue(
        new BadRequestError('Invalid skill level')
      );

      await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .send(invalidMatchDtos.invalidSkillLevel)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/matches')
        .send(createPublicMatchDto)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // ==================== Create Match (Multipart) ====================

  describe('POST /api/matches (Multipart)', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const testImagePath = path.join(__dirname, '../../fixtures/images/valid-image.jpg');

    beforeEach(() => {
      mockFirebaseService.verifyIdToken.mockReturnValue(decodedGoogleToken);
      mockUserService.getUserByFirebaseUid.mockReturnValue({
        ...sampleGoogleUser,
        id: HOST_USER_ID,
      });
    });

    it('should create match with 1 uploaded image', async () => {
      const mockCompressedBuffer = Buffer.from('compressed');
      const mockS3Url = 'http://localhost:4566/smatch-matches/match1/img1.jpg';

      mockImageService.compressMatchImage.mockResolvedValue(mockCompressedBuffer);
      mockS3Service.uploadFile.mockResolvedValue(mockS3Url);
      mockMatchService.createMatch.mockResolvedValue({
        ...samplePublicMatch,
        images: [mockS3Url],
      });

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .field('courtId', createPublicMatchDto.courtId)
        .field('title', createPublicMatchDto.title)
        .field('skillLevel', createPublicMatchDto.skillLevel)
        .field('shuttleType', createPublicMatchDto.shuttleType)
        .field('playerFormat', createPublicMatchDto.playerFormat)
        .field('date', createPublicMatchDto.date!)
        .field('startTime', createPublicMatchDto.startTime)
        .field('endTime', createPublicMatchDto.endTime)
        .field('price', createPublicMatchDto.price.toString())
        .field('slotsNeeded', createPublicMatchDto.slotsNeeded.toString())
        .attach('images', testImagePath)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.images).toHaveLength(1);
      expect(mockImageService.compressMatchImage).toHaveBeenCalledTimes(1);
      expect(mockS3Service.uploadFile).toHaveBeenCalledTimes(1);
    });

    it('should create match with uploaded images', async () => {
      const mockCompressedBuffer = Buffer.from('compressed');
      const mockS3Urls = [
        'http://localhost:4566/smatch-matches/match1/img1.jpg',
        'http://localhost:4566/smatch-matches/match1/img2.jpg',
      ];

      mockImageService.compressMatchImage.mockResolvedValue(mockCompressedBuffer);
      mockS3Service.uploadFile.mockResolvedValueOnce(mockS3Urls[0]);
      mockS3Service.uploadFile.mockResolvedValueOnce(mockS3Urls[1]);
      mockMatchService.createMatch.mockResolvedValue({
        ...samplePublicMatch,
        images: mockS3Urls,
      });

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .field('courtId', createPublicMatchDto.courtId)
        .field('title', createPublicMatchDto.title)
        .field('skillLevel', createPublicMatchDto.skillLevel)
        .field('shuttleType', createPublicMatchDto.shuttleType)
        .field('playerFormat', createPublicMatchDto.playerFormat)
        .field('date', createPublicMatchDto.date!)
        .field('startTime', createPublicMatchDto.startTime)
        .field('endTime', createPublicMatchDto.endTime)
        .field('price', createPublicMatchDto.price.toString())
        .field('slotsNeeded', createPublicMatchDto.slotsNeeded.toString())
        .attach('images', testImagePath)
        .attach('images', testImagePath)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.images).toHaveLength(2);
      expect(mockImageService.compressMatchImage).toHaveBeenCalledTimes(2);
      expect(mockS3Service.uploadFile).toHaveBeenCalledTimes(2);
    });

    it('should accept up to 3 images', async () => {
      const mockCompressedBuffer = Buffer.from('compressed');
      const mockS3Urls = Array.from({ length: 3 }, (_, i) => 
        `http://localhost:4566/smatch-matches/match/img${i + 1}.jpg`
      );

      mockImageService.compressMatchImage.mockResolvedValue(mockCompressedBuffer);
      mockS3Service.uploadFile.mockResolvedValueOnce(mockS3Urls[0]);
      mockS3Service.uploadFile.mockResolvedValueOnce(mockS3Urls[1]);
      mockS3Service.uploadFile.mockResolvedValueOnce(mockS3Urls[2]);
      mockMatchService.createMatch.mockResolvedValue({
        ...samplePublicMatch,
        images: mockS3Urls,
      });

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .field('courtId', createPublicMatchDto.courtId)
        .field('title', createPublicMatchDto.title)
        .field('skillLevel', createPublicMatchDto.skillLevel)
        .field('shuttleType', createPublicMatchDto.shuttleType)
        .field('playerFormat', createPublicMatchDto.playerFormat)
        .field('date', createPublicMatchDto.date!)
        .field('startTime', createPublicMatchDto.startTime)
        .field('endTime', createPublicMatchDto.endTime)
        .field('price', createPublicMatchDto.price.toString())
        .field('slotsNeeded', createPublicMatchDto.slotsNeeded.toString())
        .attach('images', testImagePath)
        .attach('images', testImagePath)
        .attach('images', testImagePath)
        .expect(201);

      expect(response.body.data.images).toHaveLength(3);
    });

    it('should reject more than 3 images', async () => {
      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .field('courtId', createPublicMatchDto.courtId)
        .field('title', createPublicMatchDto.title)
        .attach('images', testImagePath)
        .attach('images', testImagePath)
        .attach('images', testImagePath)
        .attach('images', testImagePath)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Too many files');
    });

    it('should reject invalid image types', async () => {
      const invalidFilePath = path.join(__dirname, '../../fixtures/images/invalid.txt');

      const response = await request(app)
        .post('/api/matches')
        .set('Authorization', `Bearer ${mockGoogleIdToken}`)
        .field('courtId', createPublicMatchDto.courtId)
        .attach('images', invalidFilePath)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid file type');
    });
  });

  // Rest of the test file continues in next message...
});
