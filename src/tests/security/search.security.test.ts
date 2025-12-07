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
  searchXssPayloads,
  searchSqlInjectionPayloads,
  searchNoSqlPayloads,
  searchPathTraversalPayloads,
  searchCommandInjectionPayloads,
  edgeCaseQueries,
} from '../fixtures/index.js';
import {
  xssPayloads,
  sqlInjectionPayloads,
  headerInjectionPayloads,
  malformedJsonPayloads,
  generateOversizedPayload,
} from '../fixtures/security.fixtures.js';
import { BadRequestError } from '../../utils/errors.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import { errorHandler, notFoundHandler } from '../../middlewares/index.js';
import type {
  AutocompleteSuggestion,
  SearchResultsResponse,
} from '../../types/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// Mock search service with validation
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

      if (!q || q.trim().length < 2) {
        throw new BadRequestError('Search query must be at least 2 characters');
      }

      const suggestions =
        (await this.service.getAutocompleteSuggestions(
          q,
          limit
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

// Create test app with configurable JSON limit
function createTestApp(
  service: typeof mockSearchService,
  jsonLimit = '100kb'
): Express {
  const app = express();
  app.use(express.json({ limit: jsonLimit }));
  const controller = new TestSearchController(service);
  app.use('/api/search', createTestSearchRoutes(controller));
  app.use('/api/admin/search', createTestAdminRoutes(controller));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Default successful responses
const defaultMockResponses = {
  autocomplete: [] as AutocompleteSuggestion[],
  search: {
    courts: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  } as SearchResultsResponse,
  popular: [] as string[],
  reindex: { indexed: 0, duration: 0 },
  stats: { autocompleteCount: 0, courtsCount: 0 },
};

// ==================== SECURITY TESTS ====================

describe('Search Security Tests - XSS Prevention', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);

    // Setup default successful responses
    mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
      defaultMockResponses.autocomplete
    );
    mockSearchService.searchCourts.mockResolvedValue(
      defaultMockResponses.search
    );
    mockSearchService.getPopularSearches.mockResolvedValue(
      defaultMockResponses.popular
    );
  });

  describe('XSS in Autocomplete Query Parameter', () => {
    it('should handle script tag in query', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchXssPayloads.scriptInQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Ensure script tag is not executed - just stored as string
      expect(mockSearchService.getAutocompleteSuggestions).toHaveBeenCalledWith(
        searchXssPayloads.scriptInQuery,
        10
      );
    });

    it('should handle img onerror XSS in query', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchXssPayloads.imgOnerrorInQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle svg onload XSS in query', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchXssPayloads.svgOnloadInQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle javascript URL in query', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchXssPayloads.javascriptUrl })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle URL-encoded script tag', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchXssPayloads.encodedScript })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle unicode-encoded script tag', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchXssPayloads.unicodeScript })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle event handler injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchXssPayloads.eventHandler })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle data URI XSS', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchXssPayloads.dataUri })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('XSS in Full Search Query Parameter', () => {
    it('should handle script tag in search query', async () => {
      const response = await request(app)
        .get('/api/search/courts')
        .query({ q: xssPayloads.scriptTag })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle XSS in district filter', async () => {
      const response = await request(app)
        .get('/api/search/courts')
        .query({
          q: 'cầu lông',
          district: xssPayloads.scriptTag,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSearchService.searchCourts).toHaveBeenCalledWith(
        expect.objectContaining({
          district: xssPayloads.scriptTag,
        })
      );
    });

    it('should handle XSS in multiple parameters', async () => {
      const response = await request(app)
        .get('/api/search/courts')
        .query({
          q: xssPayloads.imgOnerror,
          district: xssPayloads.svgOnload,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('XSS in Response Content', () => {
    it('should not inject XSS when returning stored data containing scripts', async () => {
      mockSearchService.getAutocompleteSuggestions.mockResolvedValue([
        {
          id: 'test-id',
          text: '<script>alert(1)</script>',
          score: 100,
        },
      ]);

      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: 'test' })
        .expect(200);

      // Response should be JSON, browser should not execute
      expect(response.type).toBe('application/json');
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.suggestions[0].text).toBe('string');
    });
  });
});

