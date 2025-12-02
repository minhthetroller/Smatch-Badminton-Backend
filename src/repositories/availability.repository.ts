import { prisma } from '../config/database.js';
import type {
  RawSubCourt,
  RawBooking,
  RawPricingRule,
  RawClosure,
  CreateBookingDto,
} from '../types/index.js';

export class AvailabilityRepository {
  /**
   * Get all active sub-courts for a court
   */
  async getSubCourtsByCourtId(courtId: string): Promise<RawSubCourt[]> {
    return prisma.$queryRaw<RawSubCourt[]>`
      SELECT id, court_id, name, description, is_active
      FROM sub_courts
      WHERE court_id = ${courtId}::uuid AND is_active = true
      ORDER BY name
    `;
  }

  /**
   * Get all bookings for a court's sub-courts on a specific date
   * Only returns non-cancelled bookings
   */
  async getBookingsByCourtAndDate(courtId: string, date: string): Promise<RawBooking[]> {
    return prisma.$queryRaw<RawBooking[]>`
      SELECT b.id, b.sub_court_id, b.date, 
             TO_CHAR(b.start_time, 'HH24:MI') as start_time,
             TO_CHAR(b.end_time, 'HH24:MI') as end_time,
             b.status
      FROM bookings b
      JOIN sub_courts sc ON b.sub_court_id = sc.id
      WHERE sc.court_id = ${courtId}::uuid 
        AND b.date = ${date}::date
        AND b.status != 'cancelled'
      ORDER BY b.start_time
    `;
  }

  /**
   * Get active pricing rules for a court
   */
  async getPricingRulesByCourtId(courtId: string): Promise<RawPricingRule[]> {
    return prisma.$queryRaw<RawPricingRule[]>`
      SELECT id, court_id, name, day_type,
             TO_CHAR(start_time, 'HH24:MI') as start_time,
             TO_CHAR(end_time, 'HH24:MI') as end_time,
             price_per_hour, is_active
      FROM pricing_rules
      WHERE court_id = ${courtId}::uuid AND is_active = true
      ORDER BY start_time
    `;
  }

  /**
   * Get closures for sub-courts on a specific date
   */
  async getClosuresByCourtAndDate(courtId: string, date: string): Promise<RawClosure[]> {
    return prisma.$queryRaw<RawClosure[]>`
      SELECT c.id, c.sub_court_id, c.date,
             TO_CHAR(c.start_time, 'HH24:MI') as start_time,
             TO_CHAR(c.end_time, 'HH24:MI') as end_time,
             c.reason
      FROM sub_court_closures c
      JOIN sub_courts sc ON c.sub_court_id = sc.id
      WHERE sc.court_id = ${courtId}::uuid AND c.date = ${date}::date
    `;
  }

  /**
   * Get holiday multiplier for a date
   * Returns the multiplier if the date is a holiday, otherwise returns 1.0
   */
  async getHolidayMultiplier(date: string): Promise<number> {
    const result = await prisma.$queryRaw<{ multiplier: number }[]>`
      SELECT multiplier FROM holidays WHERE date = ${date}::date
    `;
    return result[0]?.multiplier ?? 1.0;
  }

  /**
   * Check if a date is a holiday
   */
  async isHoliday(date: string): Promise<boolean> {
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM holidays WHERE date = ${date}::date
    `;
    return result[0] ? Number(result[0].count) > 0 : false;
  }

  /**
   * Get sub-court by ID with court info
   */
  async getSubCourtWithCourt(subCourtId: string): Promise<{
    id: string;
    name: string;
    court_id: string;
    court_name: string;
    is_active: boolean;
  } | null> {
    const results = await prisma.$queryRaw<{
      id: string;
      name: string;
      court_id: string;
      court_name: string;
      is_active: boolean;
    }[]>`
      SELECT sc.id, sc.name, sc.court_id, c.name as court_name, sc.is_active
      FROM sub_courts sc
      JOIN courts c ON sc.court_id = c.id
      WHERE sc.id = ${subCourtId}::uuid
    `;
    return results[0] ?? null;
  }

  /**
   * Check for overlapping bookings
   */
  async hasOverlappingBooking(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeBookingId?: string
  ): Promise<boolean> {
    const excludeClause = excludeBookingId 
      ? prisma.$queryRaw`AND id != ${excludeBookingId}::uuid`
      : prisma.$queryRaw``;
    
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE sub_court_id = ${subCourtId}::uuid
        AND date = ${date}::date
        AND status != 'cancelled'
        AND (
          (start_time < ${endTime}::time AND end_time > ${startTime}::time)
        )
        ${excludeClause}
    `;
    return result[0] ? Number(result[0].count) > 0 : false;
  }

