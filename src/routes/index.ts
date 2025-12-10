import { Router } from 'express';
import { courtRoutes } from './court.routes.js';
import { mapTilesRoutes } from './map-tiles.routes.js';
import { availabilityRoutes } from './availability.routes.js';
import { bookingRoutes } from './booking.routes.js';
import { paymentRoutes } from './payment.routes.js';
import { searchRoutes, searchAdminRoutes } from './search.routes.js';
import { authRoutes } from './auth.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/courts', courtRoutes);
router.use('/map-tiles', mapTilesRoutes);
router.use('/', availabilityRoutes); // /courts/:courtId/availability
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/search', searchRoutes);
router.use('/admin/search', searchAdminRoutes);

export { router as apiRoutes };
