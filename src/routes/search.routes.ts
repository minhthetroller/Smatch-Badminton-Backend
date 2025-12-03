import { Router } from 'express';
import { searchController } from '../controllers/index.js';

const router = Router();

// GET /search/autocomplete?q=bad&limit=10
// Real-time suggestions from Redis
router.get('/autocomplete', (req, res, next) =>
  searchController.getAutocomplete(req, res, next)
);

// GET /search/courts?q=badminton&page=1&limit=10&district=Cầu%20Giấy
// Full fuzzy search from PostgreSQL
router.get('/courts', (req, res, next) =>
  searchController.searchCourts(req, res, next)
);

// GET /search/popular?limit=10
// Get popular search queries
router.get('/popular', (req, res, next) =>
  searchController.getPopularSearches(req, res, next)
);

export { router as searchRoutes };

// Admin routes - should be mounted separately with auth middleware
const adminRouter = Router();

// POST /admin/search/reindex
// Rebuild the autocomplete index from database
adminRouter.post('/reindex', (req, res, next) =>
  searchController.reindexAutocomplete(req, res, next)
);

// GET /admin/search/stats
// Get search index statistics
adminRouter.get('/stats', (req, res, next) =>
  searchController.getIndexStats(req, res, next)
);

export { adminRouter as searchAdminRoutes };

