/**
 * Test fixtures for Booking and Availability entities
 */

export const validSubCourtId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
export const validBookingId = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';
export const nonExistentBookingId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

export const sampleSubCourt = {
  id: validSubCourtId,
  court_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Sân 1',
  description: 'Sân cầu lông số 1',
  is_active: true,
  created_at: new Date('2025-11-25T12:00:00.000Z'),
  updated_at: new Date('2025-11-25T12:00:00.000Z'),
};

export const sampleSubCourtWithCourt = {
  ...sampleSubCourt,
  court_name: 'Sân cầu lông Ngọc Khánh',
};

export const sampleSubCourtsList = [
  sampleSubCourt,
  {
    ...sampleSubCourt,
    id: 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a45',
    name: 'Sân 2',
    description: 'Sân cầu lông số 2',
  },
];

export const samplePricingRules = [
  {
    id: 'p0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
    court_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Weekday Morning',
    day_type: 'weekday',
    start_time: '06:00',
    end_time: '17:00',
    price_per_hour: 70000,
    is_active: true,
  },
  {
    id: 'p1eebc99-9c0b-4ef8-bb6d-6bb9bd380a67',
    court_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Weekday Evening',
    day_type: 'weekday',
    start_time: '17:00',
    end_time: '22:00',
    price_per_hour: 100000,
    is_active: true,
  },
  {
    id: 'p2eebc99-9c0b-4ef8-bb6d-6bb9bd380a68',
    court_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Weekend',
    day_type: 'weekend',
    start_time: '07:00',
    end_time: '21:00',
    price_per_hour: 120000,
    is_active: true,
  },
];

export const sampleBooking = {
  id: validBookingId,
  sub_court_id: validSubCourtId,
  sub_court_name: 'Sân 1',
  court_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  court_name: 'Sân cầu lông Ngọc Khánh',
  user_id: null,
  guest_name: 'Nguyễn Văn A',
  guest_phone: '0901234567',
  guest_email: 'test@example.com',
  date: new Date('2025-12-15'),
  start_time: '10:00',
  end_time: '12:00',
  total_price: 140000,
  status: 'pending',
  notes: 'Test booking',
  created_at: new Date('2025-12-01T08:00:00.000Z'),
  updated_at: new Date('2025-12-01T08:00:00.000Z'),
};

export const createBookingDto = {
  subCourtId: validSubCourtId,
  guestName: 'Nguyễn Văn B',
  guestPhone: '0912345678',
  guestEmail: 'guest@example.com',
  date: '2025-12-15',
  startTime: '14:00',
  endTime: '16:00',
  notes: 'Test booking',
};

// Invalid booking fixtures
export const bookingWithInvalidDate = {
  ...createBookingDto,
  date: 'invalid-date',
};

export const bookingWithInvalidTime = {
  ...createBookingDto,
  startTime: '25:00',
  endTime: '26:00',
};

export const bookingWithEndBeforeStart = {
  ...createBookingDto,
  startTime: '16:00',
  endTime: '14:00',
};

export const bookingWithShortDuration = {
  ...createBookingDto,
  startTime: '10:00',
  endTime: '10:30', // Only 30 minutes, minimum is 1 hour
};

export const bookingWithInvalidIncrement = {
  ...createBookingDto,
  startTime: '10:00',
  endTime: '11:15', // Not a 30-minute increment
};

// Security test fixtures
export const bookingWithXSS = {
  ...createBookingDto,
  guestName: '<script>alert("xss")</script>',
  notes: '<img src="x" onerror="alert(1)">',
};

export const bookingWithSQLInjection = {
  ...createBookingDto,
  guestName: "'; DROP TABLE bookings; --",
  guestPhone: "0901234567' OR '1'='1",
};

// Availability test fixtures
export const validAvailabilityDate = '2025-12-15';
export const invalidDateFormat = '15-12-2025';
export const pastDate = '2020-01-01';

export const sampleClosure = {
  id: 'cl0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77',
  sub_court_id: validSubCourtId,
  date: new Date('2025-12-15'),
  start_time: '12:00',
  end_time: '14:00',
  reason: 'Maintenance',
};

export const fullDayClosure = {
  id: 'cl1eebc99-9c0b-4ef8-bb6d-6bb9bd380a78',
  sub_court_id: validSubCourtId,
  date: new Date('2025-12-20'),
  start_time: null,
  end_time: null,
  reason: 'Holiday closure',
};
