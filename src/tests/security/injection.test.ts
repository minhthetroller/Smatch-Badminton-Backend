import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction, Router } from 'express';
import {
  xssPayloads,
  sqlInjectionPayloads,
  noSqlInjectionPayloads,
  pathTraversalPayloads,
  invalidUuidPayloads,
  combinedAttacks,
  oversizedPayloads,
  generateOversizedPayload,
  malformedJsonPayloads,
} from '../fixtures/index.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import { errorHandler, notFoundHandler } from '../../middlewares/index.js';

// Use retro-compatible jest.fn() with proper typing for ESM
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// Type for paginated results
interface PaginatedCourtsResult {
  courts: unknown[];
  total: number;
  page: number;
  limit: number;
}

// Mock services
const mockCourtService = {
  getAllCourts: jest.fn<AnyFn>(),
  getCourtById: jest.fn<AnyFn>(),
  createCourt: jest.fn<AnyFn>(),
  updateCourt: jest.fn<AnyFn>(),
  deleteCourt: jest.fn<AnyFn>(),
  getNearbyCourts: jest.fn<AnyFn>(),
};

const mockAvailabilityService = {
  getCourtAvailability: jest.fn<AnyFn>(),
  createBooking: jest.fn<AnyFn>(),
  getBookingById: jest.fn<AnyFn>(),
  cancelBooking: jest.fn<AnyFn>(),
  getBookingsByPhone: jest.fn<AnyFn>(),
};

// Test controller with dependency injection
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
}

class TestBookingController {
  private service: typeof mockAvailabilityService;

  constructor(service: typeof mockAvailabilityService) {
    this.service = service;
  }

  async getByPhone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const phone = req.query.phone as string;
      const bookings = await this.service.getBookingsByPhone(phone);
      sendSuccess(res, bookings);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const booking = await this.service.createBooking(req.body);
      sendSuccess(res, booking, 201);
    } catch (error) {
      next(error);
    }
  }
}

// Create test routes
function createTestCourtRoutes(controller: TestCourtController): Router {
  const router = Router();
  router.get('/', (req, res, next) => controller.getAll(req, res, next));
  router.get('/:id', (req, res, next) => controller.getById(req, res, next));
  router.post('/', (req, res, next) => controller.create(req, res, next));
  return router;
}

function createTestBookingRoutes(controller: TestBookingController): Router {
  const router = Router();
  router.get('/', (req, res, next) => controller.getByPhone(req, res, next));
  router.post('/', (req, res, next) => controller.create(req, res, next));
  return router;
}

