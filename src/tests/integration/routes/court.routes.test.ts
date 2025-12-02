import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction, Router } from 'express';
import {
  sampleCourt,
  sampleCourtsList,
  createCourtDto,
  updateCourtDto,
  validCourtId,
  nonExistentCourtId,
  invalidUUID,
  hanoiLocation,
  nearbyCourtResult,
} from '../../fixtures/index.js';
import { NotFoundError, BadRequestError } from '../../../utils/errors.js';
import { sendSuccess, sendPaginated } from '../../../utils/response.js';
import { errorHandler, notFoundHandler } from '../../../middlewares/index.js';

// Define types for mock service
interface PaginatedCourtsResult {
  courts: unknown[];
  total: number;
  page: number;
  limit: number;
}

// Use retro-compatible jest.fn() with proper typing for ESM
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// Mock the court service - use simple jest.fn() for ESM compatibility
const mockCourtService = {
  getAllCourts: jest.fn<AnyFn>(),
  getCourtById: jest.fn<AnyFn>(),
  createCourt: jest.fn<AnyFn>(),
  updateCourt: jest.fn<AnyFn>(),
  deleteCourt: jest.fn<AnyFn>(),
  getNearbyCourts: jest.fn<AnyFn>(),
};

// Create test controller with dependency injection
class TestCourtController {
  private service: typeof mockCourtService;

  constructor(service: typeof mockCourtService) {
    this.service = service;
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = {
        district: req.query.district as string | undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
      };
      const result = await this.service.getAllCourts(params) as PaginatedCourtsResult;
      sendPaginated(res, result.courts, { page: result.page, limit: result.limit, total: result.total });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const court = await this.service.getCourtById(req.params.id!);
      sendSuccess(res, court);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const court = await this.service.createCourt(req.body);
      sendSuccess(res, court, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const court = await this.service.updateCourt(req.params.id!, req.body);
      sendSuccess(res, court);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.deleteCourt(req.params.id!);
      sendSuccess(res, { message: 'Court deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { latitude, longitude, radius } = req.query;
      const location = {
        latitude: Number(latitude),
        longitude: Number(longitude),
      };
      const radiusKm = radius ? Number(radius) : undefined;
      const courts = await this.service.getNearbyCourts(location, radiusKm);
      sendSuccess(res, courts);
    } catch (error) {
      next(error);
    }
  }
}

// Create test routes
function createTestCourtRoutes(controller: TestCourtController): Router {
  const router = Router();
  router.get('/nearby', (req, res, next) => controller.getNearby(req, res, next));
  router.get('/', (req, res, next) => controller.getAll(req, res, next));
  router.get('/:id', (req, res, next) => controller.getById(req, res, next));
  router.post('/', (req, res, next) => controller.create(req, res, next));
  router.put('/:id', (req, res, next) => controller.update(req, res, next));
  router.delete('/:id', (req, res, next) => controller.delete(req, res, next));
  return router;
}

// Create test app
function createTestApp(service: typeof mockCourtService): Express {
  const app = express();
  app.use(express.json());
  const controller = new TestCourtController(service);
  app.use('/api/courts', createTestCourtRoutes(controller));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('Court Routes Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockCourtService).forEach(mock => mock.mockReset());
    app = createTestApp(mockCourtService);
  });

  describe('GET /api/courts', () => {
    it('should return paginated courts list', async () => {
      mockCourtService.getAllCourts.mockResolvedValue({
        courts: sampleCourtsList,
        total: 3,
        page: 1,
        limit: 10,
      });

      const response = await request(app)
        .get('/api/courts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.meta.pagination).toBeDefined();
      expect(response.body.meta.pagination.total).toBe(3);
    });

    it('should accept pagination parameters', async () => {
      mockCourtService.getAllCourts.mockResolvedValue({
        courts: [sampleCourt],
        total: 10,
        page: 2,
        limit: 5,
      });

      const response = await request(app)
        .get('/api/courts?page=2&limit=5')
        .expect(200);

      expect(mockCourtService.getAllCourts).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        district: undefined,
      });
      expect(response.body.meta.pagination.page).toBe(2);
    });

    it('should filter by district', async () => {
      mockCourtService.getAllCourts.mockResolvedValue({
        courts: [sampleCourt],
        total: 1,
        page: 1,
        limit: 10,
      });

      const response = await request(app)
        .get('/api/courts?district=Quận Ba Đình')
        .expect(200);

      expect(mockCourtService.getAllCourts).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        district: 'Quận Ba Đình',
      });
    });

