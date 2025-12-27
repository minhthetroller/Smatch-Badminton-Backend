import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { websocketService } from './websocket.service.js';

/**
 * Scheduler Service
 * Handles automated background tasks like marking bookings as completed
 */
export class SchedulerService {
  private completionInterval: NodeJS.Timeout | null = null;
  private expiredPendingInterval: NodeJS.Timeout | null = null;
  private expiredMatchPaymentsInterval: NodeJS.Timeout | null = null;
  private readonly COMPLETION_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly EXPIRED_PENDING_CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  private readonly EXPIRED_MATCH_PAYMENTS_CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

  /**
   * Start all scheduled tasks
   */
  start(): void {
    console.log('📅 Starting scheduler service...');
    this.startBookingCompletionChecker();
    this.startExpiredPendingChecker();
    this.startExpiredMatchPaymentsChecker();
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    console.log('📅 Stopping scheduler service...');
    if (this.completionInterval) {
      clearInterval(this.completionInterval);
      this.completionInterval = null;
    }
    if (this.expiredPendingInterval) {
      clearInterval(this.expiredPendingInterval);
      this.expiredPendingInterval = null;
    }
    if (this.expiredMatchPaymentsInterval) {
      clearInterval(this.expiredMatchPaymentsInterval);
      this.expiredMatchPaymentsInterval = null;
    }
  }

  /**
   * Start the booking completion checker
   * Runs every 5 minutes to mark past confirmed bookings as completed
   */
  private startBookingCompletionChecker(): void {
    // Run immediately on startup
    this.markCompletedBookings().catch(console.error);

    // Then run every 5 minutes
    this.completionInterval = setInterval(() => {
      this.markCompletedBookings().catch(console.error);
    }, this.COMPLETION_CHECK_INTERVAL_MS);

    console.log(`✅ Booking completion checker started (runs every ${this.COMPLETION_CHECK_INTERVAL_MS / 1000 / 60} minutes)`);
  }

  /**
   * Start the expired pending bookings checker
   * Runs every 2 minutes to mark old pending bookings as failed
   */
  private startExpiredPendingChecker(): void {
    // Run immediately on startup
    this.markExpiredPendingBookings().catch(console.error);

    // Then run every 2 minutes
    this.expiredPendingInterval = setInterval(() => {
      this.markExpiredPendingBookings().catch(console.error);
    }, this.EXPIRED_PENDING_CHECK_INTERVAL_MS);

    console.log(`✅ Expired pending checker started (runs every ${this.EXPIRED_PENDING_CHECK_INTERVAL_MS / 1000 / 60} minutes)`);
  }

  /**
   * Mark all confirmed bookings that have passed their end time as completed
   * 
   * Logic:
   * - Only confirmed bookings can be marked as completed
   * - Booking is considered past when: date + end_time < current timestamp
   * - Uses timezone-aware comparison (Vietnam time - UTC+7)
   */
  async markCompletedBookings(): Promise<number> {
    try {
      // Update confirmed bookings where the booking date + end_time has passed
      // Using Vietnam timezone (UTC+7) for accurate local time comparison
      const result = await prisma.$executeRaw`
        UPDATE bookings
        SET status = 'completed', updated_at = NOW()
        WHERE status = 'confirmed'
          AND (date + end_time) < (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
      `;

      if (result > 0) {
        console.log(`📋 Marked ${result} booking(s) as completed`);
      }

      return result;
    } catch (error) {
      console.error('Error marking bookings as completed:', error);
      return 0;
    }
  }

