import type { Request, Response, NextFunction } from 'express';
import { availabilityService } from '../services/index.js';
import { sendSuccess } from '../utils/response.js';
import type { CreateBookingDto } from '../types/index.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';

export class AvailabilityController {
  /**
   * GET /courts/:courtId/availability?date=YYYY-MM-DD
   * Get availability for a court on a specific date
   */
  async getCourtAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { courtId } = req.params;
      const { date } = req.query;

      const availability = await availabilityService.getCourtAvailability(
        courtId!,
        date as string
      );

      sendSuccess(res, availability);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /bookings
   * Create a new booking
   */
  async createBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateBookingDto = {
        ...req.body,
        userId: req.user?.id,
      };
      const booking = await availabilityService.createBooking(data);
      sendSuccess(res, booking, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /bookings/:id
   * Get booking by ID
   */
  async getBookingById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const booking = await availabilityService.getBookingById(id!);
      sendSuccess(res, booking);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /bookings/:id
   * Cancel a booking
   */
  async cancelBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const booking = await availabilityService.cancelBooking(id!);
      sendSuccess(res, booking);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /bookings?phone=xxx
   * Get bookings by phone number
   */
  async getBookingsByPhone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone } = req.query;
      const bookings = await availabilityService.getBookingsByPhone(phone as string);
      sendSuccess(res, bookings);
    } catch (error) {
      next(error);
    }
  }
}

export const availabilityController = new AvailabilityController();

