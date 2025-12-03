import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
  Router,
} from 'express';
import {
  sampleAutocompleteSuggestions,
  sampleAutocompleteSuggestionsWithDetails,
  sampleSearchResults,
  sampleSearchResponse,
  emptySearchResponse,
  validSearchQueries,
  edgeCaseQueries,
  invalidPaginationParams,
  vietnameseTestCases,
} from '../../fixtures/index.js';
import { BadRequestError } from '../../../utils/errors.js';
import { sendSuccess, sendPaginated } from '../../../utils/response.js';
import { errorHandler, notFoundHandler } from '../../../middlewares/index.js';
import type {
  AutocompleteSuggestion,
  SearchResultsResponse,
} from '../../../types/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// Mock search service
const mockSearchService = {
  getAutocompleteSuggestions: jest.fn<AnyFn>(),
  searchCourts: jest.fn<AnyFn>(),
  rebuildAutocompleteIndex: jest.fn<AnyFn>(),
  getPopularSearches: jest.fn<AnyFn>(),
  getIndexStats: jest.fn<AnyFn>(),
};

// Test controller with dependency injection
class TestSearchController {
  private service: typeof mockSearchService;

  constructor(service: typeof mockSearchService) {
    this.service = service;
  }

  async getAutocomplete(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const q = req.query.q as string;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const includeDetails = req.query.includeDetails === 'true';

      if (!q || q.trim().length < 2) {
        throw new BadRequestError('Search query must be at least 2 characters');
      }

      const suggestions =
        (await this.service.getAutocompleteSuggestions(
          q,
          limit,
          includeDetails
        )) as AutocompleteSuggestion[];
      sendSuccess(res, { suggestions });
    } catch (error) {
      next(error);
    }
  }

  async searchCourts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const params = {
        q: req.query.q as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        minSimilarity: req.query.minSimilarity
          ? Number(req.query.minSimilarity)
          : 0.3,
        district: req.query.district as string | undefined,
      };

      if (!params.q || params.q.trim().length < 2) {
        throw new BadRequestError('Search query must be at least 2 characters');
      }

      const result = (await this.service.searchCourts(
        params
      )) as SearchResultsResponse;

      sendPaginated(res, result.courts, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPopularSearches(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const searches = (await this.service.getPopularSearches(limit)) as string[];
      sendSuccess(res, { searches });
    } catch (error) {
      next(error);
    }
  }

  async reindexAutocomplete(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = (await this.service.rebuildAutocompleteIndex()) as {
        indexed: number;
        duration: number;
      };
      sendSuccess(res, {
        message: 'Autocomplete index rebuilt successfully',
        indexed: result.indexed,
        durationMs: result.duration,
      });
    } catch (error) {
      next(error);
    }
  }

  async getIndexStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = (await this.service.getIndexStats()) as {
        autocompleteCount: number;
        courtsCount: number;
      };
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

// Create test routes
function createTestSearchRoutes(controller: TestSearchController): Router {
  const router = Router();
  router.get('/autocomplete', (req, res, next) =>
    controller.getAutocomplete(req, res, next)
  );
  router.get('/courts', (req, res, next) =>
    controller.searchCourts(req, res, next)
  );
  router.get('/popular', (req, res, next) =>
    controller.getPopularSearches(req, res, next)
  );
  return router;
}

function createTestAdminRoutes(controller: TestSearchController): Router {
  const router = Router();
  router.post('/reindex', (req, res, next) =>
    controller.reindexAutocomplete(req, res, next)
  );
  router.get('/stats', (req, res, next) =>
    controller.getIndexStats(req, res, next)
  );
  return router;
}