  /**
   * Create a new booking
   */
  async createBooking(data: CreateBookingDto, totalPrice: number): Promise<{ id: string }> {
    const result = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO bookings (
        sub_court_id, guest_name, guest_phone, guest_email,
        date, start_time, end_time, total_price, status, notes
      ) VALUES (
        ${data.subCourtId}::uuid,
        ${data.guestName},
        ${data.guestPhone},
        ${data.guestEmail ?? null},
        ${data.date}::date,
        ${data.startTime}::time,
        ${data.endTime}::time,
        ${totalPrice},
        'pending',
        ${data.notes ?? null}
      )
      RETURNING id
    `;
    if (!result[0]) {
      throw new Error('Failed to create booking');
    }
    return result[0];
  }

  /**
   * Get booking by ID with full details
   */
  async getBookingById(bookingId: string): Promise<{
    id: string;
    sub_court_id: string;
    sub_court_name: string;
    court_id: string;
    court_name: string;
    guest_name: string;
    guest_phone: string;
    guest_email: string | null;
    date: Date;
    start_time: string;
    end_time: string;
    total_price: number;
    status: string;
    notes: string | null;
    created_at: Date;
  } | null> {
    const results = await prisma.$queryRaw<{
      id: string;
      sub_court_id: string;
      sub_court_name: string;
      court_id: string;
      court_name: string;
      guest_name: string;
      guest_phone: string;
      guest_email: string | null;
      date: Date;
      start_time: string;
      end_time: string;
      total_price: number;
      status: string;
      notes: string | null;
      created_at: Date;
    }[]>`
      SELECT b.id, b.sub_court_id, sc.name as sub_court_name,
             sc.court_id, c.name as court_name,
             b.guest_name, b.guest_phone, b.guest_email,
             b.date, 
             TO_CHAR(b.start_time, 'HH24:MI') as start_time,
             TO_CHAR(b.end_time, 'HH24:MI') as end_time,
             b.total_price, b.status, b.notes, b.created_at
      FROM bookings b
      JOIN sub_courts sc ON b.sub_court_id = sc.id
      JOIN courts c ON sc.court_id = c.id
      WHERE b.id = ${bookingId}::uuid
    `;
    return results[0] ?? null;
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(bookingId: string, status: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE bookings 
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${bookingId}::uuid
    `;
  }

  /**
   * Get bookings by phone number
   */
  async getBookingsByPhone(phone: string): Promise<{
    id: string;
    sub_court_name: string;
    court_name: string;
    date: Date;
    start_time: string;
    end_time: string;
    total_price: number;
    status: string;
  }[]> {
    return prisma.$queryRaw`
      SELECT b.id, sc.name as sub_court_name, c.name as court_name,
             b.date,
             TO_CHAR(b.start_time, 'HH24:MI') as start_time,
             TO_CHAR(b.end_time, 'HH24:MI') as end_time,
             b.total_price, b.status
      FROM bookings b
      JOIN sub_courts sc ON b.sub_court_id = sc.id
      JOIN courts c ON sc.court_id = c.id
      WHERE b.guest_phone = ${phone}
      ORDER BY b.date DESC, b.start_time DESC
    `;
  }
}

export const availabilityRepository = new AvailabilityRepository();