// Create test app
function createTestApp(
  courtService: typeof mockCourtService,
  availabilityService: typeof mockAvailabilityService,
  jsonLimit = '100kb'
): Express {
  const app = express();
  app.use(express.json({ limit: jsonLimit }));
  const courtController = new TestCourtController(courtService);
  const bookingController = new TestBookingController(availabilityService);
  app.use('/api/courts', createTestCourtRoutes(courtController));
  app.use('/api/bookings', createTestBookingRoutes(bookingController));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('Security Tests - XSS Prevention', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockCourtService).forEach(mock => mock.mockReset());
    Object.values(mockAvailabilityService).forEach(mock => mock.mockReset());
    
    app = createTestApp(mockCourtService, mockAvailabilityService);

    // Mock successful responses
    mockCourtService.createCourt.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'test-id',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  describe('XSS in Court Name Field', () => {
    it('should handle script tag in name', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ name: xssPayloads.scriptTag })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.name).toBe('string');
    });

    it('should handle img onerror XSS payload', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ name: xssPayloads.imgOnerror })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle javascript URL in name', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ name: xssPayloads.javascriptUrl })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle SVG onload XSS', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ name: xssPayloads.svgOnload })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('XSS in Description Field', () => {
    it('should handle script tag in description', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ 
          name: 'Test Court',
          description: xssPayloads.scriptTag 
        })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle event handler injection', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ 
          name: 'Test Court',
          description: xssPayloads.divOnmouseover 
        })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('XSS in Array Fields', () => {
    it('should handle XSS in phoneNumbers array', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ 
          name: 'Test Court',
          phoneNumbers: [xssPayloads.scriptTag, '0901234567'] 
        })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('XSS in Booking Fields', () => {
    beforeEach(() => {
      mockAvailabilityService.createBooking.mockImplementation(async (data: Record<string, unknown>) => ({
        id: 'booking-id',
        ...data,
        totalPrice: 100000,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }));
    });

    it('should handle XSS in guestName', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({
          subCourtId: 'valid-uuid-here',
          guestName: xssPayloads.scriptTag,
          guestPhone: '0901234567',
          date: '2025-12-15',
          startTime: '10:00',
          endTime: '12:00',
        })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle XSS in notes field', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({
          subCourtId: 'valid-uuid-here',
          guestName: 'Test User',
          guestPhone: '0901234567',
          date: '2025-12-15',
          startTime: '10:00',
          endTime: '12:00',
          notes: xssPayloads.imgOnerror,
        })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('XSS in Query Parameters', () => {
    beforeEach(() => {
      mockCourtService.getAllCourts.mockResolvedValue({
        courts: [],
        total: 0,
        page: 1,
        limit: 10,
      });
    });

    it('should handle XSS in district filter', async () => {
      const response = await request(app)
        .get(`/api/courts?district=${encodeURIComponent(xssPayloads.scriptTag)}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Security Tests - SQL Injection Prevention', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockCourtService).forEach(mock => mock.mockReset());
    
    app = createTestApp(mockCourtService, mockAvailabilityService);

    mockCourtService.createCourt.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'test-id',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    mockCourtService.getAllCourts.mockResolvedValue({
      courts: [],
      total: 0,
      page: 1,
      limit: 10,
    });
  });

  describe('SQL Injection in Name Field', () => {
    it('should handle DROP TABLE injection', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ name: sqlInjectionPayloads.dropTable })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle UNION SELECT injection', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ name: sqlInjectionPayloads.unionSelect })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle OR tautology injection', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ name: sqlInjectionPayloads.basicOr })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle comment-based injection', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ name: sqlInjectionPayloads.commentDash })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('SQL Injection in Query Parameters', () => {
    it('should handle SQL injection in district filter', async () => {
      const response = await request(app)
        .get(`/api/courts?district=${encodeURIComponent(sqlInjectionPayloads.basicOr)}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle SQL injection in page parameter', async () => {
      const response = await request(app)
        .get(`/api/courts?page=${encodeURIComponent('1; DROP TABLE courts;--')}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('SQL Injection in Bookings', () => {
    beforeEach(() => {
      mockAvailabilityService.getBookingsByPhone.mockResolvedValue([]);
    });

    it('should handle SQL injection in phone parameter', async () => {
      const response = await request(app)
        .get(`/api/bookings?phone=${encodeURIComponent(sqlInjectionPayloads.basicOr)}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PostgreSQL Specific Injections', () => {
    it('should handle pg_sleep injection', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ name: sqlInjectionPayloads.blindTimePostgres })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle version() injection', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ name: sqlInjectionPayloads.pgVersion })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Security Tests - NoSQL/JSON Injection Prevention', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockCourtService).forEach(mock => mock.mockReset());
    
    app = createTestApp(mockCourtService, mockAvailabilityService);

    mockCourtService.createCourt.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'test-id',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  describe('NoSQL Operators in JSONB Fields', () => {
    it('should handle $gt operator in details', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({
          name: 'Test Court',
          details: noSqlInjectionPayloads.gtOperator,
        })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle $where operator in details', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({
          name: 'Test Court',
          details: noSqlInjectionPayloads.whereOperator,
        })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Prototype Pollution Prevention', () => {
    it('should handle __proto__ payload', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({
          name: 'Test Court',
          details: noSqlInjectionPayloads.protoPayload,
        })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(({} as Record<string, unknown>).admin).toBeUndefined();
    });

    it('should handle constructor payload', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({
          name: 'Test Court',
          details: noSqlInjectionPayloads.constructorPayload,
        })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Deeply Nested JSON', () => {
    it('should handle deeply nested objects', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({
          name: 'Test Court',
          details: noSqlInjectionPayloads.nestedDeep,
        })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Security Tests - Path Traversal Prevention', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockCourtService).forEach(mock => mock.mockReset());
    
    app = createTestApp(mockCourtService, mockAvailabilityService);

    mockCourtService.getCourtById.mockRejectedValue(new Error('Invalid UUID'));
  });

  describe('Path Traversal in ID Parameters', () => {
    it('should reject basic path traversal in court ID', async () => {
      const response = await request(app)
        .get(`/api/courts/${encodeURIComponent(pathTraversalPayloads.basicTraversal)}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should reject URL encoded path traversal', async () => {
      const response = await request(app)
        .get(`/api/courts/${pathTraversalPayloads.urlEncoded}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should reject null byte injection', async () => {
      const response = await request(app)
        .get(`/api/courts/${encodeURIComponent(pathTraversalPayloads.nullByte)}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('Security Tests - UUID Validation', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockCourtService).forEach(mock => mock.mockReset());
    
    app = createTestApp(mockCourtService, mockAvailabilityService);

    mockCourtService.getCourtById.mockRejectedValue(new Error('Invalid UUID'));
  });

  describe('Invalid UUID Formats', () => {
    it('should reject UUID that is too short', async () => {
      const response = await request(app)
        .get(`/api/courts/${invalidUuidPayloads.tooShort}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should reject UUID with invalid characters', async () => {
      const response = await request(app)
        .get(`/api/courts/${invalidUuidPayloads.invalidChars}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should reject SQL injection in UUID field', async () => {
      const response = await request(app)
        .get(`/api/courts/${encodeURIComponent(invalidUuidPayloads.sqlInUuid as string)}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should reject XSS in UUID field', async () => {
      const response = await request(app)
        .get(`/api/courts/${encodeURIComponent(invalidUuidPayloads.xssInUuid as string)}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle empty string as UUID (hits list endpoint)', async () => {
      mockCourtService.getAllCourts.mockResolvedValue({
        courts: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      const response = await request(app)
        .get('/api/courts/')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Security Tests - Payload Size Limits', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockCourtService).forEach(mock => mock.mockReset());
    
    app = createTestApp(mockCourtService, mockAvailabilityService, '100kb');
  });

  describe('Oversized Payloads', () => {
    it('should reject payload larger than limit', async () => {
      const largePayload = {
        name: 'Test',
        description: generateOversizedPayload(200),
      };

      const response = await request(app)
        .post('/api/courts')
        .send(largePayload)
        .set('Content-Type', 'application/json')
        .expect(413);

      expect(response.status).toBe(413);
    });

    it('should handle very large array', async () => {
      mockCourtService.createCourt.mockImplementation(async (data: Record<string, unknown>) => ({
        id: 'test-id',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const response = await request(app)
        .post('/api/courts')
        .send({
          name: 'Test',
          phoneNumbers: oversizedPayloads.largeArray,
        })
        .set('Content-Type', 'application/json');

      expect([201, 413, 400]).toContain(response.status);
    });
  });
});

describe('Security Tests - Malformed Input', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockCourtService).forEach(mock => mock.mockReset());
    
    app = createTestApp(mockCourtService, mockAvailabilityService);
  });

  describe('Malformed JSON', () => {
    it('should reject unclosed brace', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send(malformedJsonPayloads.unclosedBrace)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject trailing comma', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send(malformedJsonPayloads.trailingComma)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('Security Tests - Combined Attack Vectors', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockCourtService).forEach(mock => mock.mockReset());
    
    app = createTestApp(mockCourtService, mockAvailabilityService);

    mockCourtService.createCourt.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'test-id',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  describe('XSS + SQL Injection Combined', () => {
    it('should handle XSS in SQL context', async () => {
      const response = await request(app)
        .post('/api/courts')
        .send({ name: combinedAttacks.xssInSql })
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle SQL in UUID path', async () => {
      mockCourtService.getCourtById.mockRejectedValue(new Error('Invalid UUID'));

      const response = await request(app)
        .get(`/api/courts/${encodeURIComponent(combinedAttacks.sqlInPath)}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});