    it('should return empty array when no courts found', async () => {
      mockCourtService.getAllCourts.mockResolvedValue({
        courts: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      const response = await request(app)
        .get('/api/courts')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.meta.pagination.total).toBe(0);
    });

    it('should handle server error', async () => {
      mockCourtService.getAllCourts.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/courts')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/courts/nearby', () => {
    it('should return nearby courts', async () => {
      mockCourtService.getNearbyCourts.mockResolvedValue([nearbyCourtResult]);

      const response = await request(app)
        .get(`/api/courts/nearby?latitude=${hanoiLocation.latitude}&longitude=${hanoiLocation.longitude}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should accept optional radius parameter', async () => {
      mockCourtService.getNearbyCourts.mockResolvedValue([]);

      await request(app)
        .get(`/api/courts/nearby?latitude=${hanoiLocation.latitude}&longitude=${hanoiLocation.longitude}&radius=3`)
        .expect(200);

      expect(mockCourtService.getNearbyCourts).toHaveBeenCalledWith(
        { latitude: hanoiLocation.latitude, longitude: hanoiLocation.longitude },
        3
      );
    });

    it('should handle missing latitude', async () => {
      mockCourtService.getNearbyCourts.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/courts/nearby?longitude=105.8542')
        .expect(200);

      // Note: Current implementation doesn't validate - this test documents current behavior
      expect(mockCourtService.getNearbyCourts).toHaveBeenCalled();
    });

    it('should handle missing longitude', async () => {
      mockCourtService.getNearbyCourts.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/courts/nearby?latitude=21.0285')
        .expect(200);

      // Note: Current implementation doesn't validate - this test documents current behavior
      expect(mockCourtService.getNearbyCourts).toHaveBeenCalled();
    });
  });

  describe('GET /api/courts/:id', () => {
    it('should return court by ID', async () => {
      mockCourtService.getCourtById.mockResolvedValue(sampleCourt);

      const response = await request(app)
        .get(`/api/courts/${validCourtId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(validCourtId);
    });

    it('should return 404 for non-existent court', async () => {
      mockCourtService.getCourtById.mockRejectedValue(new NotFoundError('Court not found'));

      const response = await request(app)
        .get(`/api/courts/${nonExistentCourtId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Court not found');
    });

    it('should handle invalid UUID format', async () => {
      mockCourtService.getCourtById.mockRejectedValue(new Error('Invalid UUID'));

      const response = await request(app)
        .get(`/api/courts/${invalidUUID}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/courts', () => {
    it('should create court with valid data', async () => {
      const newCourt = { ...sampleCourt, ...createCourtDto };
      mockCourtService.createCourt.mockResolvedValue(newCourt);

      const response = await request(app)
        .post('/api/courts')
        .send(createCourtDto)
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(createCourtDto.name);
    });

    it('should create court with minimal data (only name)', async () => {
      const minimalDto = { name: 'Minimal Court' };
      const newCourt = { ...sampleCourt, ...minimalDto };
      mockCourtService.createCourt.mockResolvedValue(newCourt);

      const response = await request(app)
        .post('/api/courts')
        .send(minimalDto)
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle missing required field', async () => {
      // Service should validate and throw BadRequestError
      mockCourtService.createCourt.mockRejectedValue(new BadRequestError('Name is required'));

      const response = await request(app)
        .post('/api/courts')
        .send({})
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/courts/:id', () => {
    it('should update court with valid data', async () => {
      const updatedCourt = { ...sampleCourt, ...updateCourtDto };
      mockCourtService.updateCourt.mockResolvedValue(updatedCourt);

      const response = await request(app)
        .put(`/api/courts/${validCourtId}`)
        .send(updateCourtDto)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateCourtDto.name);
    });

    it('should return 404 for non-existent court', async () => {
      mockCourtService.updateCourt.mockRejectedValue(new NotFoundError('Court not found'));

      const response = await request(app)
        .put(`/api/courts/${nonExistentCourtId}`)
        .send(updateCourtDto)
        .set('Content-Type', 'application/json')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle partial update', async () => {
      const partialUpdate = { description: 'New description' };
      const updatedCourt = { ...sampleCourt, ...partialUpdate };
      mockCourtService.updateCourt.mockResolvedValue(updatedCourt);

      const response = await request(app)
        .put(`/api/courts/${validCourtId}`)
        .send(partialUpdate)
        .set('Content-Type', 'application/json')
        .expect(200);

      expect(response.body.data.description).toBe('New description');
    });
  });

  describe('DELETE /api/courts/:id', () => {
    it('should delete court successfully', async () => {
      mockCourtService.deleteCourt.mockResolvedValue(sampleCourt);

      const response = await request(app)
        .delete(`/api/courts/${validCourtId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Court deleted successfully');
    });

    it('should return 404 for non-existent court', async () => {
      mockCourtService.deleteCourt.mockRejectedValue(new NotFoundError('Court not found'));

      const response = await request(app)
        .delete(`/api/courts/${nonExistentCourtId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
