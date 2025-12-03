import { createHash } from 'crypto';
import { searchRepository } from '../repositories/index.js';
import { redisService } from './redis.service.js';
import {
  normalizeVietnameseText,
  generateSearchVariants,
} from '../utils/vietnamese.js';
import type {
  AutocompleteSuggestion,
  SearchQueryParams,
  CourtSearchResult,
  SearchResultsResponse,
  CourtIndexData,
} from '../types/index.js';

export class SearchService {
  /**
   * Get autocomplete suggestions from Redis
   * Fast prefix-based search for "search-as-you-type" experience
   * Supports Vietnamese diacritics - searches both accented and unaccented
   * @param query - Search query string
   * @param limit - Maximum number of results
   * @param includeDetails - Whether to include address and geolocation
   */
  async getAutocompleteSuggestions(
    query: string,
    limit: number = 10,
    includeDetails: boolean = false
  ): Promise<AutocompleteSuggestion[]> {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.length < 2) {
      return [];
    }

    // Enforce max limit
    const effectiveLimit = Math.min(limit, 20);

    // Track this search for popularity
    await redisService.trackPopularSearch(normalizedQuery);

    // Search with both accented and unaccented versions for Vietnamese support
    const unaccentedQuery = normalizeVietnameseText(query);
    
    // Get results from both queries
    const [accentedResults, unaccentedResults] = await Promise.all([
      redisService.searchAutocomplete(normalizedQuery, effectiveLimit),
      normalizedQuery !== unaccentedQuery
        ? redisService.searchAutocomplete(unaccentedQuery, effectiveLimit)
        : Promise.resolve([]),
    ]);

    // Merge and deduplicate results, preserving order
    const seenIds = new Set<string>();
    const mergedResults: AutocompleteSuggestion[] = [];

    for (const result of [...accentedResults, ...unaccentedResults]) {
      if (!seenIds.has(result.id) && mergedResults.length < effectiveLimit) {
        seenIds.add(result.id);
        mergedResults.push(result);
      }
    }

    // If includeDetails is requested, fetch address and geolocation from database
    if (includeDetails && mergedResults.length > 0) {
      const courtIds = mergedResults.map((r) => r.id);
      const details = await searchRepository.findCourtDetailsById(courtIds);

      // Create a map for quick lookup
      const detailsMap = new Map(details.map((d) => [d.id, d]));

      // Enhance results with address and location
      for (const result of mergedResults) {
        const courtDetails = detailsMap.get(result.id);
        if (courtDetails) {
          result.address = this.buildCombinedAddress(courtDetails);
          result.latitude = courtDetails.latitude ?? undefined;
          result.longitude = courtDetails.longitude ?? undefined;
        }
      }
    }