// Create test app
function createTestApp(service: typeof mockSearchService): Express {
  const app = express();
  app.use(express.json());
  const controller = new TestSearchController(service);
  app.use('/api/search', createTestSearchRoutes(controller));
  app.use('/api/admin/search', createTestAdminRoutes(controller));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('Search Routes Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);
  });

  // ==================== AUTOCOMPLETE TESTS ====================

  describe('GET /api/search/autocomplete', () => {
    describe('Successful Requests', () => {
      it('should return autocomplete suggestions for valid query', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
          sampleAutocompleteSuggestions
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: validSearchQueries.basic })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.suggestions).toHaveLength(3);
        expect(response.body.data.suggestions[0]).toHaveProperty('id');
        expect(response.body.data.suggestions[0]).toHaveProperty('text');
        expect(response.body.data.suggestions[0]).toHaveProperty('score');
      });

      it('should accept custom limit parameter', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
          sampleAutocompleteSuggestions.slice(0, 2)
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: 'cầu', limit: 2 })
          .expect(200);

        expect(mockSearchService.getAutocompleteSuggestions).toHaveBeenCalledWith(
          'cầu',
          2,
          false
        );
        expect(response.body.data.suggestions.length).toBeLessThanOrEqual(2);
      });

      it('should handle Vietnamese queries with diacritics', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
          sampleAutocompleteSuggestions
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: vietnameseTestCases.withTone })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(
          mockSearchService.getAutocompleteSuggestions
        ).toHaveBeenCalledWith('cầu lông', 10, false);
      });

      it('should handle Vietnamese queries without diacritics', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
          sampleAutocompleteSuggestions
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: vietnameseTestCases.noTone })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should return empty array when no matches found', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue([]);

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: 'nonexistent' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.suggestions).toHaveLength(0);
      });

      it('should handle English queries', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue([
          {
            id: 'c2ggde11-1e2d-6gh0-dd8f-8dd1df502c33',
            text: 'Badminton Court Long Biên',
            score: 90,
          },
        ]);

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: validSearchQueries.singleWord })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.suggestions[0].text).toContain('Badminton');
      });

      it('should return basic response without includeDetails', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
          sampleAutocompleteSuggestions
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: 'cầu lông' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(mockSearchService.getAutocompleteSuggestions).toHaveBeenCalledWith(
          'cầu lông',
          10,
          false
        );
        // Should not have address/location fields
        expect(response.body.data.suggestions[0]).not.toHaveProperty('address');
        expect(response.body.data.suggestions[0]).not.toHaveProperty('latitude');
        expect(response.body.data.suggestions[0]).not.toHaveProperty('longitude');
      });

      it('should return details when includeDetails=true', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
          sampleAutocompleteSuggestionsWithDetails
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: 'cầu lông', includeDetails: 'true' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(mockSearchService.getAutocompleteSuggestions).toHaveBeenCalledWith(
          'cầu lông',
          10,
          true
        );
        // Should have address/location fields
        expect(response.body.data.suggestions[0]).toHaveProperty('address');
        expect(response.body.data.suggestions[0]).toHaveProperty('latitude');
        expect(response.body.data.suggestions[0]).toHaveProperty('longitude');
      });

      it('should not include details when includeDetails=false', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
          sampleAutocompleteSuggestions
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: 'cầu lông', includeDetails: 'false' })
          .expect(200);

        expect(mockSearchService.getAutocompleteSuggestions).toHaveBeenCalledWith(
          'cầu lông',
          10,
          false
        );
      });

      it('should handle includeDetails with other parameters', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
          sampleAutocompleteSuggestionsWithDetails.slice(0, 2)
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: 'cầu lông', limit: 2, includeDetails: 'true' })
          .expect(200);

        expect(mockSearchService.getAutocompleteSuggestions).toHaveBeenCalledWith(
          'cầu lông',
          2,
          true
        );
        expect(response.body.data.suggestions).toHaveLength(2);
      });
    });

    describe('Validation Errors', () => {
      it('should reject query with less than 2 characters', async () => {
        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: edgeCaseQueries.singleChar })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('at least 2 characters');
      });

      it('should reject empty query string', async () => {
        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: edgeCaseQueries.emptyString })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject missing query parameter', async () => {
        const response = await request(app)
          .get('/api/search/autocomplete')
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should reject whitespace-only query', async () => {
        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: edgeCaseQueries.whitespaceOnly })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle query with leading whitespace', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
          sampleAutocompleteSuggestions
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: edgeCaseQueries.leadingWhitespace })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should handle query with trailing whitespace', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
          sampleAutocompleteSuggestions
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: edgeCaseQueries.trailingWhitespace })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should handle query with multiple spaces', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
          sampleAutocompleteSuggestions
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: edgeCaseQueries.multipleSpaces })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should handle very long query', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue([]);

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: edgeCaseQueries.veryLongQuery })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should handle numeric query', async () => {
        mockSearchService.getAutocompleteSuggestions.mockResolvedValue([]);

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: edgeCaseQueries.numbersOnly })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Error Handling', () => {
      it('should handle service error gracefully', async () => {
        mockSearchService.getAutocompleteSuggestions.mockRejectedValue(
          new Error('Redis connection failed')
        );

        const response = await request(app)
          .get('/api/search/autocomplete')
          .query({ q: 'cầu lông' })
          .expect(500);

        expect(response.body.success).toBe(false);
      });
    });
  });

  // ==================== FULL SEARCH TESTS ====================

  describe('GET /api/search/courts', () => {
    describe('Successful Requests', () => {
      it('should return paginated search results', async () => {
        mockSearchService.searchCourts.mockResolvedValue(sampleSearchResponse);

        const response = await request(app)
          .get('/api/search/courts')
          .query({ q: validSearchQueries.basic })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.meta.pagination).toBeDefined();
        expect(response.body.meta.pagination.total).toBe(2);
        expect(response.body.meta.pagination.page).toBe(1);
        expect(response.body.meta.pagination.limit).toBe(10);
      });

      it('should accept pagination parameters', async () => {
        const paginatedResponse = {
          ...sampleSearchResponse,
          page: 2,
          limit: 5,
        };
        mockSearchService.searchCourts.mockResolvedValue(paginatedResponse);

        const response = await request(app)
          .get('/api/search/courts')
          .query({ q: 'cầu lông', page: 2, limit: 5 })
          .expect(200);

        expect(mockSearchService.searchCourts).toHaveBeenCalledWith(
          expect.objectContaining({
            q: 'cầu lông',
            page: 2,
            limit: 5,
          })
        );
        expect(response.body.meta.pagination.page).toBe(2);
      });

      it('should filter by district', async () => {
        mockSearchService.searchCourts.mockResolvedValue({
          ...sampleSearchResponse,
          courts: [sampleSearchResults[0]],
          total: 1,
        });

        const response = await request(app)
          .get('/api/search/courts')
          .query({ q: 'cầu lông', district: 'Quận Ba Đình' })
          .expect(200);

        expect(mockSearchService.searchCourts).toHaveBeenCalledWith(
          expect.objectContaining({
            district: 'Quận Ba Đình',
          })
        );
        expect(response.body.data).toHaveLength(1);
      });

      it('should accept minSimilarity parameter', async () => {
        mockSearchService.searchCourts.mockResolvedValue(sampleSearchResponse);

        await request(app)
          .get('/api/search/courts')
          .query({ q: 'cầu lông', minSimilarity: 0.5 })
          .expect(200);

        expect(mockSearchService.searchCourts).toHaveBeenCalledWith(
          expect.objectContaining({
            minSimilarity: 0.5,
          })
        );
      });

      it('should return empty results when no matches found', async () => {
        mockSearchService.searchCourts.mockResolvedValue(emptySearchResponse);

        const response = await request(app)
          .get('/api/search/courts')
          .query({ q: 'nonexistent' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(0);
        expect(response.body.meta.pagination.total).toBe(0);
      });

      it('should handle Vietnamese search queries', async () => {
        mockSearchService.searchCourts.mockResolvedValue(sampleSearchResponse);

        const response = await request(app)
          .get('/api/search/courts')
          .query({ q: vietnameseTestCases.districtBaDinh })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Validation Errors', () => {
      it('should reject query with less than 2 characters', async () => {
        const response = await request(app)
          .get('/api/search/courts')
          .query({ q: 'a' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('at least 2 characters');
      });

      it('should reject missing query parameter', async () => {
        const response = await request(app).get('/api/search/courts').expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Pagination Edge Cases', () => {
      it('should handle string page parameter (converts to number)', async () => {
        mockSearchService.searchCourts.mockResolvedValue(sampleSearchResponse);

        const response = await request(app)
          .get('/api/search/courts')
          .query({ q: 'cầu lông', page: '2' })
          .expect(200);

        expect(mockSearchService.searchCourts).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
          })
        );
      });

      it('should handle NaN page gracefully', async () => {
        mockSearchService.searchCourts.mockResolvedValue(sampleSearchResponse);

        const response = await request(app)
          .get('/api/search/courts')
          .query({ q: 'cầu lông', page: 'abc' })
          .expect(200);

        // NaN gets passed, service should handle it
        expect(response.body.success).toBe(true);
      });
    });
  });

  // ==================== POPULAR SEARCHES TESTS ====================

  describe('GET /api/search/popular', () => {
    it('should return popular search queries', async () => {
      const popularSearches = ['cầu lông', 'badminton', 'ngọc khánh'];
      mockSearchService.getPopularSearches.mockResolvedValue(popularSearches);

      const response = await request(app)
        .get('/api/search/popular')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.searches).toHaveLength(3);
      expect(response.body.data.searches).toContain('cầu lông');
    });

    it('should accept custom limit parameter', async () => {
      const popularSearches = ['cầu lông', 'badminton'];
      mockSearchService.getPopularSearches.mockResolvedValue(popularSearches);

      const response = await request(app)
        .get('/api/search/popular')
        .query({ limit: 2 })
        .expect(200);

      expect(mockSearchService.getPopularSearches).toHaveBeenCalledWith(2);
    });

    it('should return empty array when no popular searches', async () => {
      mockSearchService.getPopularSearches.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/search/popular')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.searches).toHaveLength(0);
    });

    it('should handle service error gracefully', async () => {
      mockSearchService.getPopularSearches.mockRejectedValue(
        new Error('Redis error')
      );

      const response = await request(app)
        .get('/api/search/popular')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  // ==================== ADMIN ROUTES TESTS ====================

  describe('POST /api/admin/search/reindex', () => {
    it('should rebuild autocomplete index', async () => {
      mockSearchService.rebuildAutocompleteIndex.mockResolvedValue({
        indexed: 100,
        duration: 1500,
      });

      const response = await request(app)
        .post('/api/admin/search/reindex')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe(
        'Autocomplete index rebuilt successfully'
      );
      expect(response.body.data.indexed).toBe(100);
      expect(response.body.data.durationMs).toBe(1500);
    });

    it('should handle reindex error gracefully', async () => {
      mockSearchService.rebuildAutocompleteIndex.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/admin/search/reindex')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/search/stats', () => {
    it('should return index statistics', async () => {
      mockSearchService.getIndexStats.mockResolvedValue({
        autocompleteCount: 5000,
        courtsCount: 100,
      });

      const response = await request(app)
        .get('/api/admin/search/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.autocompleteCount).toBe(5000);
      expect(response.body.data.courtsCount).toBe(100);
    });

    it('should handle stats error gracefully', async () => {
      mockSearchService.getIndexStats.mockRejectedValue(
        new Error('Stats unavailable')
      );

      const response = await request(app)
        .get('/api/admin/search/stats')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  // ==================== 404 HANDLING ====================

  describe('Not Found Routes', () => {
    it('should return 404 for non-existent search routes', async () => {
      const response = await request(app)
        .get('/api/search/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});

