// Time slot for availability
export interface TimeSlot {
  startTime: string; // "HH:mm" format
  endTime: string;   // "HH:mm" format
  isAvailable: boolean;
  price: number;     // Price in VND for this slot
}

// Sub-court with availability
export interface SubCourtAvailability {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  slots: TimeSlot[];
}

// Full availability response for a court on a specific date
export interface CourtAvailabilityResponse {
  courtId: string;
  courtName: string;
  date: string;           // "YYYY-MM-DD" format
  dayType: 'weekday' | 'weekend' | 'holiday';
  openingTime: string;    // "HH:mm"
  closingTime: string;    // "HH:mm"
  subCourts: SubCourtAvailability[];
}

// Query params for availability
export interface AvailabilityQueryParams {
  date: string; // "YYYY-MM-DD" format
}

// Booking status
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

// Create booking DTO
export interface CreateBookingDto {
  subCourtId: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  userId?: string;
  date: string;      // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  notes?: string;
}

// Booking response
export interface BookingResponse {
  id: string;
  subCourtId: string;
  subCourtName: string;
  courtId: string;
  courtName: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: BookingStatus;
  notes: string | null;
  createdAt: string;
}

// Pricing rule
export interface PricingRule {
  id: string;
  name: string;
  dayType: 'weekday' | 'weekend' | 'holiday';
  startTime: string;
  endTime: string;
  pricePerHour: number;
}

// Sub-court closure
export interface SubCourtClosure {
  id: string;
  subCourtId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

// Raw booking from database
export interface RawBooking {
  id: string;
  sub_court_id: string;
  date: Date;
  start_time: string;
  end_time: string;
  status: string;
}

// Raw sub-court from database
export interface RawSubCourt {
  id: string;
  court_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

// Raw pricing rule from database
export interface RawPricingRule {
  id: string;
  court_id: string;
  name: string;
  day_type: string;
  start_time: string;
  end_time: string;
  price_per_hour: number;
  is_active: boolean;
}

// Raw closure from database
export interface RawClosure {
  id: string;
  sub_court_id: string;
  date: Date;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

