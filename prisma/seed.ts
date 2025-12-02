import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CourtSeed {
  name: string;
  description: string;
  phoneNumbers: string[];
  addressStreet: string;
  addressWard: string;
  addressDistrict: string;
  addressCity: string;
  details: Record<string, unknown>;
  openingHours: Record<string, string>;
  latitude: number;
  longitude: number;
  subCourtCount: number;
}

interface PricingRuleSeed {
  name: string;
  dayType: 'weekday' | 'weekend' | 'holiday';
  startTime: string;
  endTime: string;
  pricePerHour: number;
}

interface BookingSeed {
  subCourtIndex: number;
  guestName: string;
  guestPhone: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
}

// Standard pricing tiers (in VND)
const STANDARD_PRICING: PricingRuleSeed[] = [
  { name: 'Weekday Morning', dayType: 'weekday', startTime: '05:00', endTime: '17:00', pricePerHour: 70000 },
  { name: 'Weekday Evening', dayType: 'weekday', startTime: '17:00', endTime: '23:00', pricePerHour: 100000 },
  { name: 'Weekend Day', dayType: 'weekend', startTime: '05:00', endTime: '17:00', pricePerHour: 100000 },
  { name: 'Weekend Evening', dayType: 'weekend', startTime: '17:00', endTime: '23:00', pricePerHour: 150000 },
  { name: 'Holiday Day', dayType: 'holiday', startTime: '05:00', endTime: '17:00', pricePerHour: 120000 },
  { name: 'Holiday Evening', dayType: 'holiday', startTime: '17:00', endTime: '23:00', pricePerHour: 180000 },
];