describe('Search Security Tests - SQL Injection Prevention', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);

    mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
      defaultMockResponses.autocomplete
    );
    mockSearchService.searchCourts.mockResolvedValue(
      defaultMockResponses.search
    );
  });

  describe('SQL Injection in Autocomplete Query', () => {
    it('should handle basic OR injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchSqlInjectionPayloads.basicOr })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Query should be passed as-is to service (which uses parameterized queries)
      expect(mockSearchService.getAutocompleteSuggestions).toHaveBeenCalledWith(
        searchSqlInjectionPayloads.basicOr,
        10
      );
    });

    it('should handle UNION SELECT injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchSqlInjectionPayloads.unionSelect })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle DROP TABLE injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchSqlInjectionPayloads.dropTable })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle comment-based injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchSqlInjectionPayloads.commentDash })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle blind time-based injection', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchSqlInjectionPayloads.blindTime })
        .expect(200);

      const duration = Date.now() - startTime;

      // Should NOT take 5+ seconds (time-based injection failed)
      expect(duration).toBeLessThan(4000);
      expect(response.body.success).toBe(true);
    });

    it('should handle quotes escape injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchSqlInjectionPayloads.quotesEscape })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle double quotes injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchSqlInjectionPayloads.doubleQuotes })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('SQL Injection in Full Search', () => {
    it('should handle SQL injection in search query', async () => {
      const response = await request(app)
        .get('/api/search/courts')
        .query({ q: sqlInjectionPayloads.dropTable })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle SQL injection in district filter', async () => {
      const response = await request(app)
        .get('/api/search/courts')
        .query({
          q: 'cầu lông',
          district: sqlInjectionPayloads.basicOr,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle SQL injection in page parameter', async () => {
      const response = await request(app)
        .get('/api/search/courts')
        .query({
          q: 'cầu lông',
          page: '1; DROP TABLE courts;--',
        })
        .expect(200);

      // Page is converted to NaN, handled gracefully
      expect(response.body.success).toBe(true);
    });

    it('should handle SQL injection in limit parameter', async () => {
      const response = await request(app)
        .get('/api/search/courts')
        .query({
          q: 'cầu lông',
          limit: "10; DELETE FROM courts WHERE '1'='1",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle PostgreSQL-specific injection', async () => {
      const response = await request(app)
        .get('/api/search/courts')
        .query({ q: sqlInjectionPayloads.blindTimePostgres })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle information_schema extraction attempt', async () => {
      const response = await request(app)
        .get('/api/search/courts')
        .query({ q: searchSqlInjectionPayloads.informationSchema })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle stacked query injection', async () => {
      const response = await request(app)
        .get('/api/search/courts')
        .query({ q: searchSqlInjectionPayloads.stackedQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Search Security Tests - NoSQL/JSON Injection Prevention', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);

    mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
      defaultMockResponses.autocomplete
    );
    mockSearchService.searchCourts.mockResolvedValue(
      defaultMockResponses.search
    );
  });

  describe('NoSQL Operators in Query String', () => {
    it('should handle $gt operator string', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchNoSqlPayloads.gtOperator })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle $where operator string', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchNoSqlPayloads.whereOperator })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle JSON-like query string', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchNoSqlPayloads.jsonBreaking })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Search Security Tests - Path Traversal Prevention', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);

    mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
      defaultMockResponses.autocomplete
    );
    mockSearchService.searchCourts.mockResolvedValue(
      defaultMockResponses.search
    );
  });

  describe('Path Traversal in Search Query', () => {
    it('should handle basic path traversal', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchPathTraversalPayloads.basicTraversal })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Path should be treated as literal string
    });

    it('should handle URL-encoded path traversal', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchPathTraversalPayloads.urlEncoded })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle null byte injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchPathTraversalPayloads.nullByte })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle Windows path traversal', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchPathTraversalPayloads.windowsPath })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Search Security Tests - Command Injection Prevention', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);

    mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
      defaultMockResponses.autocomplete
    );
    mockSearchService.searchCourts.mockResolvedValue(
      defaultMockResponses.search
    );
  });

  describe('Command Injection in Search Query', () => {
    it('should handle semicolon command injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchCommandInjectionPayloads.semicolon })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle pipe command injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchCommandInjectionPayloads.pipe })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle backtick command injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchCommandInjectionPayloads.backticks })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle $() command injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchCommandInjectionPayloads.dollarParen })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle && command injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchCommandInjectionPayloads.ampersand })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle newline command injection', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: searchCommandInjectionPayloads.newlineCmd })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Search Security Tests - Header Injection Prevention', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);

    mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
      defaultMockResponses.autocomplete
    );
    mockSearchService.searchCourts.mockResolvedValue(
      defaultMockResponses.search
    );
  });

  describe('CRLF Injection in Headers', () => {
    it('should not allow header injection via query parameter', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: headerInjectionPayloads.crlfInjection })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Injected header should not appear
      expect(response.headers['x-injected-header']).toBeUndefined();
    });
  });

  describe('Host Header Attacks', () => {
    it('should handle malicious Host header', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .set('Host', headerInjectionPayloads.maliciousHost)
        .query({ q: 'cầu lông' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle spoofed X-Forwarded-For', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .set('X-Forwarded-For', headerInjectionPayloads.spoofedXForwardedFor)
        .query({ q: 'cầu lông' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle spoofed X-Forwarded-Host', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .set('X-Forwarded-Host', headerInjectionPayloads.spoofedXForwardedHost)
        .query({ q: 'cầu lông' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Content-Type Manipulation', () => {
    it('should handle wrong content type on GET', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete')
        .set('Content-Type', headerInjectionPayloads.xmlContentType)
        .query({ q: 'cầu lông' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Search Security Tests - Payload Size Limits', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService, '100kb');

    mockSearchService.rebuildAutocompleteIndex.mockResolvedValue(
      defaultMockResponses.reindex
    );
  });

  describe('Oversized Payloads', () => {
    it('should reject oversized POST body', async () => {
      const largePayload = {
        data: generateOversizedPayload(200),
      };

      const response = await request(app)
        .post('/api/admin/search/reindex')
        .send(largePayload)
        .set('Content-Type', 'application/json')
        .expect(413);

      expect(response.status).toBe(413);
    });
  });

  describe('Very Long Query Strings', () => {
    it('should handle very long query parameter', async () => {
      mockSearchService.getAutocompleteSuggestions.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: edgeCaseQueries.veryLongQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Search Security Tests - Malformed Input', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);

    mockSearchService.rebuildAutocompleteIndex.mockResolvedValue(
      defaultMockResponses.reindex
    );
  });

  describe('Malformed JSON in POST Body', () => {
    it('should reject unclosed brace', async () => {
      const response = await request(app)
        .post('/api/admin/search/reindex')
        .send(malformedJsonPayloads.unclosedBrace)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject trailing comma', async () => {
      const response = await request(app)
        .post('/api/admin/search/reindex')
        .send(malformedJsonPayloads.trailingComma)
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('Search Security Tests - ReDoS Prevention', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);

    mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
      defaultMockResponses.autocomplete
    );
    mockSearchService.searchCourts.mockResolvedValue(
      defaultMockResponses.search
    );
  });

  describe('ReDoS Attack Patterns', () => {
    it('should handle repeated characters that could cause exponential backtracking', async () => {
      const redosPayload = 'a'.repeat(100) + '!';
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: redosPayload })
        .expect(200);

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (not exponential)
      expect(duration).toBeLessThan(1000);
      expect(response.body.success).toBe(true);
    });

    it('should handle nested groups pattern', async () => {
      const nestedPattern = '((((((((((a))))))))))';
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: nestedPattern })
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
      expect(response.body.success).toBe(true);
    });
  });
});

describe('Search Security Tests - Rate Limiting Scenarios', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);

    mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
      defaultMockResponses.autocomplete
    );
    mockSearchService.searchCourts.mockResolvedValue(
      defaultMockResponses.search
    );
  });

  describe('Rapid Request Handling', () => {
    it('should handle multiple rapid autocomplete requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app)
            .get('/api/search/autocomplete')
            .query({ q: 'cầu lông' })
        );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle multiple rapid search requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app)
            .get('/api/search/courts')
            .query({ q: 'badminton' })
        );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});

describe('Search Security Tests - Admin Endpoint Protection', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);

    mockSearchService.rebuildAutocompleteIndex.mockResolvedValue(
      defaultMockResponses.reindex
    );
    mockSearchService.getIndexStats.mockResolvedValue(defaultMockResponses.stats);
  });

  describe('Unauthorized Access Attempts', () => {
    // Note: These tests document current behavior
    // In production, authentication middleware should protect these endpoints

    it('should document reindex endpoint accessibility', async () => {
      const response = await request(app)
        .post('/api/admin/search/reindex')
        .expect(200);

      // Currently accessible - in production, should require auth
      expect(response.body.success).toBe(true);
    });

    it('should document stats endpoint accessibility', async () => {
      const response = await request(app)
        .get('/api/admin/search/stats')
        .expect(200);

      // Currently accessible - in production, should require auth
      expect(response.body.success).toBe(true);
    });
  });

  describe('Method Spoofing Prevention', () => {
    it('should reject GET on POST-only reindex endpoint', async () => {
      const response = await request(app)
        .get('/api/admin/search/reindex')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should reject POST on GET-only stats endpoint', async () => {
      const response = await request(app)
        .post('/api/admin/search/stats')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('Search Security Tests - Combined Attack Vectors', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockSearchService).forEach((mock) => mock.mockReset());
    app = createTestApp(mockSearchService);

    mockSearchService.getAutocompleteSuggestions.mockResolvedValue(
      defaultMockResponses.autocomplete
    );
    mockSearchService.searchCourts.mockResolvedValue(
      defaultMockResponses.search
    );
  });

  describe('Multi-vector Attacks', () => {
    it('should handle XSS + SQL injection combined', async () => {
      const combinedPayload = "'; <script>alert(document.cookie)</script> --";

      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: combinedPayload })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle SQL injection + command injection combined', async () => {
      const combinedPayload = "'; DROP TABLE courts; --; cat /etc/passwd";

      const response = await request(app)
        .get('/api/search/courts')
        .query({ q: combinedPayload })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle XSS + path traversal combined', async () => {
      const combinedPayload = '<script>alert(1)</script>../../../etc/passwd';

      const response = await request(app)
        .get('/api/search/autocomplete')
        .query({ q: combinedPayload })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle all attacks in different parameters', async () => {
      const response = await request(app)
        .get('/api/search/courts')
        .query({
          q: sqlInjectionPayloads.dropTable,
          district: xssPayloads.scriptTag,
          page: '../../../etc/passwd',
          limit: '10; cat /etc/passwd',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

