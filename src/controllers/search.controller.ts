import type { Request, Response, NextFunction } from 'express';
import { searchService } from '../services/index.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';
import type { AutocompleteQueryParams, SearchQueryParams } from '../types/index.js';

export class SearchController {
  /**
   * GET /api/search/autocomplete
   * Get autocomplete suggestions for search-as-you-type
   * Optionally includes address and geolocation when includeDetails=true
   */
  async getAutocomplete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params: AutocompleteQueryParams = {
        q: req.query.q as string,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        includeDetails: req.query.includeDetails === 'true',
      };

      if (!params.q || params.q.trim().length < 2) {
        throw new BadRequestError('Search query must be at least 2 characters');
      }

      const suggestions = await searchService.getAutocompleteSuggestions(
        params.q,
        params.limit,
        params.includeDetails
      );

      sendSuccess(res, { suggestions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/search/courts
   * Full fuzzy search with pagination
   */
  async searchCourts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params: SearchQueryParams = {
        q: req.query.q as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        minSimilarity: req.query.minSimilarity ? Number(req.query.minSimilarity) : 0.3,
        district: req.query.district as string | undefined,
      };

      if (!params.q || params.q.trim().length < 2) {
        throw new BadRequestError('Search query must be at least 2 characters');
      }

      const result = await searchService.searchCourts(params);

      sendPaginated(res, result.courts, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/search/reindex
   * Rebuild the autocomplete index from database
   */
  async reindexAutocomplete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await searchService.rebuildAutocompleteIndex();

      sendSuccess(res, {
        message: 'Autocomplete index rebuilt successfully',
        indexed: result.indexed,
        durationMs: result.duration,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/search/popular
   * Get popular search queries
   */
  async getPopularSearches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const searches = await searchService.getPopularSearches(limit);

      sendSuccess(res, { searches });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/search/stats
   * Get search index statistics
   */
  async getIndexStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await searchService.getIndexStats();
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const searchController = new SearchController();

