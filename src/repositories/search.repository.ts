import { prisma } from '../config/database.js';
import type {
  SearchQueryParams,
  RawCourtSearchResult,
  CourtIndexData,
  CourtAutocompleteDetails,
} from '../types/index.js';

/**
 * Raw result from PostGIS query for court details with location
 */
interface RawCourtDetailsResult {
  id: string;
  address_street: string | null;
  address_ward: string | null;
  address_district: string | null;
  address_city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export class SearchRepository {
  /**
   * Fuzzy search courts using pg_trgm similarity and full-text search
   * Supports Vietnamese diacritics-insensitive search using unaccent
   * Combines trigram similarity with tsvector full-text search for best results
   */
  async searchCourts(
    query: string,
    params: SearchQueryParams
  ): Promise<{ results: RawCourtSearchResult[]; total: number }> {
    const { page = 1, limit = 10, minSimilarity = 0.3, district } = params;
    const offset = (page - 1) * limit;

    let results: RawCourtSearchResult[];
    let total: number;

    if (district) {
      // Query with district filter - Vietnamese diacritics-insensitive
      results = await prisma.$queryRaw<RawCourtSearchResult[]>`
        SELECT 
          id,
          name,
          address_district,
          address_city,
          address_ward,
          address_street,
          GREATEST(
            similarity(name, ${query}),
            similarity(name_unaccent, lower(immutable_unaccent(${query})))
          ) AS name_score,
          GREATEST(
            similarity(COALESCE(address_district, ''), ${query}),
            similarity(COALESCE(district_unaccent, ''), lower(immutable_unaccent(${query})))
          ) AS district_score
        FROM courts
        WHERE (
          similarity(name, ${query}) > ${minSimilarity}
          OR similarity(name_unaccent, lower(immutable_unaccent(${query}))) > ${minSimilarity}
          OR similarity(COALESCE(address_district, ''), ${query}) > ${minSimilarity}
          OR similarity(COALESCE(district_unaccent, ''), lower(immutable_unaccent(${query}))) > ${minSimilarity}
          OR search_vector @@ plainto_tsquery('simple', immutable_unaccent(${query}))
        )
        AND address_district = ${district}
        ORDER BY GREATEST(
          similarity(name, ${query}),
          similarity(name_unaccent, lower(immutable_unaccent(${query}))),
          similarity(COALESCE(address_district, ''), ${query}),
          similarity(COALESCE(district_unaccent, ''), lower(immutable_unaccent(${query})))
        ) DESC, name ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM courts
        WHERE (
          similarity(name, ${query}) > ${minSimilarity}
          OR similarity(name_unaccent, lower(immutable_unaccent(${query}))) > ${minSimilarity}
          OR similarity(COALESCE(address_district, ''), ${query}) > ${minSimilarity}
          OR similarity(COALESCE(district_unaccent, ''), lower(immutable_unaccent(${query}))) > ${minSimilarity}
          OR search_vector @@ plainto_tsquery('simple', immutable_unaccent(${query}))
        )
        AND address_district = ${district}
      `;
      total = Number(countResult[0]?.count ?? 0);
    } else {
      // Query without district filter - Vietnamese diacritics-insensitive
      results = await prisma.$queryRaw<RawCourtSearchResult[]>`
        SELECT 
          id,
          name,
          address_district,
          address_city,
          address_ward,
          address_street,
          GREATEST(
            similarity(name, ${query}),
            similarity(name_unaccent, lower(immutable_unaccent(${query})))
          ) AS name_score,
          GREATEST(
            similarity(COALESCE(address_district, ''), ${query}),
            similarity(COALESCE(district_unaccent, ''), lower(immutable_unaccent(${query})))
          ) AS district_score
        FROM courts
        WHERE (
          similarity(name, ${query}) > ${minSimilarity}
          OR similarity(name_unaccent, lower(immutable_unaccent(${query}))) > ${minSimilarity}
          OR similarity(COALESCE(address_district, ''), ${query}) > ${minSimilarity}
          OR similarity(COALESCE(district_unaccent, ''), lower(immutable_unaccent(${query}))) > ${minSimilarity}
          OR search_vector @@ plainto_tsquery('simple', immutable_unaccent(${query}))
        )
        ORDER BY GREATEST(
          similarity(name, ${query}),
          similarity(name_unaccent, lower(immutable_unaccent(${query}))),
          similarity(COALESCE(address_district, ''), ${query}),
          similarity(COALESCE(district_unaccent, ''), lower(immutable_unaccent(${query})))
        ) DESC, name ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM courts
        WHERE (
          similarity(name, ${query}) > ${minSimilarity}
          OR similarity(name_unaccent, lower(immutable_unaccent(${query}))) > ${minSimilarity}
          OR similarity(COALESCE(address_district, ''), ${query}) > ${minSimilarity}
          OR similarity(COALESCE(district_unaccent, ''), lower(immutable_unaccent(${query}))) > ${minSimilarity}
          OR search_vector @@ plainto_tsquery('simple', immutable_unaccent(${query}))
        )
      `;
      total = Number(countResult[0]?.count ?? 0);
    }

    return { results, total };
  }

  /**
   * Search courts by exact or partial name match
   * Faster than fuzzy search for simple prefix matching
   */
  async searchCourtsByName(
    namePrefix: string,
    limit: number = 10
  ): Promise<RawCourtSearchResult[]> {
    return prisma.$queryRaw<RawCourtSearchResult[]>`
      SELECT 
        id,
        name,
        address_district,
        address_city,
        address_ward,
        address_street,
        1.0 AS name_score,
        0.0 AS district_score
      FROM courts
      WHERE name ILIKE ${`${namePrefix}%`}
      ORDER BY name ASC
      LIMIT ${limit}
    `;
  }

  /**
   * Get all courts for indexing in Redis autocomplete
   * Returns minimal data needed for search index
   */
  async findAllForIndex(): Promise<CourtIndexData[]> {
    const courts = await prisma.court.findMany({
      select: {
        id: true,
        name: true,
        addressDistrict: true,
        addressWard: true,
        addressCity: true,
      },
      orderBy: { name: 'asc' },
    });

    return courts;
  }

  /**
   * Get a single court for indexing
   */
  async findForIndex(courtId: string): Promise<CourtIndexData | null> {
    const court = await prisma.court.findUnique({
      where: { id: courtId },
      select: {
        id: true,
        name: true,
        addressDistrict: true,
        addressWard: true,
        addressCity: true,
      },
    });

    return court;
  }

  /**
   * Get courts count for monitoring
   */
  async getCourtsCount(): Promise<number> {
    return prisma.court.count();
  }

  /**
   * Get court details including geolocation for autocomplete
   * Fetches address fields and extracts lat/lng from PostGIS location
   */
  async findCourtDetailsById(courtIds: string[]): Promise<CourtAutocompleteDetails[]> {
    if (courtIds.length === 0) {
      return [];
    }

    // Use raw query to extract lat/lng from PostGIS geography column
    const results = await prisma.$queryRaw<RawCourtDetailsResult[]>`
      SELECT 
        id,
        address_street,
        address_ward,
        address_district,
        address_city,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude
      FROM courts
      WHERE id = ANY(${courtIds}::uuid[])
    `;

    // Transform to typed response and maintain order based on input courtIds
    const detailsMap = new Map<string, CourtAutocompleteDetails>();
    for (const row of results) {
      detailsMap.set(row.id, {
        id: row.id,
        addressStreet: row.address_street,
        addressWard: row.address_ward,
        addressDistrict: row.address_district,
        addressCity: row.address_city,
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }

    // Return in same order as input courtIds
    return courtIds
      .map((id) => detailsMap.get(id))
      .filter((d): d is CourtAutocompleteDetails => d !== undefined);
  }
}

export const searchRepository = new SearchRepository();

