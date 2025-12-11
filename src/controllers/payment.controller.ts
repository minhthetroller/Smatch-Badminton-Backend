import type { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/index.js';
import { sendSuccess } from '../utils/response.js';
import type { CreatePaymentDto, ZaloPayCallbackRequest } from '../types/index.js';

export class PaymentController {
  /**
   * POST /payments/create
   * Create a payment for a booking and get ZaloPay QR code URL
   */
  async createPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreatePaymentDto = req.body;
      const result = await paymentService.createPayment(data);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /payments/callback
   * Handle ZaloPay callback (webhook)
   */
  async handleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const callbackRequest: ZaloPayCallbackRequest = req.body;
      const result = await paymentService.handleCallback(callbackRequest);
      // ZaloPay expects a specific response format, not our standard format
      res.json(result);
    } catch (error) {
      // On error, still respond with ZaloPay format
      console.error('ZaloPay callback error:', error);
      res.json({
        return_code: 2,
        return_message: 'Internal server error',
      });
    }
  }

  /**
   * GET /payments/:id
   * Get payment by ID with booking details
   */
  async getPaymentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPaymentById(id!);
      sendSuccess(res, payment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /payments/:id/status
   * Query payment status from ZaloPay and update local record
   */
  async queryPaymentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const payment = await paymentService.queryPaymentStatus(id!);
      sendSuccess(res, payment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /bookings/:bookingId/payment
   * Get payment info for a booking
   */
  async getPaymentByBookingId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bookingId } = req.params;
      const payment = await paymentService.getPaymentByBookingId(bookingId!);
      sendSuccess(res, payment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /payments/:id/cancel
   * Cancel a pending payment (user-initiated cancellation)
   */
  async cancelPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const payment = await paymentService.cancelPayment(id!);
      sendSuccess(res, payment);
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();

