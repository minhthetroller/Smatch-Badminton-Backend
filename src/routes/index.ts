import { Router } from 'express';
import { courtRoutes } from './court.routes.js';
import { mapTilesRoutes } from './map-tiles.routes.js';

const router = Router();

router.use('/courts', courtRoutes);
router.use('/map-tiles', mapTilesRoutes);

export { router as apiRoutes };
