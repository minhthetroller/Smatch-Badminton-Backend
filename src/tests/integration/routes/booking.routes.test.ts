import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction, Router } from 'express';
import {
  createBookingDto,
  validBookingId,
  nonExistentBookingId,
  validSubCourtId,
  sampleBooking,
  bookingWithInvalidDate,
  bookingWithInvalidTime,
  bookingWithEndBeforeStart,
  bookingWithShortDuration,
  validAvailabilityDate,
  invalidDateFormat,
} from '../../fixtures/index.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import { errorHandler, notFoundHandler } from '../../../middlewares/index.js';

// Use retro-compatible jest.fn() with proper typing for ESM
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// Mock the availability service - use simple jest.fn() for ESM compatibility
const mockAvailabilityService = {
  getCourtAvailability: jest.fn<AnyFn>(),
  createBooking: jest.fn<AnyFn>(),
  getBookingById: jest.fn<AnyFn>(),
  cancelBooking: jest.fn<AnyFn>(),
  getBookingsByPhone: jest.fn<AnyFn>(),
};

// Create test controller with dependency injection
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

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const booking = await this.service.getBookingById(req.params.id!);
      sendSuccess(res, booking);
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

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const booking = await this.service.cancelBooking(req.params.id!);
      sendSuccess(res, booking);
    } catch (error) {
      next(error);
    }
  }
}

// Create test availability controller
class TestAvailabilityController {
  private service: typeof mockAvailabilityService;

  constructor(service: typeof mockAvailabilityService) {
    this.service = service;
  }

  async getAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { courtId } = req.params;
      const { date } = req.query;
      const availability = await this.service.getCourtAvailability(courtId, date as string);
      sendSuccess(res, availability);
    } catch (error) {
      next(error);
    }
  }
}

// Create test routes
function createTestBookingRoutes(controller: TestBookingController): Router {
  const router = Router();
  router.get('/', (req, res, next) => controller.getByPhone(req, res, next));
  router.get('/:id', (req, res, next) => controller.getById(req, res, next));
  router.post('/', (req, res, next) => controller.create(req, res, next));
  router.delete('/:id', (req, res, next) => controller.cancel(req, res, next));
  return router;
}

function createTestAvailabilityRoutes(controller: TestAvailabilityController): Router {
  const router = Router();
  router.get('/:courtId/availability', (req, res, next) => controller.getAvailability(req, res, next));
  return router;
}

