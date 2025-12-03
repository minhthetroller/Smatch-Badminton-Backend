import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import type { AutocompleteSuggestion } from '../types/search.types.js';

/**
 * Redis Key Namespaces:
 * - booking:lock:* - Critical slot locks (TTL: 600s) - NEVER manually evict
 * - search:autocomplete - Main autocomplete sorted set (persistent)
 * - search:cache:* - Search result cache (TTL: 300s) - evict first
 * - search:popular - Popular searches tracking (TTL: 86400s)
 */
const REDIS_KEYS = {
  BOOKING_LOCK_PREFIX: 'booking:lock',
  SEARCH_AUTOCOMPLETE: 'search:autocomplete',
  SEARCH_COURT_NAMES: 'search:courts', // Hash: courtId -> court name
  SEARCH_CACHE_PREFIX: 'search:cache',
  SEARCH_POPULAR: 'search:popular',
} as const;

const SEARCH_CACHE_TTL_SECONDS = 300; // 5 minutes
const SEARCH_POPULAR_TTL_SECONDS = 86400; // 24 hours

class RedisService {
  private client: Redis | null = null;

  /**
   * Get Redis client instance (lazy initialization)
   */
  getClient(): Redis {
    if (!this.client) {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.client.on('error', (err: Error) => {
        console.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        console.log('Redis connected successfully');
      });
    }
    return this.client;
  }

  /**
   * Acquire a lock for a time slot
   * Returns true if lock acquired, false if slot is already locked
   */
  async acquireSlotLock(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string,
    bookingId: string
  ): Promise<boolean> {
    const key = this.buildSlotLockKey(subCourtId, date, startTime, endTime);
    const ttl = config.payment.slotLockTtlSeconds;

    // Use SET NX (only set if not exists) with expiration
    const result = await this.getClient().set(key, bookingId, 'EX', ttl, 'NX');
    return result === 'OK';
  }

  /**
   * Release a time slot lock
   * Only releases if the lock belongs to the given bookingId
   */
  async releaseSlotLock(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string,
    bookingId: string
  ): Promise<boolean> {
    const key = this.buildSlotLockKey(subCourtId, date, startTime, endTime);

    // Use Lua script for atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.getClient().eval(script, 1, key, bookingId);
    return result === 1;
  }

  /**
   * Check if a slot is locked
   */
  async isSlotLocked(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    const key = this.buildSlotLockKey(subCourtId, date, startTime, endTime);
    const result = await this.getClient().exists(key);
    return result === 1;
  }

