import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { paymentRepository } from '../repositories/index.js';
import { availabilityRepository } from '../repositories/index.js';
import { zaloPayService } from './zalopay.service.js';
import { redisService } from './redis.service.js';
import { qrcodeService } from './qrcode.service.js';
import { websocketService } from './websocket.service.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import type {
  CreatePaymentDto,
  CreatePaymentResponse,
  PaymentResponse,
  PaymentWithBooking,
  ZaloPayCallbackRequest,
  ZaloPayCallbackResponse,
  PaymentStatus,
  QRCodeData,
} from '../types/index.js';

export class PaymentService {
  /**
   * Create a payment for a booking
   * Flow:
   * 1. Validate booking exists and is pending
   * 2. Check if there's already a pending payment
   * 3. Acquire Redis lock for the time slot
   * 4. Create payment in transaction
   * 5. Create ZaloPay order
   * 6. If ZaloPay fails, rollback and release lock
   */
  async createPayment(data: CreatePaymentDto): Promise<CreatePaymentResponse> {
    // Validate ZaloPay is configured
    if (!zaloPayService.isConfigured()) {
      throw new BadRequestError('Payment service is not configured');
    }

    // Get booking details
    const booking = await availabilityRepository.getBookingById(data.bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Validate booking status
    if (booking.status !== 'pending') {
      throw new BadRequestError(`Cannot create payment for booking with status: ${booking.status}`);
    }

    // Check if there's already a successful payment
    const hasSuccessful = await paymentRepository.hasSuccessfulPayment(data.bookingId);
    if (hasSuccessful) {
      throw new BadRequestError('Booking already has a successful payment');
    }

    // Check for existing pending payment
    const existingPending = await paymentRepository.findLatestPendingByBookingId(data.bookingId);
    if (existingPending) {
      // Return existing pending payment info with QR code
      const expireAt = new Date(
        existingPending.createdAt.getTime() + config.payment.slotLockTtlSeconds * 1000
      );

      const orderUrl = existingPending.orderUrl || '';
      let qrCode: QRCodeData;
      try {
        const base64 = await qrcodeService.generateBase64(orderUrl, { width: 300 });
        const rawBase64 = await qrcodeService.generateRawBase64(orderUrl, { width: 300 });
        qrCode = { base64, rawBase64 };
      } catch {
        qrCode = { base64: '', rawBase64: '' };
      }

      const wsProtocol = config.nodeEnv === 'production' ? 'wss' : 'ws';
      const wsSubscribeUrl = `${wsProtocol}://localhost:${config.port}/ws/payments`;

      return {
        payment: this.formatPaymentResponse(existingPending),
        orderUrl,
        qrCode,
        zpTransToken: (existingPending as { zpTransToken?: string }).zpTransToken ?? null,
        expireAt: expireAt.toISOString(),
        wsSubscribeUrl,
      };
    }

    // Acquire Redis lock for the time slot
    const dateStr = booking.date.toISOString().split('T')[0]!;
    const lockAcquired = await redisService.acquireSlotLock(
      booking.sub_court_id,
      dateStr,
      booking.start_time,
      booking.end_time,
      data.bookingId
    );

    if (!lockAcquired) {
      // Check if we already hold the lock
      const lockHolder = await redisService.getSlotLockHolder(
        booking.sub_court_id,
        dateStr,
        booking.start_time,
        booking.end_time
      );

      if (lockHolder !== data.bookingId) {
        throw new ConflictError('Time slot is currently being reserved by another user');
      }
      // We already hold the lock, continue
    }

    // Generate app_trans_id for ZaloPay
    const appTransId = zaloPayService.generateAppTransId(data.bookingId);

    // Create payment record in database
    let payment;
    let zpTransToken: string | null = null;
    try {
      payment = await prisma.$transaction(async (tx) => {
        // Create payment record
        const newPayment = await paymentRepository.create(
          {
            bookingId: data.bookingId,
            appTransId,
            amount: booking.total_price,
          },
          tx
        );

        // Create ZaloPay order
        const zaloPayResponse = await zaloPayService.createOrder({
          bookingId: data.bookingId,
          appTransId,
          amount: booking.total_price,
          guestName: booking.guest_name || 'Guest',
          guestPhone: booking.guest_phone || '',
          description: `Arc Badminton - ${booking.court_name} - ${booking.sub_court_name} - ${dateStr}`,
        });

        // Check ZaloPay response
        if (zaloPayResponse.return_code !== 1) {
          throw new Error(
            `ZaloPay order creation failed: ${zaloPayResponse.return_message} (${zaloPayResponse.sub_return_message})`
          );
        }

        // Store zpTransToken for mobile SDK
        zpTransToken = zaloPayResponse.zp_trans_token ?? null;

        // Update payment with order URL and token
        const updatedPayment = await tx.payment.update({
          where: { id: newPayment.id },
          data: {
            orderUrl: zaloPayResponse.order_url,
            zpTransToken: zpTransToken,
          },
        });

        return updatedPayment;
      });
    } catch (error) {
      // Release Redis lock on failure
      await redisService.releaseSlotLock(
        booking.sub_court_id,
        dateStr,
        booking.start_time,
        booking.end_time,
        data.bookingId
      );

      // Re-throw the error
      if (error instanceof Error) {
        throw new BadRequestError(error.message);
      }
      throw error;
    }

    // Generate QR code from order URL
    const orderUrl = payment.orderUrl || '';
    let qrCode: QRCodeData;
    try {
      const base64 = await qrcodeService.generateBase64(orderUrl, { width: 300 });
      const rawBase64 = await qrcodeService.generateRawBase64(orderUrl, { width: 300 });
      qrCode = { base64, rawBase64 };
    } catch {
      // Fallback if QR generation fails
      qrCode = { base64: '', rawBase64: '' };
    }

    // Calculate expiration time
    const expireAt = new Date(Date.now() + config.payment.slotLockTtlSeconds * 1000);

    // Build WebSocket subscribe URL
    const wsProtocol = config.nodeEnv === 'production' ? 'wss' : 'ws';
    const wsSubscribeUrl = `${wsProtocol}://localhost:${config.port}/ws/payments`;

    return {
      payment: {
        id: payment.id,
        bookingId: payment.bookingId,
        appTransId: payment.appTransId,
        zpTransId: payment.zpTransId,
        amount: payment.amount,
        status: payment.status as PaymentStatus,
        orderUrl: payment.orderUrl,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      },
      orderUrl,
      qrCode,
      zpTransToken,
      expireAt: expireAt.toISOString(),
      wsSubscribeUrl,
    };
  }

  /**
   * Handle ZaloPay callback
   * Verifies callback, updates payment status, confirms booking, and notifies via WebSocket
   */
  async handleCallback(callbackRequest: ZaloPayCallbackRequest): Promise<ZaloPayCallbackResponse> {
    // Verify callback
    const callbackData = zaloPayService.verifyCallback(callbackRequest);
    if (!callbackData) {
      return {
        return_code: 2,
        return_message: 'Invalid MAC',
      };
    }

    // Find payment by app_trans_id
    const payment = await paymentRepository.findByAppTransId(callbackData.app_trans_id);
    if (!payment) {
      console.error(`Payment not found for app_trans_id: ${callbackData.app_trans_id}`);
      return {
        return_code: 2,
        return_message: 'Payment not found',
      };
    }

    // Update payment status based on callback type
    // type: 1 = payment success, 2 = payment refund
    if (callbackRequest.type === 1) {
      // Payment successful
      await prisma.$transaction(async (tx) => {
        // Update payment status
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'success',
            zpTransId: String(callbackData.zp_trans_id),
            callbackData: callbackData as object,
            updatedAt: new Date(),
          },
        });

        // Update booking status to confirmed
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: {
            status: 'confirmed',
            updatedAt: new Date(),
          },
        });
      });

      // Release Redis lock (payment completed)
      const booking = payment.booking;
      if (booking) {
        const dateStr = booking.date.toISOString().split('T')[0]!;
        const startTime = booking.startTime.toISOString().slice(11, 16);
        const endTime = booking.endTime.toISOString().slice(11, 16);
        await redisService.releaseSlotLock(
          booking.subCourtId,
          dateStr,
          startTime,
          endTime,
          booking.id
        );
      }

      // Notify connected clients via WebSocket
      websocketService.notifyPaymentStatus({
        type: 'payment_status',
        paymentId: payment.id,
        status: 'success',
        bookingId: payment.bookingId,
        zpTransId: String(callbackData.zp_trans_id),
        message: 'Payment successful! Your booking has been confirmed.',
      });

      return {
        return_code: 1,
        return_message: 'Success',
      };
    }

    // Payment failed or unknown type
    websocketService.notifyPaymentStatus({
      type: 'payment_status',
      paymentId: payment.id,
      status: 'failed',
      bookingId: payment.bookingId,
      message: 'Payment failed. Please try again.',
    });

    return {
      return_code: 2,
      return_message: 'Unknown callback type',
    };
  }

  /**
   * Query payment status from ZaloPay and update local record
   */
  async queryPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // If payment is already in final state, return cached status
    if (payment.status === 'success' || payment.status === 'failed') {
      return this.formatPaymentResponse(payment);
    }

    // Query ZaloPay for latest status
    const queryResult = await zaloPayService.queryOrder(payment.appTransId);

    let newStatus: PaymentStatus = payment.status as PaymentStatus;
    let zpTransId: string | undefined;

    switch (queryResult.return_code) {
      case 1: // Success
        newStatus = 'success';
        zpTransId = String(queryResult.zp_trans_id);

        // Update booking status to confirmed
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: newStatus,
              zpTransId,
              updatedAt: new Date(),
            },
          });

          await tx.booking.update({
            where: { id: payment.bookingId },
            data: {
              status: 'confirmed',
              updatedAt: new Date(),
            },
          });
        });

        // Release Redis lock
        if (payment.booking) {
          const booking = payment.booking;
          const dateStr = booking.date.toISOString().split('T')[0]!;
          const startTime = booking.startTime.toISOString().slice(11, 16);
          const endTime = booking.endTime.toISOString().slice(11, 16);
          await redisService.releaseSlotLock(
            booking.subCourtId,
            dateStr,
            startTime,
            endTime,
            booking.id
          );
        }
        break;

      case 2: // Failed
        newStatus = 'failed';
        await paymentRepository.updateStatus(payment.id, newStatus);

        // Release Redis lock
        if (payment.booking) {
          const booking = payment.booking;
          const dateStr = booking.date.toISOString().split('T')[0]!;
          const startTime = booking.startTime.toISOString().slice(11, 16);
          const endTime = booking.endTime.toISOString().slice(11, 16);
          await redisService.releaseSlotLock(
            booking.subCourtId,
            dateStr,
            startTime,
            endTime,
            booking.id
          );
        }
        break;

      case 3: // Processing
        // Keep as pending, no update needed
        break;
    }

    // Fetch updated payment
    const updatedPayment = await paymentRepository.findById(paymentId);
    return this.formatPaymentResponse(updatedPayment!);
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<PaymentWithBooking> {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    return this.formatPaymentWithBooking(payment);
  }

  /**
   * Get payment for a booking
   */
  async getPaymentByBookingId(bookingId: string): Promise<PaymentResponse | null> {
    const payments = await paymentRepository.findByBookingId(bookingId);
    if (payments.length === 0) {
      return null;
    }

    // Return the most recent payment (successful > pending > failed)
    const successPayment = payments.find((p) => p.status === 'success');
    if (successPayment) {
      return this.formatPaymentResponse(successPayment);
    }

    const pendingPayment = payments.find((p) => p.status === 'pending');
    if (pendingPayment) {
      return this.formatPaymentResponse(pendingPayment);
    }

    return this.formatPaymentResponse(payments[0]!);
  }

  /**
   * Format payment response
   */
  private formatPaymentResponse(payment: {
    id: string;
    bookingId: string;
    appTransId: string;
    zpTransId: string | null;
    amount: number;
    status: string;
    orderUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PaymentResponse {
    return {
      id: payment.id,
      bookingId: payment.bookingId,
      appTransId: payment.appTransId,
      zpTransId: payment.zpTransId,
      amount: payment.amount,
      status: payment.status as PaymentStatus,
      orderUrl: payment.orderUrl,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }

  /**
   * Format payment with booking details
   */
  private formatPaymentWithBooking(payment: {
    id: string;
    bookingId: string;
    appTransId: string;
    zpTransId: string | null;
    amount: number;
    status: string;
    orderUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    booking: {
      id: string;
      subCourtId: string;
      guestName: string | null;
      guestPhone: string | null;
      date: Date;
      startTime: Date;
      endTime: Date;
      totalPrice: number;
      status: string;
    };
  }): PaymentWithBooking {
    return {
      ...this.formatPaymentResponse(payment),
      booking: {
        id: payment.booking.id,
        subCourtId: payment.booking.subCourtId,
        guestName: payment.booking.guestName,
        guestPhone: payment.booking.guestPhone,
        date: payment.booking.date.toISOString().split('T')[0]!,
        startTime: payment.booking.startTime.toISOString().slice(11, 16),
        endTime: payment.booking.endTime.toISOString().slice(11, 16),
        totalPrice: payment.booking.totalPrice,
        status: payment.booking.status,
      },
    };
  }
}

export const paymentService = new PaymentService();

