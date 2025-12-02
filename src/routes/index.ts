import { Router } from 'express';
import { courtRoutes } from './court.routes.js';
import { mapTilesRoutes } from './map-tiles.routes.js';
import { availabilityRoutes } from './availability.routes.js';
import { bookingRoutes } from './booking.routes.js';

const router = Router();

router.use('/courts', courtRoutes);
router.use('/map-tiles', mapTilesRoutes);
router.use('/', availabilityRoutes); // /courts/:courtId/availability
router.use('/bookings', bookingRoutes);

export { router as apiRoutes };