  /**
   * Mark expired pending bookings as cancelled and their payments as failed
   * This handles bookings that were created but never paid within the timeout period
   * (user abandoned the payment or payment service disconnected)
   * 
   * Logic:
   * - Only pending bookings older than the payment timeout are affected
   * - Uses the slot lock TTL from config (default 10 minutes) + 5 minutes buffer
   * - Booking status: 'cancelled' (user abandonment)
   * - Payment status: 'failed' (payment timeout)
   */
  async markExpiredPendingBookings(): Promise<number> {
    try {
      // Use slot lock TTL + 5 minutes buffer to allow for payment processing delays
      const timeoutSeconds = config.payment.slotLockTtlSeconds + 300; // 5 min buffer
      const cutoffTime = new Date(Date.now() - timeoutSeconds * 1000);
      
      // Update both bookings and their associated payments in a transaction
      await prisma.$transaction(async (tx) => {
        // First, mark expired pending payments as failed
        await tx.$executeRaw`
          UPDATE payments
          SET status = 'failed', updated_at = NOW()
          WHERE status = 'pending'
            AND created_at < ${cutoffTime}
        `;

        // Then, mark the corresponding bookings as cancelled
        await tx.$executeRaw`
          UPDATE bookings
          SET status = 'cancelled', updated_at = NOW()
          WHERE status = 'pending'
            AND created_at < ${cutoffTime}
        `;
      });

      // Count the updated bookings for logging
      const result = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM bookings
        WHERE status = 'cancelled'
          AND updated_at > NOW() - INTERVAL '5 seconds'
      `;

      const count = result[0] ? Number(result[0].count) : 0;
      
      if (count > 0) {
        console.log(`⏰ Marked ${count} expired pending booking(s) as cancelled and their payments as failed`);
      }

      return count;
    } catch (error) {
      console.error('Error marking expired pending bookings:', error);
      return 0;
    }
  }

  /**
   * Start the expired match payments checker
   * Runs every 2 minutes to expire pending match join payments
   */
  private startExpiredMatchPaymentsChecker(): void {
    // Run immediately on startup
    this.markExpiredMatchPayments().catch(console.error);

    // Then run every 2 minutes
    this.expiredMatchPaymentsInterval = setInterval(() => {
      this.markExpiredMatchPayments().catch(console.error);
    }, this.EXPIRED_MATCH_PAYMENTS_CHECK_INTERVAL_MS);

    console.log(`✅ Expired match payments checker started (runs every ${this.EXPIRED_MATCH_PAYMENTS_CHECK_INTERVAL_MS / 1000 / 60} minutes)`);
  }

  /**
   * Mark expired pending match join payments as failed
   * This handles match players who started payment but never completed
   * 
   * Logic:
   * - Only PENDING_PAYMENT match players with pending payments older than timeout
   * - Uses the slot lock TTL from config (default 10 minutes) + 5 minutes buffer
   * - Payment status: 'expired'
   * - MatchPlayer status: 'EXPIRED'
   */
  async markExpiredMatchPayments(): Promise<number> {
    try {
      // Use slot lock TTL + 5 minutes buffer
      const timeoutSeconds = config.payment.slotLockTtlSeconds + 300; // 5 min buffer
      const cutoffTime = new Date(Date.now() - timeoutSeconds * 1000);
      
      // Find expired pending match payments
      const expiredPayments = await prisma.payment.findMany({
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
            },
          },
        },
      });

      if (expiredPayments.length === 0) {
        return 0;
      }

      // Update payments and match players in a transaction
      await prisma.$transaction(async (tx) => {
        for (const payment of expiredPayments) {
          // Mark payment as expired
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'expired',
              updatedAt: new Date(),
            },
          });

          // Mark match player as expired if exists
          if (payment.matchPlayerId) {
            await tx.matchPlayer.update({
              where: { id: payment.matchPlayerId },
              data: {
                status: 'EXPIRED',
              },
            });

            // Notify via WebSocket
            websocketService.notifyPaymentStatus({
              type: 'payment_status',
              paymentId: payment.id,
              status: 'expired',
              bookingId: payment.matchPlayerId,
              message: 'Payment expired. Please try again if you still want to join.',
            });
          }
        }
      });

      console.log(`⏰ Marked ${expiredPayments.length} expired match payment(s) as expired`);
      return expiredPayments.length;
    } catch (error) {
      console.error('Error marking expired match payments:', error);
      return 0;
    }
  }
}

export const schedulerService = new SchedulerService();