  /**
   * Get the booking ID that holds the lock for a slot
   */
  async getSlotLockHolder(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<string | null> {
    const key = this.buildSlotLockKey(subCourtId, date, startTime, endTime);
    return await this.getClient().get(key);
  }

  /**
   * Extend the lock TTL for a slot
   */
  async extendSlotLock(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string,
    bookingId: string
  ): Promise<boolean> {
    const key = this.buildSlotLockKey(subCourtId, date, startTime, endTime);
    const ttl = config.payment.slotLockTtlSeconds;

    // Only extend if the lock belongs to this booking
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.getClient().eval(script, 1, key, bookingId, ttl);
    return result === 1;
  }

  /**
   * Build the Redis key for a slot lock
   * Uses booking:lock namespace to protect from eviction
   */
  private buildSlotLockKey(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string
  ): string {
    return `${REDIS_KEYS.BOOKING_LOCK_PREFIX}:${subCourtId}:${date}:${startTime}:${endTime}`;
  }

  // ============================================
  // SEARCH AUTOCOMPLETE METHODS
  // ============================================

  /**
   * Add a court to the autocomplete index
   * Stores as "searchTerm|courtId" with score for ranking
   * Also stores the court name in a hash for display
   */
  async addToAutocomplete(
    courtId: string,
    courtName: string,
    searchTerms: string[],
    score: number = 0
  ): Promise<void> {
    const client = this.getClient();
    const pipeline = client.pipeline();

    // Store the court name for display in results
    pipeline.hset(REDIS_KEYS.SEARCH_COURT_NAMES, courtId, courtName);

    for (const term of searchTerms) {
      const normalizedTerm = this.normalizeSearchTerm(term);
      if (normalizedTerm.length >= 2) {
        const member = `${normalizedTerm}|${courtId}`;
        pipeline.zadd(REDIS_KEYS.SEARCH_AUTOCOMPLETE, score, member);
      }
    }

    await pipeline.exec();
  }

  /**
   * Remove a court from the autocomplete index
   * Removes all entries containing the courtId
   */
  async removeFromAutocomplete(courtId: string): Promise<void> {
    const client = this.getClient();
    
    // Get all members and filter by courtId suffix
    const allMembers = await client.zrange(REDIS_KEYS.SEARCH_AUTOCOMPLETE, 0, -1);
    const membersToRemove = allMembers.filter((m) => m.endsWith(`|${courtId}`));

    if (membersToRemove.length > 0) {
      await client.zrem(REDIS_KEYS.SEARCH_AUTOCOMPLETE, ...membersToRemove);
    }

    // Also remove the court name from the hash
    await client.hdel(REDIS_KEYS.SEARCH_COURT_NAMES, courtId);
  }

  /**
   * Search autocomplete suggestions by prefix
   * Supports multi-word queries - all words must match (as prefixes)
   * Returns full court names for display
   */
  async searchAutocomplete(
    prefix: string,
    limit: number = 10
  ): Promise<AutocompleteSuggestion[]> {
    const client = this.getClient();
    const normalizedPrefix = this.normalizeSearchTerm(prefix);

    if (normalizedPrefix.length < 2) {
      return [];
    }

    // Split query into words for multi-word matching
    const queryWords = normalizedPrefix.split(/\s+/).filter((w) => w.length >= 2);
    if (queryWords.length === 0) {
      return [];
    }

    // Get all members - for small datasets this is efficient
    // For larger datasets, consider Redis Search module or prefix-based sorted sets
    const members = await client.zrevrange(
      REDIS_KEYS.SEARCH_AUTOCOMPLETE,
      0,
      -1,
      'WITHSCORES'
    );

    // Build a map of courtId -> { terms: Set<string>, maxScore: number }
    const courtTermsMap = new Map<string, { terms: Set<string>; maxScore: number }>();

    // Parse results: [member1, score1, member2, score2, ...]
    for (let i = 0; i < members.length; i += 2) {
      const member = members[i]!;
      const score = parseFloat(members[i + 1]!);
      
      const [term, courtId] = member.split('|');
      if (!term || !courtId) continue;

      if (!courtTermsMap.has(courtId)) {
        courtTermsMap.set(courtId, { terms: new Set(), maxScore: score });
      }
      const courtData = courtTermsMap.get(courtId)!;
      courtData.terms.add(term.toLowerCase());
      courtData.maxScore = Math.max(courtData.maxScore, score);
    }

    // Find courts where ALL query words match at least one term (as prefix)
    const matchedCourtIds: { courtId: string; score: number }[] = [];

    for (const [courtId, courtData] of courtTermsMap) {
      const termsArray = Array.from(courtData.terms);
      
      // Check if all query words match
      const allWordsMatch = queryWords.every((queryWord) =>
        termsArray.some((term) => term.startsWith(queryWord))
      );

      if (allWordsMatch) {
        matchedCourtIds.push({ courtId, score: courtData.maxScore });
      }

      if (matchedCourtIds.length >= limit) break;
    }

    if (matchedCourtIds.length === 0) {
      return [];
    }

    // Sort by score descending
    matchedCourtIds.sort((a, b) => b.score - a.score);

    // Fetch court names from hash
    const courtIds = matchedCourtIds.slice(0, limit).map((m) => m.courtId);
    const courtNames = await client.hmget(REDIS_KEYS.SEARCH_COURT_NAMES, ...courtIds);

    // Build results with full court names
    const results: AutocompleteSuggestion[] = courtIds.map((courtId, index) => ({
      id: courtId,
      text: courtNames[index] || courtId, // Fallback to ID if name not found
      score: matchedCourtIds[index]!.score,
    }));

    return results;
  }

  /**
   * Clear the entire autocomplete index
   * Used during full reindex operations
   */
  async clearAutocomplete(): Promise<void> {
    const client = this.getClient();
    await Promise.all([
      client.del(REDIS_KEYS.SEARCH_AUTOCOMPLETE),
      client.del(REDIS_KEYS.SEARCH_COURT_NAMES),
    ]);
  }

  /**
   * Get the count of items in autocomplete index
   */
  async getAutocompleteCount(): Promise<number> {
    return await this.getClient().zcard(REDIS_KEYS.SEARCH_AUTOCOMPLETE);
  }

  // ============================================
  // SEARCH CACHE METHODS
  // ============================================

  /**
   * Cache search results with TTL
   * Uses search:cache namespace with short TTL for quick eviction
   */
  async cacheSearchResults(
    queryHash: string,
    results: unknown
  ): Promise<void> {
    const key = `${REDIS_KEYS.SEARCH_CACHE_PREFIX}:${queryHash}`;
    await this.getClient().setex(
      key,
      SEARCH_CACHE_TTL_SECONDS,
      JSON.stringify(results)
    );
  }

  /**
   * Get cached search results
   * Returns null if cache miss
   */
  async getCachedSearchResults<T>(queryHash: string): Promise<T | null> {
    const key = `${REDIS_KEYS.SEARCH_CACHE_PREFIX}:${queryHash}`;
    const cached = await this.getClient().get(key);
    
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  }

  /**
   * Invalidate search cache for a specific query
   */
  async invalidateSearchCache(queryHash: string): Promise<void> {
    const key = `${REDIS_KEYS.SEARCH_CACHE_PREFIX}:${queryHash}`;
    await this.getClient().del(key);
  }

  /**
   * Clear all search caches
   * Useful when court data changes significantly
   */
  async clearAllSearchCache(): Promise<void> {
    const client = this.getClient();
    const pattern = `${REDIS_KEYS.SEARCH_CACHE_PREFIX}:*`;
    
    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
  }

  // ============================================
  // POPULAR SEARCHES TRACKING
  // ============================================

  /**
   * Track a search query for popularity ranking
   */
  async trackPopularSearch(query: string): Promise<void> {
    const normalizedQuery = this.normalizeSearchTerm(query);
    if (normalizedQuery.length < 2) return;

    const client = this.getClient();
    
    // Increment score in sorted set
    await client.zincrby(REDIS_KEYS.SEARCH_POPULAR, 1, normalizedQuery);
    
    // Set TTL if key is new (won't reset existing TTL)
    await client.expire(REDIS_KEYS.SEARCH_POPULAR, SEARCH_POPULAR_TTL_SECONDS);
  }

  /**
   * Get top popular searches
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    const results = await this.getClient().zrevrange(
      REDIS_KEYS.SEARCH_POPULAR,
      0,
      limit - 1
    );
    return results;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Normalize search term for consistent matching
   * Lowercase and trim whitespace
   */
  private normalizeSearchTerm(term: string): string {
    return term.toLowerCase().trim();
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

export const redisService = new RedisService();


