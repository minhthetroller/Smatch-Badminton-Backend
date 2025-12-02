import { availabilityRepository, courtRepository } from '../repositories/index.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import type {
  CourtAvailabilityResponse,
  SubCourtAvailability,
  TimeSlot,
  RawBooking,
  RawPricingRule,
  RawClosure,
  CreateBookingDto,
  BookingResponse,
  OpeningHours,
} from '../types/index.js';

// Day name mapping for opening hours
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export class AvailabilityService {
  /**
   * Get availability for a court on a specific date
   */
  async getCourtAvailability(courtId: string, date: string): Promise<CourtAvailabilityResponse> {
    // Validate date format
    if (!this.isValidDateFormat(date)) {
      throw new BadRequestError('Invalid date format. Use YYYY-MM-DD');
    }

    // Get court info
    const court = await courtRepository.findById(courtId);
    if (!court) {
      throw new NotFoundError('Court not found');
    }

    // Parse opening hours for the specific day
    const dateObj = new Date(date);
    const dayOfWeek = DAY_NAMES[dateObj.getDay()];
    const openingHours = court.openingHours as OpeningHours;
    const dayHours = openingHours[dayOfWeek];

    if (!dayHours) {
      throw new BadRequestError(`Court is closed on ${dayOfWeek}`);
    }

    const [openingTime, closingTime] = dayHours.split('-');

    // Determine day type (holiday, weekend, or weekday)
    const isHoliday = await availabilityRepository.isHoliday(date);
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const dayType: 'holiday' | 'weekend' | 'weekday' = isHoliday 
      ? 'holiday' 
      : isWeekend 
        ? 'weekend' 
        : 'weekday';

    // Fetch all required data in parallel
    const [subCourts, bookings, pricingRules, closures] = await Promise.all([
      availabilityRepository.getSubCourtsByCourtId(courtId),
      availabilityRepository.getBookingsByCourtAndDate(courtId, date),
      availabilityRepository.getPricingRulesByCourtId(courtId),
      availabilityRepository.getClosuresByCourtAndDate(courtId, date),
    ]);

    // Group bookings and closures by sub-court
    const bookingsBySubCourt = this.groupBySubCourt(bookings);
    const closuresBySubCourt = this.groupClosuresBySubCourt(closures);

    // Generate availability for each sub-court
    const subCourtAvailability: SubCourtAvailability[] = subCourts.map(subCourt => {
      const subCourtBookings = bookingsBySubCourt.get(subCourt.id) ?? [];
      const subCourtClosures = closuresBySubCourt.get(subCourt.id) ?? [];

      const slots = this.generateTimeSlots(
        openingTime,
        closingTime,
        subCourtBookings,
        subCourtClosures,
        pricingRules,
        dayType
      );

      return {
        id: subCourt.id,
        name: subCourt.name,
        description: subCourt.description,
        isActive: subCourt.is_active,
        slots,
      };
    });

    return {
      courtId: court.id,
      courtName: court.name,
      date,
      dayType,
      openingTime,
      closingTime,
      subCourts: subCourtAvailability,
    };
  }

  /**
   * Create a new booking
   */
  async createBooking(data: CreateBookingDto): Promise<BookingResponse> {
    // Validate date and time formats
    if (!this.isValidDateFormat(data.date)) {
      throw new BadRequestError('Invalid date format. Use YYYY-MM-DD');
    }
    if (!this.isValidTimeFormat(data.startTime) || !this.isValidTimeFormat(data.endTime)) {
      throw new BadRequestError('Invalid time format. Use HH:mm');
    }

    // Validate time range
    if (data.startTime >= data.endTime) {
      throw new BadRequestError('Start time must be before end time');
    }

    // Validate minimum booking duration (1 hour)
    const durationMinutes = this.getMinutesBetween(data.startTime, data.endTime);
    if (durationMinutes < 60) {
      throw new BadRequestError('Minimum booking duration is 1 hour');
    }

    // Validate 30-minute increment
    if (durationMinutes % 30 !== 0) {
      throw new BadRequestError('Booking duration must be in 30-minute increments');
    }

    // Get sub-court with court info
    const subCourt = await availabilityRepository.getSubCourtWithCourt(data.subCourtId);
    if (!subCourt) {
      throw new NotFoundError('Sub-court not found');
    }
    if (!subCourt.is_active) {
      throw new BadRequestError('Sub-court is not active');
    }

    // Check for overlapping bookings
    const hasOverlap = await availabilityRepository.hasOverlappingBooking(
      data.subCourtId,
      data.date,
      data.startTime,
      data.endTime
    );
    if (hasOverlap) {
      throw new ConflictError('Time slot is already booked');
    }

    // Calculate total price
    const dateObj = new Date(data.date);
    const isHoliday = await availabilityRepository.isHoliday(data.date);
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const dayType: 'holiday' | 'weekend' | 'weekday' = isHoliday 
      ? 'holiday' 
      : isWeekend 
        ? 'weekend' 
        : 'weekday';

    const pricingRules = await availabilityRepository.getPricingRulesByCourtId(subCourt.court_id);
    const totalPrice = this.calculateTotalPrice(
      data.startTime,
      data.endTime,
      pricingRules,
      dayType
    );

    // Create booking
    const result = await availabilityRepository.createBooking(data, totalPrice);

    // Get full booking details
    const booking = await availabilityRepository.getBookingById(result.id);
    if (!booking) {
      throw new Error('Failed to retrieve created booking');
    }

    return this.formatBookingResponse(booking);
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: string): Promise<BookingResponse> {
    const booking = await availabilityRepository.getBookingById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    return this.formatBookingResponse(booking);
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string): Promise<BookingResponse> {
    const booking = await availabilityRepository.getBookingById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.status === 'cancelled') {
      throw new BadRequestError('Booking is already cancelled');
    }

    if (booking.status === 'completed') {
      throw new BadRequestError('Cannot cancel a completed booking');
    }

    await availabilityRepository.updateBookingStatus(bookingId, 'cancelled');
    
    const updatedBooking = await availabilityRepository.getBookingById(bookingId);
    return this.formatBookingResponse(updatedBooking!);
  }

  /**
   * Get bookings by phone number
   */
  async getBookingsByPhone(phone: string): Promise<BookingResponse[]> {
    const bookings = await availabilityRepository.getBookingsByPhone(phone);
    return bookings.map(b => ({
      id: b.id,
      subCourtId: '',
      subCourtName: b.sub_court_name,
      courtId: '',
      courtName: b.court_name,
      guestName: '',
      guestPhone: phone,
      guestEmail: null,
      date: b.date.toISOString().split('T')[0],
      startTime: b.start_time,
      endTime: b.end_time,
      totalPrice: b.total_price,
      status: b.status as BookingResponse['status'],
      notes: null,
      createdAt: '',
    }));
  }

  // ==================== Private Helper Methods ====================

  /**
   * Generate time slots for a sub-court
   */
  private generateTimeSlots(
    openingTime: string,
    closingTime: string,
    bookings: RawBooking[],
    closures: RawClosure[],
    pricingRules: RawPricingRule[],
    dayType: 'weekday' | 'weekend' | 'holiday'
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let currentTime = openingTime;

    // Generate 30-minute slots
    while (currentTime < closingTime) {
      const nextTime = this.addMinutes(currentTime, 30);
      
      // Check if slot is booked
      const isBooked = bookings.some(booking => 
        this.isTimeOverlapping(currentTime, nextTime, booking.start_time, booking.end_time)
      );

      // Check if slot is in a closure period
      const isClosed = closures.some(closure => {
        if (!closure.start_time || !closure.end_time) {
          // Full day closure
          return true;
        }
        return this.isTimeOverlapping(currentTime, nextTime, closure.start_time, closure.end_time);
      });

      // Get price for this time slot
      const price = this.getPriceForSlot(currentTime, pricingRules, dayType);

      slots.push({
        startTime: currentTime,
        endTime: nextTime,
        isAvailable: !isBooked && !isClosed,
        price,
      });

      currentTime = nextTime;
    }

    return slots;
  }

  /**
   * Get price for a specific time slot
   */
  private getPriceForSlot(
    time: string,
    pricingRules: RawPricingRule[],
    dayType: 'weekday' | 'weekend' | 'holiday'
  ): number {
    // Find matching pricing rule for the day type and time
    const rule = pricingRules.find(r => 
      r.day_type === dayType && 
      r.is_active &&
      time >= r.start_time && 
      time < r.end_time
    );

    // Return hourly rate divided by 2 for 30-minute slot
    return rule ? Math.round(rule.price_per_hour / 2) : 0;
  }

  /**
   * Calculate total price for a booking
   */
  private calculateTotalPrice(
    startTime: string,
    endTime: string,
    pricingRules: RawPricingRule[],
    dayType: 'weekday' | 'weekend' | 'holiday'
  ): number {
    let total = 0;
    let currentTime = startTime;

    while (currentTime < endTime) {
      const price = this.getPriceForSlot(currentTime, pricingRules, dayType);
      total += price;
      currentTime = this.addMinutes(currentTime, 30);
    }

    return total;
  }

  /**
   * Group bookings by sub-court ID
   */
  private groupBySubCourt(bookings: RawBooking[]): Map<string, RawBooking[]> {
    const map = new Map<string, RawBooking[]>();
    for (const booking of bookings) {
      const list = map.get(booking.sub_court_id) ?? [];
      list.push(booking);
      map.set(booking.sub_court_id, list);
    }
    return map;
  }

  /**
   * Group closures by sub-court ID
   */
  private groupClosuresBySubCourt(closures: RawClosure[]): Map<string, RawClosure[]> {
    const map = new Map<string, RawClosure[]>();
    for (const closure of closures) {
      const list = map.get(closure.sub_court_id) ?? [];
      list.push(closure);
      map.set(closure.sub_court_id, list);
    }
    return map;
  }

  /**
   * Check if two time ranges overlap
   */
  private isTimeOverlapping(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    return start1 < end2 && end1 > start2;
  }

  /**
   * Add minutes to a time string
   */
  private addMinutes(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
  }

  /**
   * Get minutes between two times
   */
  private getMinutesBetween(start: string, end: string): number {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  private isValidDateFormat(date: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  }

  /**
   * Validate time format (HH:mm)
   */
  private isValidTimeFormat(time: string): boolean {
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return regex.test(time);
  }

  /**
   * Format booking response
   */
  private formatBookingResponse(booking: {
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
  }): BookingResponse {
    return {
      id: booking.id,
      subCourtId: booking.sub_court_id,
      subCourtName: booking.sub_court_name,
      courtId: booking.court_id,
      courtName: booking.court_name,
      guestName: booking.guest_name,
      guestPhone: booking.guest_phone,
      guestEmail: booking.guest_email,
      date: booking.date.toISOString().split('T')[0],
      startTime: booking.start_time,
      endTime: booking.end_time,
      totalPrice: booking.total_price,
      status: booking.status as BookingResponse['status'],
      notes: booking.notes,
      createdAt: booking.created_at.toISOString(),
    };
  }
}

export const availabilityService = new AvailabilityService();

