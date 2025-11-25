import { prisma } from '../config/database.js';
import type { CreateCourtDto, UpdateCourtDto, CourtQueryParams, CourtLocation } from '../types/index.js';

export class CourtRepository {
  async findAll(params: CourtQueryParams) {
    const { district, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where = district ? { addressDistrict: district } : {};

    const [courts, total] = await Promise.all([
      prisma.court.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.court.count({ where }),
    ]);

    return { courts, total, page, limit };
  }

  async findById(id: string) {
    return prisma.court.findUnique({ where: { id } });
  }

  async create(data: CreateCourtDto) {
    const { location, ...rest } = data;

    if (location) {
      // Use raw query for PostGIS geography type
      const result = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO courts (name, description, phone_numbers, address_street, address_ward, address_district, address_city, details, opening_hours, location)
        VALUES (
          ${rest.name},
          ${rest.description ?? null},
          ${rest.phoneNumbers ?? []},
          ${rest.addressStreet ?? null},
          ${rest.addressWard ?? null},
          ${rest.addressDistrict ?? null},
          ${rest.addressCity ?? 'Hà Nội'},
          ${JSON.stringify(rest.details ?? {})}::jsonb,
          ${JSON.stringify(rest.openingHours ?? {})}::jsonb,
          ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography
        )
        RETURNING id
      `;
      return this.findById(result[0]!.id);
    }

    return prisma.court.create({
      data: {
        name: rest.name,
        description: rest.description,
        phoneNumbers: rest.phoneNumbers ?? [],
        addressStreet: rest.addressStreet,
        addressWard: rest.addressWard,
        addressDistrict: rest.addressDistrict,
        addressCity: rest.addressCity ?? 'Hà Nội',
        details: rest.details ?? {},
        openingHours: rest.openingHours ?? {},
      },
    });
  }

  async update(id: string, data: UpdateCourtDto) {
    const { location, ...rest } = data;

    if (location) {
      await prisma.$executeRaw`
        UPDATE courts 
        SET location = ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography,
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    }

    return prisma.court.update({
      where: { id },
      data: {
        ...rest,
        details: rest.details ?? undefined,
        openingHours: rest.openingHours ?? undefined,
      },
    });
  }

  async delete(id: string) {
    return prisma.court.delete({ where: { id } });
  }

  async findNearby(location: CourtLocation, radiusKm: number = 5) {
    const radiusMeters = radiusKm * 1000;

    return prisma.$queryRaw`
      SELECT id, name, description, phone_numbers, address_street, address_ward, address_district, address_city, details, opening_hours,
             ST_Distance(location, ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography) as distance
      FROM courts
      WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography, ${radiusMeters})
      ORDER BY distance
    `;
  }
}

export const courtRepository = new CourtRepository();

