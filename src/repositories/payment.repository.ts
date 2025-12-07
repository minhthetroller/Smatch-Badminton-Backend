import { prisma } from '../config/database.js';
import type { PaymentStatus } from '../types/index.js';
import type { Prisma } from '@prisma/client';

export class PaymentRepository {
  /**
   * Create a new payment record
   */
  async create(
    data: {
      bookingId: string;
      appTransId: string;
      amount: number;
      orderUrl?: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.payment.create({
      data: {
        bookingId: data.bookingId,
        appTransId: data.appTransId,
        amount: data.amount,
        orderUrl: data.orderUrl,
        status: 'pending',
      },
    });
  }

  /**
   * Find payment by ID
   */
  async findById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            subCourt: {
              include: {
                court: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find payment by app_trans_id
   */
  async findByAppTransId(appTransId: string) {
    return prisma.payment.findUnique({
      where: { appTransId },
      include: {
        booking: {
          include: {
            subCourt: {
              include: {
                court: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find payments by booking ID
   */
  async findByBookingId(bookingId: string) {
    return prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update payment status
   */
  async updateStatus(
    id: string,
    status: PaymentStatus,
    zpTransId?: string,
    callbackData?: object
  ) {
    return prisma.payment.update({
      where: { id },
      data: {
        status,
        zpTransId,
        callbackData: callbackData ? JSON.parse(JSON.stringify(callbackData)) : undefined,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update payment by app_trans_id (for callback handling)
   */
  async updateByAppTransId(
    appTransId: string,
    data: {
      status: PaymentStatus;
      zpTransId?: string;
      callbackData?: object;
    }
  ) {
    return prisma.payment.update({
      where: { appTransId },
      data: {
        status: data.status,
        zpTransId: data.zpTransId,
        callbackData: data.callbackData
          ? JSON.parse(JSON.stringify(data.callbackData))
          : undefined,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get pending payments older than specified minutes (for expiration)
   */
  async findExpiredPendingPayments(minutesOld: number) {
    const cutoffTime = new Date(Date.now() - minutesOld * 60 * 1000);
    return prisma.payment.findMany({
      where: {
        status: 'pending',
        createdAt: {
          lt: cutoffTime,
        },
      },
      include: {
        booking: true,
      },
    });
  }

  /**
   * Batch update expired payments
   */
  async markPaymentsAsExpired(paymentIds: string[]) {
    return prisma.payment.updateMany({
      where: {
        id: { in: paymentIds },
      },
      data: {
        status: 'expired',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get latest pending payment for a booking
   */
  async findLatestPendingByBookingId(bookingId: string) {
    return prisma.payment.findFirst({
      where: {
        bookingId,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Check if booking has any successful payment
   */
  async hasSuccessfulPayment(bookingId: string): Promise<boolean> {
    const count = await prisma.payment.count({
      where: {
        bookingId,
        status: 'success',
      },
    });
    return count > 0;
  }
}

export const paymentRepository = new PaymentRepository();