    return mergedResults;
  }

  /**
   * Build a combined address string from address components
   * Format: "street, ward, district, city" (skips null/empty parts)
   */
  private buildCombinedAddress(details: {
    addressStreet: string | null;
    addressWard: string | null;
    addressDistrict: string | null;
    addressCity: string | null;
  }): string {
    const parts = [
      details.addressStreet,
      details.addressWard,
      details.addressDistrict,
      details.addressCity,
    ].filter((part) => part && part.trim().length > 0);

    return parts.join(', ');
  }

  /**
   * Full fuzzy search using PostgreSQL pg_trgm
   * Supports typo-tolerance and returns paginated results
   */
  async searchCourts(params: SearchQueryParams): Promise<SearchResultsResponse> {
    const { q, page = 1, limit = 10 } = params;
    const normalizedQuery = q.trim();

    if (normalizedQuery.length < 2) {
      return {
        courts: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Enforce max limit
    const effectiveLimit = Math.min(limit, 50);
    const effectiveParams = { ...params, limit: effectiveLimit };

    // Generate cache key hash
    const cacheKey = this.generateCacheKey(normalizedQuery, effectiveParams);

    // Check cache first
    const cached = await redisService.getCachedSearchResults<SearchResultsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    // Track this search for popularity
    await redisService.trackPopularSearch(normalizedQuery);

    // Query PostgreSQL with fuzzy search
    const { results, total } = await searchRepository.searchCourts(
      normalizedQuery,
      effectiveParams
    );

    // Transform results to response format
    const courts: CourtSearchResult[] = results.map((r) => ({
      id: r.id,
      name: r.name,
      addressDistrict: r.address_district,
      addressCity: r.address_city,
      addressWard: r.address_ward,
      addressStreet: r.address_street,
      nameScore: Number(r.name_score),
      districtScore: Number(r.district_score),
    }));

    const response: SearchResultsResponse = {
      courts,
      total,
      page,
      limit: effectiveLimit,
      totalPages: Math.ceil(total / effectiveLimit),
    };

    // Cache the results
    await redisService.cacheSearchResults(cacheKey, response);

    return response;
  }

  /**
   * Index a single court in Redis autocomplete
   * Called when a court is created or updated
   */
  async indexCourt(court: CourtIndexData): Promise<void> {
    // Build search terms from court data
    const searchTerms = this.buildSearchTerms(court);

    // Remove existing entries for this court
    await redisService.removeFromAutocomplete(court.id);

    // Add new entries with court name for display
    await redisService.addToAutocomplete(court.id, court.name, searchTerms, 0);
  }

  /**
   * Remove a court from the autocomplete index
   * Called when a court is deleted
   */
  async removeCourtFromIndex(courtId: string): Promise<void> {
    await redisService.removeFromAutocomplete(courtId);
  }

  /**
   * Rebuild the entire autocomplete index from database
   * Should be run periodically or when data changes significantly
   */
  async rebuildAutocompleteIndex(): Promise<{ indexed: number; duration: number }> {
    const startTime = Date.now();

    // Get all courts from database
    const courts = await searchRepository.findAllForIndex();

    // Clear existing autocomplete data
    await redisService.clearAutocomplete();

    // Index each court with name for display
    for (const court of courts) {
      const searchTerms = this.buildSearchTerms(court);
      await redisService.addToAutocomplete(court.id, court.name, searchTerms, 0);
    }

    // Clear search cache since data has changed
    await redisService.clearAllSearchCache();

    const duration = Date.now() - startTime;

    return {
      indexed: courts.length,
      duration,
    };
  }

  /**
   * Get popular search queries
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    return redisService.getPopularSearches(limit);
  }

  /**
   * Get autocomplete index statistics
   */
  async getIndexStats(): Promise<{
    autocompleteCount: number;
    courtsCount: number;
  }> {
    const [autocompleteCount, courtsCount] = await Promise.all([
      redisService.getAutocompleteCount(),
      searchRepository.getCourtsCount(),
    ]);

    return {
      autocompleteCount,
      courtsCount,
    };
  }

  /**
   * Build search terms for a court
   * Creates multiple terms for better autocomplete coverage
   * Includes both accented and unaccented versions for Vietnamese support
   */
  private buildSearchTerms(court: CourtIndexData): string[] {
    const terms: string[] = [];

    // Add court name (both accented and unaccented)
    if (court.name) {
      terms.push(...generateSearchVariants(court.name));
      
      // Add name words individually for partial matching
      const nameWords = court.name.split(/\s+/).filter((w) => w.length >= 3);
      for (const word of nameWords) {
        terms.push(...generateSearchVariants(word));
      }
    }

    // Add district (both accented and unaccented)
    if (court.addressDistrict) {
      terms.push(...generateSearchVariants(court.addressDistrict));
      
      // Add combined name + district for more specific matches
      if (court.name) {
        const combined = `${court.name} ${court.addressDistrict}`;
        terms.push(...generateSearchVariants(combined));
      }
    }

    // Add ward (both accented and unaccented)
    if (court.addressWard) {
      terms.push(...generateSearchVariants(court.addressWard));
    }

    // Remove duplicates and empty strings
    return [...new Set(terms.filter((t) => t && t.trim().length >= 2))];
  }

  /**
   * Generate a cache key for search results
   */
  private generateCacheKey(query: string, params: SearchQueryParams): string {
    const keyData = JSON.stringify({
      q: query.toLowerCase(),
      page: params.page || 1,
      limit: params.limit || 10,
      district: params.district || null,
      minSimilarity: params.minSimilarity || 0.3,
    });

    return createHash('md5').update(keyData).digest('hex');
  }
}

export const searchService = new SearchService();

