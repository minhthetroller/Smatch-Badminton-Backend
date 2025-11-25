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
}

async function main() {
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
    },
  ];

  // Clear existing data
  await prisma.court.deleteMany();
  console.log('🗑️  Cleared existing courts');

  // Insert courts with location using raw SQL
  for (const court of courts) {
    await prisma.$executeRaw`
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
    `;
    console.log(`✅ Created: ${court.name}`);
  }

  console.log(`\n🎉 Seeding completed! ${courts.length} courts created.`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
