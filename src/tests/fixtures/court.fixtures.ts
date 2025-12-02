/**
 * Test fixtures for Court entity
 */

export const validCourtId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
export const nonExistentCourtId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
export const invalidUUID = 'not-a-valid-uuid';

export const sampleCourt = {
  id: validCourtId,
  name: 'Sân cầu lông Ngọc Khánh',
  description: 'Sân cầu lông chất lượng cao',
  phoneNumbers: ['0901234567', '0912345678'],
  addressStreet: 'Số 6 Nguyễn Công Hoan',
  addressWard: 'Phường Ngọc Khánh',
  addressDistrict: 'Quận Ba Đình',
  addressCity: 'Hà Nội',
  details: {
    amenities: ['Parking', 'Shower', 'WiFi'],
    payments: ['Cash', 'Card', 'MoMo'],
    serviceOptions: ['Racket Rental'],
    highlights: ['Air Conditioned'],
  },
  openingHours: {
    mon: '06:00-22:00',
    tue: '06:00-22:00',
    wed: '06:00-22:00',
    thu: '06:00-22:00',
    fri: '06:00-22:00',
    sat: '07:00-21:00',
    sun: '07:00-21:00',
  },
  createdAt: new Date('2025-11-25T12:00:00.000Z'),
  updatedAt: new Date('2025-11-25T12:00:00.000Z'),
};

export const sampleCourtsList = [
  sampleCourt,
  {
    ...sampleCourt,
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    name: 'Sân cầu lông Hoàng Hoa Thám',
    addressDistrict: 'Quận Tây Hồ',
  },
  {
    ...sampleCourt,
    id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    name: 'Sân cầu lông Cầu Giấy',
    addressDistrict: 'Quận Cầu Giấy',
  },
];

export const createCourtDto = {
  name: 'Sân cầu lông ABC',
  description: 'Mô tả sân',
  phoneNumbers: ['0901234567'],
  addressStreet: '123 Đường ABC',
  addressWard: 'Phường XYZ',
  addressDistrict: 'Quận Hoàn Kiếm',
  addressCity: 'Hà Nội',
  details: {
    amenities: ['Parking'],
    payments: ['Cash'],
  },
  openingHours: {
    mon: '06:00-22:00',
    tue: '06:00-22:00',
    wed: '06:00-22:00',
    thu: '06:00-22:00',
    fri: '06:00-22:00',
    sat: '07:00-21:00',
    sun: '07:00-21:00',
  },
  location: {
    latitude: 21.0285,
    longitude: 105.8542,
  },
};

export const updateCourtDto = {
  name: 'Updated Court Name',
  description: 'Updated description',
};

// Invalid/edge case fixtures
export const invalidCreateCourtDto = {
  // Missing required 'name' field
  description: 'Description without name',
};

export const courtWithXSS = {
  name: '<script>alert("xss")</script>',
  description: '<img src="x" onerror="alert(1)">',
  phoneNumbers: ['<script>alert(1)</script>'],
  addressStreet: 'javascript:alert(1)',
};

export const courtWithSQLInjection = {
  name: "'; DROP TABLE courts; --",
  description: "1' OR '1'='1",
  addressDistrict: "'; SELECT * FROM users; --",
};

// Location fixtures for nearby search
export const hanoiLocation = {
  latitude: 21.0285,
  longitude: 105.8542,
};

export const invalidLocation = {
  latitude: 999, // Invalid latitude (must be -90 to 90)
  longitude: 999, // Invalid longitude (must be -180 to 180)
};

export const nearbyCourtResult = {
  ...sampleCourt,
  distance: 1234.56,
};
