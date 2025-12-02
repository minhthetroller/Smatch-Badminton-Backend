import { Router } from 'express';
import { availabilityController } from '../controllers/index.js';

const router = Router();

// GET /courts/:courtId/availability?date=YYYY-MM-DD
// Get availability for a court on a specific date
router.get(
  '/courts/:courtId/availability',
  (req, res, next) => availabilityController.getCourtAvailability(req, res, next)
);

export { router as availabilityRoutes };