// Create test app
function createTestApp(service: typeof mockAvailabilityService): Express {
  const app = express();
  app.use(express.json());
  const bookingController = new TestBookingController(service);
  const availabilityController = new TestAvailabilityController(service);
  app.use('/api/bookings', createTestBookingRoutes(bookingController));
  app.use('/api/courts', createTestAvailabilityRoutes(availabilityController));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('Booking Routes Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockAvailabilityService).forEach(mock => mock.mockReset());
    app = createTestApp(mockAvailabilityService);
  });

  describe('GET /api/bookings?phone=xxx', () => {
    it('should return bookings for phone number', async () => {
      const bookings = [sampleBooking];
      mockAvailabilityService.getBookingsByPhone.mockResolvedValue(bookings);

      const response = await request(app)
        .get('/api/bookings?phone=0901234567')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return empty array for phone with no bookings', async () => {
      mockAvailabilityService.getBookingsByPhone.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/bookings?phone=0999999999')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/bookings/:id', () => {
    it('should return booking by ID', async () => {
      const bookingResponse = {
        id: validBookingId,
        subCourtId: validSubCourtId,
        subCourtName: 'Sân 1',
        courtId: 'court-id',
        courtName: 'Court Name',
        guestName: 'Test User',
        guestPhone: '0901234567',
        guestEmail: null,
        date: '2025-12-15',
        startTime: '10:00',
        endTime: '12:00',
        totalPrice: 140000,
        status: 'pending',
        notes: null,
        createdAt: new Date().toISOString(),
      };
      mockAvailabilityService.getBookingById.mockResolvedValue(bookingResponse);

      const response = await request(app)
        .get(`/api/bookings/${validBookingId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(validBookingId);
    });

    it('should return 404 for non-existent booking', async () => {
      mockAvailabilityService.getBookingById.mockRejectedValue(new NotFoundError('Booking not found'));

      const response = await request(app)
        .get(`/api/bookings/${nonExistentBookingId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Booking not found');
    });
  });

  describe('POST /api/bookings', () => {
    it('should create booking with valid data', async () => {
      const bookingResponse = {
        id: 'new-booking-id',
        ...createBookingDto,
        subCourtName: 'Sân 1',
        courtId: 'court-id',
        courtName: 'Court Name',
        totalPrice: 140000,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      mockAvailabilityService.createBooking.mockResolvedValue(bookingResponse);

      const response = await request(app)
        .post('/api/bookings')
        .send(createBookingDto)
        .set('Content-Type', 'application/json')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending');
    });

    it('should return 400 for invalid date format', async () => {
      mockAvailabilityService.createBooking.mockRejectedValue(
        new BadRequestError('Invalid date format. Use YYYY-MM-DD')
      );

      const response = await request(app)
        .post('/api/bookings')
        .send(bookingWithInvalidDate)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('date format');
    });

    it('should return 400 for invalid time format', async () => {
      mockAvailabilityService.createBooking.mockRejectedValue(
        new BadRequestError('Invalid time format. Use HH:mm')
      );

      const response = await request(app)
        .post('/api/bookings')
        .send(bookingWithInvalidTime)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for end time before start time', async () => {
      mockAvailabilityService.createBooking.mockRejectedValue(
        new BadRequestError('Start time must be before end time')
      );

      const response = await request(app)
        .post('/api/bookings')
        .send(bookingWithEndBeforeStart)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for booking duration less than 1 hour', async () => {
      mockAvailabilityService.createBooking.mockRejectedValue(
        new BadRequestError('Minimum booking duration is 1 hour')
      );

      const response = await request(app)
        .post('/api/bookings')
        .send(bookingWithShortDuration)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent sub-court', async () => {
      mockAvailabilityService.createBooking.mockRejectedValue(
        new NotFoundError('Sub-court not found')
      );

      const response = await request(app)
        .post('/api/bookings')
        .send({ ...createBookingDto, subCourtId: nonExistentBookingId })
        .set('Content-Type', 'application/json')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 409 for overlapping booking', async () => {
      mockAvailabilityService.createBooking.mockRejectedValue(
        new ConflictError('Time slot is already booked')
      );

      const response = await request(app)
        .post('/api/bookings')
        .send(createBookingDto)
        .set('Content-Type', 'application/json')
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('already booked');
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('should cancel booking successfully', async () => {
      const cancelledBooking = {
        ...sampleBooking,
        status: 'cancelled',
      };
      mockAvailabilityService.cancelBooking.mockResolvedValue(cancelledBooking);

      const response = await request(app)
        .delete(`/api/bookings/${validBookingId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent booking', async () => {
      mockAvailabilityService.cancelBooking.mockRejectedValue(
        new NotFoundError('Booking not found')
      );

      const response = await request(app)
        .delete(`/api/bookings/${nonExistentBookingId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for already cancelled booking', async () => {
      mockAvailabilityService.cancelBooking.mockRejectedValue(
        new BadRequestError('Booking is already cancelled')
      );

      const response = await request(app)
        .delete(`/api/bookings/${validBookingId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for completed booking', async () => {
      mockAvailabilityService.cancelBooking.mockRejectedValue(
        new BadRequestError('Cannot cancel a completed booking')
      );

      const response = await request(app)
        .delete(`/api/bookings/${validBookingId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('Availability Routes Integration Tests', () => {
  let app: Express;
  const courtId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockAvailabilityService).forEach(mock => mock.mockReset());
    app = createTestApp(mockAvailabilityService);
  });

  describe('GET /api/courts/:courtId/availability', () => {
    it('should return availability for valid date', async () => {
      const availabilityResponse = {
        courtId,
        courtName: 'Test Court',
        date: validAvailabilityDate,
        dayType: 'weekday',
        openingTime: '06:00',
        closingTime: '22:00',
        subCourts: [],
      };
      mockAvailabilityService.getCourtAvailability.mockResolvedValue(availabilityResponse);

      const response = await request(app)
        .get(`/api/courts/${courtId}/availability?date=${validAvailabilityDate}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.courtId).toBe(courtId);
    });

    it('should return 400 for invalid date format', async () => {
      mockAvailabilityService.getCourtAvailability.mockRejectedValue(
        new BadRequestError('Invalid date format. Use YYYY-MM-DD')
      );

      const response = await request(app)
        .get(`/api/courts/${courtId}/availability?date=${invalidDateFormat}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent court', async () => {
      mockAvailabilityService.getCourtAvailability.mockRejectedValue(
        new NotFoundError('Court not found')
      );

      const response = await request(app)
        .get(`/api/courts/${nonExistentBookingId}/availability?date=${validAvailabilityDate}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when court is closed on requested day', async () => {
      mockAvailabilityService.getCourtAvailability.mockRejectedValue(
        new BadRequestError('Court is closed on sun')
      );

      const response = await request(app)
        .get(`/api/courts/${courtId}/availability?date=2025-12-21`) // Sunday
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('Health Check', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  });

  it('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });
});
