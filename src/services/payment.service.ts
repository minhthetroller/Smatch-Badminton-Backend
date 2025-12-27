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

    // Determine bookings to pay (single or group)
    let bookingsToPay: {
      id: string;
      subCourtId: string;
      date: Date;
      startTime: string;
      endTime: string;
      totalPrice: number;
      status: string;
      groupId: string | null;
    }[] = [];

    bookingsToPay.push({
      id: booking.id,
      subCourtId: booking.sub_court_id,
      date: booking.date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      totalPrice: booking.total_price,
      status: booking.status,
      groupId: booking.group_id,
    });

    if (booking.group_id) {
      const groupBookings = await availabilityRepository.getBookingsByGroupId(booking.group_id);
      if (groupBookings.length > 0) {
        bookingsToPay = groupBookings.map(b => ({
          id: b.id,
          subCourtId: b.sub_court_id,
          date: new Date(b.date),
          startTime: b.start_time,
          endTime: b.end_time,
          totalPrice: b.total_price,
          status: b.status,
          groupId: b.group_id,
        }));
      }
    }

    const totalAmount = bookingsToPay.reduce((sum, b) => sum + b.totalPrice, 0);

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

    // Acquire Redis locks for all slots
    const slotsToLock = bookingsToPay.map(b => ({
      subCourtId: b.subCourtId,
      date: b.date.toISOString().split('T')[0]!,
      startTime: b.startTime,
      endTime: b.endTime,
      bookingId: b.id
    }));

    const lockAcquired = await redisService.acquireSlotLocks(slotsToLock);

    if (!lockAcquired) {
      throw new ConflictError('One or more time slots are no longer available');
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
            amount: totalAmount,
          },
          tx
        );

        // Create ZaloPay order
        const description = bookingsToPay.length > 1 
          ? `Arc Badminton - ${bookingsToPay.length} bookings`
          : `Arc Badminton - ${booking.court_name} - ${booking.sub_court_name} - ${booking.date.toISOString().split('T')[0]}`;

        const zaloPayResponse = await zaloPayService.createOrder({
          bookingId: data.bookingId,
          appTransId,
          amount: totalAmount,
          guestName: booking.guest_name || 'Guest',
          guestPhone: booking.guest_phone || '',
          description,
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
      // Release Redis locks on failure
      await redisService.releaseSlotLocks(slotsToLock);

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
   * Verifies callback, updates payment status, confirms booking/match join, and notifies via WebSocket
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

    // Find payment by app_trans_id (with match player details)
    const payment = await paymentRepository.findByIdWithMatchPlayer(
      (await paymentRepository.findByAppTransId(callbackData.app_trans_id))?.id || ''
    ) || await paymentRepository.findByAppTransId(callbackData.app_trans_id);
    
    if (!payment) {
      console.error(`Payment not found for app_trans_id: ${callbackData.app_trans_id}`);
      return {
        return_code: 2,
        return_message: 'Payment not found',
      };
    }

    // Check if this is a match payment
    const isMatchPayment = !!(payment as any).matchPlayerId;

    // Update payment status based on callback type
    // type: 1 = payment success, 2 = payment refund
    if (callbackRequest.type === 1) {
      if (isMatchPayment) {
        // Handle match payment success
        await this.handleMatchPaymentSuccess(payment, callbackData);
      } else {
        // Handle booking payment success (original logic)
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
            where: { id: (payment as any).bookingId },
            data: {
              status: 'confirmed',
              updatedAt: new Date(),
            },
          });

          // Update other bookings in group if any
          const booking = await tx.booking.findUnique({ where: { id: (payment as any).bookingId } }) as any;
          if (booking?.groupId) {
             await tx.booking.updateMany({
               where: { groupId: booking.groupId } as any,
               data: { status: 'confirmed', updatedAt: new Date() }
             });
          }
        });

        // Release Redis lock (payment completed)
        const booking = (payment as any).booking as any;
        if (booking) {
          let bookingsToRelease: {
              id: string;
              subCourtId: string;
              date: Date;
              startTime: string;
              endTime: string;
          }[] = [];

          bookingsToRelease.push({
              id: booking.id,
              subCourtId: booking.subCourtId,
              date: booking.date,
              startTime: typeof booking.startTime === 'string' ? booking.startTime : booking.startTime.toISOString().slice(11, 16),
              endTime: typeof booking.endTime === 'string' ? booking.endTime : booking.endTime.toISOString().slice(11, 16),
          });

          if (booking.groupId) {
             const groupBookings = await availabilityRepository.getBookingsByGroupId(booking.groupId);
             if (groupBookings.length > 0) {
               bookingsToRelease = groupBookings.map(b => ({
                 id: b.id,
                 subCourtId: b.sub_court_id,
                 date: new Date(b.date),
                 startTime: b.start_time,
                 endTime: b.end_time,
               }));
             }
          }

          const slotsToRelease = bookingsToRelease.map(b => ({
            subCourtId: b.subCourtId,
            date: b.date.toISOString().split('T')[0]!,
            startTime: b.startTime,
            endTime: b.endTime,
            bookingId: b.id
          }));

          await redisService.releaseSlotLocks(slotsToRelease);
        }

        // Notify connected clients via WebSocket
        websocketService.notifyPaymentStatus({
          type: 'payment_status',
          paymentId: payment.id,
          status: 'success',
          bookingId: (payment as any).bookingId,
          zpTransId: String(callbackData.zp_trans_id),
          message: 'Payment successful! Your booking has been confirmed.',
        });
      }

      return {
        return_code: 1,
        return_message: 'Success',
      };
    }

    // Payment failed, refund, or unknown type (type 2 or others)
    if (isMatchPayment) {
      // Handle match payment failure
      await this.handleMatchPaymentFailure(payment, callbackData);
    } else {
      // Handle booking payment failure (original logic)
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            callbackData: callbackData as object,
            updatedAt: new Date(),
          },
        });

        await tx.booking.update({
          where: { id: (payment as any).bookingId },
          data: {
            status: 'failed',
            updatedAt: new Date(),
          },
        });

        // Update group bookings to failed
        const booking = await tx.booking.findUnique({ where: { id: (payment as any).bookingId } }) as any;
        if (booking?.groupId) {
           await tx.booking.updateMany({
             where: { groupId: booking.groupId } as any,
             data: { status: 'failed', updatedAt: new Date() }
           });
        }
      });

      // Release Redis lock
      const booking = (payment as any).booking as any;
      if (booking) {
        let bookingsToRelease: {
            id: string;
            subCourtId: string;
            date: Date;
            startTime: string;
            endTime: string;
        }[] = [];

        bookingsToRelease.push({
            id: booking.id,
            subCourtId: booking.subCourtId,
            date: booking.date,
            startTime: typeof booking.startTime === 'string' ? booking.startTime : booking.startTime.toISOString().slice(11, 16),
            endTime: typeof booking.endTime === 'string' ? booking.endTime : booking.endTime.toISOString().slice(11, 16),
        });

        if (booking.groupId) {
           const groupBookings = await availabilityRepository.getBookingsByGroupId(booking.groupId);
           if (groupBookings.length > 0) {
             bookingsToRelease = groupBookings.map(b => ({
               id: b.id,
               subCourtId: b.sub_court_id,
               date: new Date(b.date),
               startTime: b.start_time,
               endTime: b.end_time,
             }));
           }
        }

        const slotsToRelease = bookingsToRelease.map(b => ({
          subCourtId: b.subCourtId,
          date: b.date.toISOString().split('T')[0]!,
          startTime: b.startTime,
          endTime: b.endTime,
          bookingId: b.id
        }));

        await redisService.releaseSlotLocks(slotsToRelease);
      }

      websocketService.notifyPaymentStatus({
        type: 'payment_status',
        paymentId: payment.id,
        status: 'failed',
        bookingId: (payment as any).bookingId,
        message: 'Payment failed. Please try again.',
      });
    }

    return {
      return_code: 1,
      return_message: 'Processed',
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

        // Update payment and booking status (only for booking payments)
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: newStatus,
              zpTransId,
              updatedAt: new Date(),
            },
          });

          // Only update booking if this is a booking payment
          if (payment.bookingId) {
            await tx.booking.update({
              where: { id: payment.bookingId },
              data: {
                status: 'confirmed',
                updatedAt: new Date(),
              },
            });

            // Update group
            const booking = await tx.booking.findUnique({ where: { id: payment.bookingId } }) as any;
            if (booking?.groupId) {
               await tx.booking.updateMany({
                 where: { groupId: booking.groupId } as any,
                 data: { status: 'confirmed', updatedAt: new Date() }
               });
            }
          }
        });

        // Release Redis lock
        if (payment.booking) {
          const booking = payment.booking as any;
          let bookingsToRelease: {
              id: string;
              subCourtId: string;
              date: Date;
              startTime: string;
              endTime: string;
          }[] = [];

          bookingsToRelease.push({
              id: booking.id,
              subCourtId: booking.subCourtId,
              date: booking.date,
              startTime: typeof booking.startTime === 'string' ? booking.startTime : booking.startTime.toISOString().slice(11, 16),
              endTime: typeof booking.endTime === 'string' ? booking.endTime : booking.endTime.toISOString().slice(11, 16),
          });

          if (booking.groupId) {
             const groupBookings = await availabilityRepository.getBookingsByGroupId(booking.groupId);
             if (groupBookings.length > 0) {
               bookingsToRelease = groupBookings.map(b => ({
                 id: b.id,
                 subCourtId: b.sub_court_id,
                 date: new Date(b.date),
                 startTime: b.start_time,
                 endTime: b.end_time,
               }));
             }
          }

          const slotsToRelease = bookingsToRelease.map(b => ({
            subCourtId: b.subCourtId,
            date: b.date.toISOString().split('T')[0]!,
            startTime: b.startTime,
            endTime: b.endTime,
            bookingId: b.id
          }));

          await redisService.releaseSlotLocks(slotsToRelease);
        }
        break;

      case 2: // Failed
        newStatus = 'failed';
        
        // Update payment and booking status to failed
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: newStatus,
              updatedAt: new Date(),
            },
          });

          // Only update booking if this is a booking payment
          if (payment.bookingId) {
            await tx.booking.update({
              where: { id: payment.bookingId },
              data: {
                status: 'failed',
                updatedAt: new Date(),
              },
            });

            // Update group bookings to failed
            const booking = await tx.booking.findUnique({ where: { id: payment.bookingId } }) as any;
            if (booking?.groupId) {
               await tx.booking.updateMany({
                 where: { groupId: booking.groupId } as any,
                 data: { status: 'failed', updatedAt: new Date() }
               });
            }
          }
        });

        // Release Redis lock
        if (payment.booking) {
          const booking = payment.booking as any;
          let bookingsToRelease: {
              id: string;
              subCourtId: string;
              date: Date;
              startTime: string;
              endTime: string;
          }[] = [];

          bookingsToRelease.push({
              id: booking.id,
              subCourtId: booking.subCourtId,
              date: booking.date,
              startTime: typeof booking.startTime === 'string' ? booking.startTime : booking.startTime.toISOString().slice(11, 16),
              endTime: typeof booking.endTime === 'string' ? booking.endTime : booking.endTime.toISOString().slice(11, 16),
          });

          if (booking.groupId) {
             const groupBookings = await availabilityRepository.getBookingsByGroupId(booking.groupId);
             if (groupBookings.length > 0) {
               bookingsToRelease = groupBookings.map(b => ({
                 id: b.id,
                 subCourtId: b.sub_court_id,
                 date: new Date(b.date),
                 startTime: b.start_time,
                 endTime: b.end_time,
               }));
             }
          }

          const slotsToRelease = bookingsToRelease.map(b => ({
            subCourtId: b.subCourtId,
            date: b.date.toISOString().split('T')[0]!,
            startTime: b.startTime,
            endTime: b.endTime,
            bookingId: b.id
          }));

          await redisService.releaseSlotLocks(slotsToRelease);
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
   * Get payment by ID (for booking payments only)
   */
  async getPaymentById(paymentId: string): Promise<PaymentWithBooking> {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // This method is for booking payments only
    if (!payment.booking) {
      throw new NotFoundError('Payment is not associated with a booking');
    }

    return this.formatPaymentWithBooking(payment as typeof payment & { booking: NonNullable<typeof payment.booking> });
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
   * Cancel a pending payment (user-initiated cancellation)
   * This marks both the payment and booking as cancelled, and releases locks
   */
  async cancelPayment(paymentId: string): Promise<PaymentResponse> {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // Only pending payments can be cancelled
    if (payment.status !== 'pending') {
      throw new BadRequestError(`Cannot cancel payment with status: ${payment.status}`);
    }

    // This method is for booking payments only
    if (!payment.bookingId) {
      throw new BadRequestError('Cannot cancel a non-booking payment using this endpoint');
    }

    const bookingId = payment.bookingId;

    // Update payment and booking status to cancelled
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed', // Payment is marked as failed
          updatedAt: new Date(),
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'cancelled', // Booking is cancelled by user
          updatedAt: new Date(),
        },
      });

      // Cancel group bookings
      const booking = await tx.booking.findUnique({ where: { id: bookingId } }) as any;
      if (booking?.groupId) {
         await tx.booking.updateMany({
           where: { groupId: booking.groupId } as any,
           data: { status: 'cancelled', updatedAt: new Date() }
         });
      }
    });

    // Release Redis locks
    const booking = payment.booking as any;
    if (booking) {
      let bookingsToRelease: {
          id: string;
          subCourtId: string;
          date: Date;
          startTime: string;
          endTime: string;
      }[] = [];

      bookingsToRelease.push({
          id: booking.id,
          subCourtId: booking.subCourtId,
          date: booking.date,
          startTime: typeof booking.startTime === 'string' ? booking.startTime : booking.startTime.toISOString().slice(11, 16),
          endTime: typeof booking.endTime === 'string' ? booking.endTime : booking.endTime.toISOString().slice(11, 16),
      });

      if (booking.groupId) {
         const groupBookings = await availabilityRepository.getBookingsByGroupId(booking.groupId);
         if (groupBookings.length > 0) {
           bookingsToRelease = groupBookings.map(b => ({
             id: b.id,
             subCourtId: b.sub_court_id,
             date: new Date(b.date),
             startTime: b.start_time,
             endTime: b.end_time,
           }));
         }
      }

      const slotsToRelease = bookingsToRelease.map(b => ({
        subCourtId: b.subCourtId,
        date: b.date.toISOString().split('T')[0]!,
        startTime: b.startTime,
        endTime: b.endTime,
        bookingId: b.id
      }));

      await redisService.releaseSlotLocks(slotsToRelease);
    }

    // Notify via WebSocket
    websocketService.notifyPaymentStatus({
      type: 'payment_status',
      paymentId: payment.id,
      status: 'cancelled',
      bookingId: payment.bookingId,
      message: 'Payment cancelled',
    });

    // Fetch and return updated payment
    const updatedPayment = await paymentRepository.findById(paymentId);
    return this.formatPaymentResponse(updatedPayment!);
  }

  /**
   * Format payment response
   */
  private formatPaymentResponse(payment: {
    id: string;
    bookingId: string | null;
    matchPlayerId?: string | null;
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
      matchPlayerId: payment.matchPlayerId,
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
    bookingId: string | null;
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

  // ==================== MATCH JOIN PAYMENT METHODS ====================

  /**
   * Create a payment for joining a match (100% upfront fee)
   * Flow:
   * 1. Validate match exists and is open
   * 2. Validate user is not the host
   * 3. Check if user already has a pending/active join
   * 4. Create or get MatchPlayer with PENDING_PAYMENT status
   * 5. Create ZaloPay order using match price (100% upfront)
   * 6. Return payment details with QR code
   */
  async createMatchJoinPayment(matchId: string, userId: string): Promise<CreatePaymentResponse> {
    // Validate ZaloPay is configured
    if (!zaloPayService.isConfigured()) {
      throw new BadRequestError('Payment service is not configured');
    }

    // Import match repository dynamically to avoid circular dependency
    const { matchRepository } = await import('../repositories/match.repository.js');

    // Get match details
    const match = await matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match not found');
    }

    // Validate match is open for joining
    if (match.status !== 'OPEN') {
      throw new BadRequestError(`Cannot join a ${match.status.toLowerCase()} match`);
    }

    // Check if user is the host
    if (match.hostUserId === userId) {
      throw new BadRequestError('Host cannot pay to join their own match');
    }

    // Check if match is free (no payment needed)
    if (match.price === 0) {
      throw new BadRequestError('This match is free to join. Use the join endpoint directly.');
    }

    // Check if user already has an active participation
    let matchPlayer = await matchRepository.findPlayer(matchId, userId);
    
    if (matchPlayer) {
      if (matchPlayer.status === 'ACCEPTED') {
        throw new ConflictError('You are already a confirmed player in this match');
      }
      if (matchPlayer.status === 'REJECTED') {
        throw new ConflictError('Your request was rejected by the host');
      }
      if (matchPlayer.status === 'PENDING') {
        throw new ConflictError('You have a pending join request. Wait for host approval before paying.');
      }
      // If PENDING_PAYMENT, check for existing payment
      if (matchPlayer.status === 'PENDING_PAYMENT') {
        // Check for existing pending payment
        const existingPending = await paymentRepository.findLatestPendingByMatchPlayerId(matchPlayer.id);
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
            payment: this.formatMatchPaymentResponse(existingPending, matchId),
            orderUrl,
            qrCode,
            zpTransToken: (existingPending as { zpTransToken?: string }).zpTransToken ?? null,
            expireAt: expireAt.toISOString(),
            wsSubscribeUrl,
          };
        }
      }
    }

    // For private matches, require host approval first
    if (match.isPrivate && (!matchPlayer || matchPlayer.status !== 'PENDING_PAYMENT')) {
      throw new BadRequestError('This is a private match. Request to join first and wait for host approval.');
    }

    // Check if slots are available
    const acceptedCount = await matchRepository.countAcceptedPlayers(matchId);
    if (acceptedCount >= match.slotsNeeded) {
      throw new BadRequestError('Match is already full');
    }

    // Create MatchPlayer with PENDING_PAYMENT status if not exists
    if (!matchPlayer) {
      matchPlayer = await matchRepository.addPlayer(matchId, userId, undefined, 'PENDING_PAYMENT');
    } else if (matchPlayer.status !== 'PENDING_PAYMENT') {
      // Update existing player to PENDING_PAYMENT
      matchPlayer = await matchRepository.updatePlayerStatus(matchPlayer.id, 'PENDING_PAYMENT');
    }

    // Amount is the match price (100% upfront)
    const amount = match.price;

    // Check for existing successful payment
    const hasSuccessful = await paymentRepository.hasSuccessfulMatchPayment(matchPlayer.id);
    if (hasSuccessful) {
      throw new BadRequestError('You have already paid for this match');
    }

    // Generate app_trans_id for ZaloPay
    const appTransId = zaloPayService.generateAppTransId(matchPlayer.id);

    // Create payment record and ZaloPay order
    let payment;
    let zpTransToken: string | null = null;
    
    try {
      payment = await prisma.$transaction(async (tx) => {
        // Create payment record
        const newPayment = await paymentRepository.createMatchPayment(
          {
            matchPlayerId: matchPlayer!.id,
            appTransId,
            amount,
          },
          tx
        );

        // Build user name for description
        const userName = matchPlayer!.user 
          ? `${matchPlayer!.user.firstName || ''} ${matchPlayer!.user.lastName || ''}`.trim() || 'Player'
          : 'Player';

        // Create ZaloPay order
        const description = `Smatch - Join match: ${match.title || 'Badminton Match'} - ${userName}`;

        const zaloPayResponse = await zaloPayService.createOrder({
          bookingId: matchPlayer!.id, // Use matchPlayerId as reference
          appTransId,
          amount,
          guestName: userName,
          guestPhone: '', // Match players are registered users, phone optional
          description,
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
      payment: this.formatMatchPaymentResponse(payment, matchId),
      orderUrl,
      qrCode,
      zpTransToken,
      expireAt: expireAt.toISOString(),
      wsSubscribeUrl,
    };
  }

  /**
   * Query match join payment status
   */
  async queryMatchPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    const payment = await paymentRepository.findByIdWithMatchPlayer(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // If not a match payment, delegate to regular query
    if (!payment.matchPlayerId) {
      return this.queryPaymentStatus(paymentId);
    }

    // If payment is already in final state, return cached status
    if (payment.status === 'success' || payment.status === 'failed' || payment.status === 'expired') {
      return this.formatPaymentResponse(payment as any);
    }

    // Query ZaloPay for latest status
    const queryResult = await zaloPayService.queryOrder(payment.appTransId);

    let newStatus: PaymentStatus = payment.status as PaymentStatus;

    switch (queryResult.return_code) {
      case 1: // Success
        newStatus = 'success';
        
        // Update payment and match player status
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: newStatus,
              zpTransId: String(queryResult.zp_trans_id),
              updatedAt: new Date(),
            },
          });

          // Import match repository
          const { matchRepository } = await import('../repositories/match.repository.js');

          // Get next position and accept the player
          const position = await matchRepository.getNextPosition(payment.matchPlayerId!);
          
          await tx.matchPlayer.update({
            where: { id: payment.matchPlayerId! },
            data: {
              status: 'ACCEPTED',
              position,
              respondedAt: new Date(),
            },
          });
        });

        // Notify via WebSocket
        websocketService.notifyPaymentStatus({
          type: 'payment_status',
          paymentId: payment.id,
          status: 'success',
          bookingId: payment.matchPlayerId!, // Using matchPlayerId as reference
          zpTransId: String(queryResult.zp_trans_id),
          message: 'Payment successful! You have joined the match.',
        });
        break;

      case 2: // Failed
        newStatus = 'failed';
        
        // Update payment and match player status
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: newStatus,
              updatedAt: new Date(),
            },
          });

          await tx.matchPlayer.update({
            where: { id: payment.matchPlayerId! },
            data: {
              status: 'EXPIRED',
            },
          });
        });

        websocketService.notifyPaymentStatus({
          type: 'payment_status',
          paymentId: payment.id,
          status: 'failed',
          bookingId: payment.matchPlayerId!,
          message: 'Payment failed. Please try again.',
        });
        break;

      case 3: // Processing
        // Keep as pending, no update needed
        break;
    }

    // Fetch updated payment
    const updatedPayment = await paymentRepository.findByIdWithMatchPlayer(paymentId);
    return this.formatPaymentResponse(updatedPayment! as any);
  }

  /**
   * Format match payment response
   */
  private formatMatchPaymentResponse(payment: {
    id: string;
    matchPlayerId?: string | null;
    appTransId: string;
    zpTransId: string | null;
    amount: number;
    status: string;
    orderUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }, matchId: string): PaymentResponse {
    return {
      id: payment.id,
      bookingId: matchId, // Using matchId for client compatibility
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
   * Handle match payment success from callback
   */
  async handleMatchPaymentSuccess(payment: any, callbackData: any): Promise<void> {
    const { matchRepository } = await import('../repositories/match.repository.js');

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

      // Get next position for the player
      const position = await matchRepository.getNextPosition(payment.matchPlayerId);

      // Update match player status to ACCEPTED
      await tx.matchPlayer.update({
        where: { id: payment.matchPlayerId },
        data: {
          status: 'ACCEPTED',
          position,
          respondedAt: new Date(),
        },
      });
    });

    // Notify via WebSocket
    websocketService.notifyPaymentStatus({
      type: 'payment_status',
      paymentId: payment.id,
      status: 'success',
      bookingId: payment.matchPlayerId,
      zpTransId: String(callbackData.zp_trans_id),
      message: 'Payment successful! You have joined the match.',
    });
  }

  /**
   * Handle match payment failure from callback
   */
  async handleMatchPaymentFailure(payment: any, callbackData: any): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          callbackData: callbackData as object,
          updatedAt: new Date(),
        },
      });

      await tx.matchPlayer.update({
        where: { id: payment.matchPlayerId },
        data: {
          status: 'EXPIRED',
        },
      });
    });

    websocketService.notifyPaymentStatus({
      type: 'payment_status',
      paymentId: payment.id,
      status: 'failed',
      bookingId: payment.matchPlayerId,
      message: 'Payment failed. Please try again.',
    });
  }
}

export const paymentService = new PaymentService();

