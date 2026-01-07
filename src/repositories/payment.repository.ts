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

  // ==================== MATCH PAYMENT METHODS ====================

  /**
   * Create a payment for match join
   */
  async createMatchPayment(
    data: {
      matchPlayerId: string;
      appTransId: string;
      amount: number;
      orderUrl?: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.payment.create({
      data: {
        matchPlayerId: data.matchPlayerId,
        paymentType: 'MATCH_JOIN',
        appTransId: data.appTransId,
        amount: data.amount,
        orderUrl: data.orderUrl,
        status: 'pending',
      },
    });
  }

  /**
   * Find payment by match player ID
   */
  async findByMatchPlayerId(matchPlayerId: string) {
    return prisma.payment.findMany({
      where: { matchPlayerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find latest pending payment for a match player
   */
  async findLatestPendingByMatchPlayerId(matchPlayerId: string) {
    return prisma.payment.findFirst({
      where: {
        matchPlayerId,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Check if match player has any successful payment
   */
  async hasSuccessfulMatchPayment(matchPlayerId: string): Promise<boolean> {
    const count = await prisma.payment.count({
      where: {
        matchPlayerId,
        status: 'success',
      },
    });
    return count > 0;
  }

  /**
   * Find pending match join payments for expiration
   */
  async findExpiredPendingMatchPayments(minutesOld: number) {
    const cutoffTime = new Date(Date.now() - minutesOld * 60 * 1000);
    return prisma.payment.findMany({
      where: {
        paymentType: 'MATCH_JOIN',
        status: 'pending',
        createdAt: {
          lt: cutoffTime,
        },
      },
      include: {
        matchPlayer: {
          include: {
            match: true,
            user: true,
          },
        },
      },
    });
  }

  /**
   * Find payment by ID with match player details
   */
  async findByIdWithMatchPlayer(id: string) {
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
        matchPlayer: {
          include: {
            match: {
              include: {
                court: true,
                host: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                  },
                },
              },
            },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        },
      },
    });
  }
}

export const paymentRepository = new PaymentRepository();