// Vietnamese holidays for 2025-2026
const HOLIDAYS = [
  { date: '2025-01-01', name: 'Tết Dương lịch' },
  { date: '2025-01-28', name: 'Tết Nguyên đán (28 Tháng Chạp)' },
  { date: '2025-01-29', name: 'Tết Nguyên đán' },
  { date: '2025-01-30', name: 'Tết Nguyên đán' },
  { date: '2025-01-31', name: 'Tết Nguyên đán' },
  { date: '2025-02-01', name: 'Tết Nguyên đán' },
  { date: '2025-02-02', name: 'Tết Nguyên đán' },
  { date: '2025-02-03', name: 'Tết Nguyên đán' },
  { date: '2025-04-07', name: 'Giỗ Tổ Hùng Vương' },
  { date: '2025-04-30', name: 'Ngày Giải phóng miền Nam' },
  { date: '2025-05-01', name: 'Ngày Quốc tế Lao động' },
  { date: '2025-09-02', name: 'Quốc khánh' },
  { date: '2026-01-01', name: 'Tết Dương lịch' },
];

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // Sample badminton courts in Hanoi with real coordinates
  const courts: CourtSeed[] = [
    {
      name: 'Sân cầu lông Ngọc Khánh',
      description: 'Sân cầu lông chất lượng cao với 8 sân tiêu chuẩn',
      phoneNumbers: ['0901234567', '0988776655'],
      addressStreet: 'Số 6 Nguyễn Công Hoan',
      addressWard: 'Phường Ngọc Khánh',
      addressDistrict: 'Quận Ba Đình',
      addressCity: 'Hà Nội',
      details: {
        amenities: ['Parking', 'Shower', 'Locker', 'WiFi'],
        payments: ['Cash', 'Bank Transfer', 'MoMo'],
        serviceOptions: ['Racket Rental', 'Coaching'],
        highlights: ['Air Conditioned', 'Professional Courts'],
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
      latitude: 21.0303,
      longitude: 105.8138,
      subCourtCount: 8,
    },
    {
      name: 'Sân cầu lông Cầu Giấy',
      description: 'Sân cầu lông hiện đại phục vụ người chơi mọi trình độ',
      phoneNumbers: ['0912345678'],
      addressStreet: 'Số 15 Trần Đăng Ninh',
      addressWard: 'Phường Dịch Vọng',
      addressDistrict: 'Quận Cầu Giấy',
      addressCity: 'Hà Nội',
      details: {
        amenities: ['Parking', 'Shower', 'Cafe'],
        payments: ['Cash', 'Card'],
        serviceOptions: ['Racket Rental'],
        highlights: ['New Facility', 'Good Lighting'],
      },
      openingHours: {
        mon: '05:30-23:00',
        tue: '05:30-23:00',
        wed: '05:30-23:00',
        thu: '05:30-23:00',
        fri: '05:30-23:00',
        sat: '06:00-22:00',
        sun: '06:00-22:00',
      },
      latitude: 21.0381,
      longitude: 105.7827,
      subCourtCount: 6,
    },
    {
      name: 'Sân cầu lông Thanh Xuân',
      description: 'Trung tâm cầu lông lớn nhất quận Thanh Xuân',
      phoneNumbers: ['0923456789', '0934567890'],
      addressStreet: 'Số 120 Nguyễn Trãi',
      addressWard: 'Phường Thanh Xuân Trung',
      addressDistrict: 'Quận Thanh Xuân',
      addressCity: 'Hà Nội',
      details: {
        amenities: ['Parking', 'Shower', 'Locker', 'Cafe', 'Pro Shop'],
        payments: ['Cash', 'Card', 'Bank Transfer', 'MoMo', 'ZaloPay'],
        serviceOptions: ['Racket Rental', 'Coaching', 'String Service'],
        highlights: ['12 Courts', 'Air Conditioned', 'International Standard'],
      },
      openingHours: {
        mon: '05:00-23:00',
        tue: '05:00-23:00',
        wed: '05:00-23:00',
        thu: '05:00-23:00',
        fri: '05:00-23:00',
        sat: '05:00-23:00',
        sun: '06:00-22:00',
      },
      latitude: 20.9932,
      longitude: 105.8003,
      subCourtCount: 12,
    },
    {
      name: 'Sân cầu lông Hoàng Mai',
      description: 'Sân cầu lông giá rẻ, chất lượng tốt',
      phoneNumbers: ['0945678901'],
      addressStreet: 'Số 88 Giải Phóng',
      addressWard: 'Phường Đồng Tâm',
      addressDistrict: 'Quận Hoàng Mai',
      addressCity: 'Hà Nội',
      details: {
        amenities: ['Parking', 'Shower'],
        payments: ['Cash', 'MoMo'],
        serviceOptions: ['Racket Rental'],
        highlights: ['Affordable', 'Good Flooring'],
      },
      openingHours: {
        mon: '06:00-22:00',
        tue: '06:00-22:00',
        wed: '06:00-22:00',
        thu: '06:00-22:00',
        fri: '06:00-22:00',
        sat: '06:00-21:00',
        sun: '07:00-21:00',
      },
      latitude: 20.9815,
      longitude: 105.8413,
      subCourtCount: 4,
    },
    {
      name: 'Sân cầu lông Long Biên',
      description: 'Khu liên hợp thể thao với sân cầu lông chuyên nghiệp',
      phoneNumbers: ['0956789012', '0967890123'],
      addressStreet: 'Số 25 Ngọc Lâm',
      addressWard: 'Phường Ngọc Lâm',
      addressDistrict: 'Quận Long Biên',
      addressCity: 'Hà Nội',
      details: {
        amenities: ['Parking', 'Shower', 'Locker', 'Swimming Pool', 'Gym'],
        payments: ['Cash', 'Card', 'Bank Transfer'],
        serviceOptions: ['Racket Rental', 'Coaching', 'Membership'],
        highlights: ['Sports Complex', 'Modern Facilities', 'Outdoor Courts'],
      },
      openingHours: {
        mon: '05:30-22:00',
        tue: '05:30-22:00',
        wed: '05:30-22:00',
        thu: '05:30-22:00',
        fri: '05:30-22:00',
        sat: '06:00-22:00',
        sun: '06:00-21:00',
      },
      latitude: 21.0456,
      longitude: 105.8789,
      subCourtCount: 10,
    },
  ];

  // Sample bookings for testing (relative to today)
  const sampleBookings: Record<string, BookingSeed[]> = {
    'Sân cầu lông Ngọc Khánh': [
      { subCourtIndex: 0, guestName: 'Nguyễn Văn An', guestPhone: '0901111111', date: getDateFromNow(1), startTime: '10:00', endTime: '12:00', totalPrice: 140000, status: 'confirmed' },
      { subCourtIndex: 1, guestName: 'Trần Thị Bình', guestPhone: '0902222222', date: getDateFromNow(1), startTime: '18:00', endTime: '20:00', totalPrice: 200000, status: 'confirmed' },
      { subCourtIndex: 2, guestName: 'Lê Minh Châu', guestPhone: '0903333333', date: getDateFromNow(2), startTime: '07:00', endTime: '09:00', totalPrice: 140000, status: 'pending' },
    ],
    'Sân cầu lông Cầu Giấy': [
      { subCourtIndex: 0, guestName: 'Phạm Đức Dũng', guestPhone: '0904444444', date: getDateFromNow(1), startTime: '19:00', endTime: '21:00', totalPrice: 200000, status: 'confirmed' },
      { subCourtIndex: 3, guestName: 'Hoàng Thị Ema', guestPhone: '0905555555', date: getDateFromNow(3), startTime: '08:00', endTime: '10:00', totalPrice: 140000, status: 'pending' },
    ],
    'Sân cầu lông Thanh Xuân': [
      { subCourtIndex: 0, guestName: 'Vũ Văn Phong', guestPhone: '0906666666', date: getDateFromNow(0), startTime: '10:00', endTime: '12:00', totalPrice: 140000, status: 'confirmed' },
      { subCourtIndex: 5, guestName: 'Đỗ Thị Giang', guestPhone: '0907777777', date: getDateFromNow(1), startTime: '17:00', endTime: '19:00', totalPrice: 200000, status: 'confirmed' },
      { subCourtIndex: 8, guestName: 'Bùi Văn Hùng', guestPhone: '0908888888', date: getDateFromNow(2), startTime: '06:00', endTime: '08:00', totalPrice: 140000, status: 'pending' },
      { subCourtIndex: 11, guestName: 'Ngô Thị Inh', guestPhone: '0909999999', date: getDateFromNow(4), startTime: '20:00', endTime: '22:00', totalPrice: 200000, status: 'pending' },
    ],
    'Sân cầu lông Hoàng Mai': [
      { subCourtIndex: 0, guestName: 'Lý Văn Khánh', guestPhone: '0910101010', date: getDateFromNow(1), startTime: '14:00', endTime: '16:00', totalPrice: 140000, status: 'confirmed' },
    ],
    'Sân cầu lông Long Biên': [
      { subCourtIndex: 2, guestName: 'Trịnh Thị Lan', guestPhone: '0911111111', date: getDateFromNow(1), startTime: '09:00', endTime: '11:00', totalPrice: 140000, status: 'confirmed' },
      { subCourtIndex: 7, guestName: 'Đinh Văn Minh', guestPhone: '0912121212', date: getDateFromNow(2), startTime: '18:00', endTime: '20:00', totalPrice: 200000, status: 'pending' },
    ],
  };

  // Clear existing data in reverse order of dependencies
  console.log('🗑️  Clearing existing data...');
  await prisma.$executeRaw`DELETE FROM bookings`;
  await prisma.$executeRaw`DELETE FROM sub_court_closures`;
  await prisma.$executeRaw`DELETE FROM sub_courts`;
  await prisma.$executeRaw`DELETE FROM pricing_rules`;
  await prisma.$executeRaw`DELETE FROM holidays`;
  await prisma.court.deleteMany();
  console.log('✅ Cleared all existing data');

  // Insert holidays
  console.log('\n📅 Seeding holidays...');
  for (const holiday of HOLIDAYS) {
    await prisma.$executeRaw`
      INSERT INTO holidays (date, name) VALUES (${holiday.date}::date, ${holiday.name})
    `;
  }
  console.log(`✅ Created ${HOLIDAYS.length} holidays`);

  // Insert courts with location, sub-courts, pricing rules, and bookings
  console.log('\n🏸 Seeding courts...');
  for (const court of courts) {
    // Insert court with location using raw SQL (required for PostGIS geography)
    const courtResult = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO courts (
        name, description, phone_numbers, 
        address_street, address_ward, address_district, address_city,
        details, opening_hours, location
      ) VALUES (
        ${court.name},
        ${court.description},
        ${court.phoneNumbers},
        ${court.addressStreet},
        ${court.addressWard},
        ${court.addressDistrict},
        ${court.addressCity},
        ${JSON.stringify(court.details)}::jsonb,
        ${JSON.stringify(court.openingHours)}::jsonb,
        ST_SetSRID(ST_MakePoint(${court.longitude}, ${court.latitude}), 4326)::geography
      )
      RETURNING id
    `;
    const courtId = courtResult[0].id;
    console.log(`✅ Created court: ${court.name}`);

    // Create sub-courts
    const subCourtIds: string[] = [];
    for (let i = 1; i <= court.subCourtCount; i++) {
      const subCourtResult = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO sub_courts (court_id, name, description, is_active)
        VALUES (${courtId}::uuid, ${'Sân ' + i}, ${'Sân cầu lông số ' + i}, true)
        RETURNING id
      `;
      subCourtIds.push(subCourtResult[0].id);
    }
    console.log(`   ├── Created ${court.subCourtCount} sub-courts`);

    // Create pricing rules for this court
    for (const pricing of STANDARD_PRICING) {
      await prisma.$executeRaw`
        INSERT INTO pricing_rules (
          court_id, name, day_type, start_time, end_time, price_per_hour, is_active
        ) VALUES (
          ${courtId}::uuid,
          ${pricing.name},
          ${pricing.dayType},
          ${pricing.startTime}::time,
          ${pricing.endTime}::time,
          ${pricing.pricePerHour},
          true
        )
      `;
    }
    console.log(`   ├── Created ${STANDARD_PRICING.length} pricing rules`);

    // Create sample bookings if available
    const courtBookings = sampleBookings[court.name];
    if (courtBookings && courtBookings.length > 0) {
      for (const booking of courtBookings) {
        if (booking.subCourtIndex < subCourtIds.length) {
          await prisma.$executeRaw`
            INSERT INTO bookings (
              sub_court_id, guest_name, guest_phone, date, start_time, end_time, total_price, status
            ) VALUES (
              ${subCourtIds[booking.subCourtIndex]}::uuid,
              ${booking.guestName},
              ${booking.guestPhone},
              ${booking.date.toISOString().split('T')[0]}::date,
              ${booking.startTime}::time,
              ${booking.endTime}::time,
              ${booking.totalPrice},
              ${booking.status}
            )
          `;
        }
      }
      console.log(`   └── Created ${courtBookings.length} sample bookings`);
    } else {
      console.log(`   └── No sample bookings`);
    }
  }

  // Create some sample closures for maintenance
  console.log('\n🚫 Seeding sample closures...');
  const allSubCourts = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM sub_courts LIMIT 5
  `;
  const closureReasons = ['Bảo trì định kỳ', 'Sửa chữa sàn', 'Thay đèn', 'Sự kiện riêng'];
  
  for (let i = 0; i < Math.min(3, allSubCourts.length); i++) {
    const subCourt = allSubCourts[i];
    const closureDate = getDateFromNow(7 + i * 3); // Closures in the future
    await prisma.$executeRaw`
      INSERT INTO sub_court_closures (sub_court_id, date, reason)
      VALUES (${subCourt.id}::uuid, ${closureDate.toISOString().split('T')[0]}::date, ${closureReasons[i % closureReasons.length]})
    `;
  }
  console.log(`✅ Created 3 sample closures`);

  // Summary
  const courtCount = await prisma.court.count();
  const [{ count: subCourtCount }] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM sub_courts`;
  const [{ count: pricingRuleCount }] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM pricing_rules`;
  const [{ count: bookingCount }] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM bookings`;
  const [{ count: closureCount }] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM sub_court_closures`;
  const [{ count: holidayCount }] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM holidays`;

  console.log('\n🎉 Seeding completed!');
  console.log('   ├── Courts:', courtCount);
  console.log('   ├── Sub-courts:', Number(subCourtCount));
  console.log('   ├── Pricing rules:', Number(pricingRuleCount));
  console.log('   ├── Bookings:', Number(bookingCount));
  console.log('   ├── Closures:', Number(closureCount));
  console.log('   └── Holidays:', Number(holidayCount));
}

/**
 * Get a date relative to today
 */
function getDateFromNow(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(0, 0, 0, 0);
  return date;
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
