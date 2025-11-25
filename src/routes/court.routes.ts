import { Router } from 'express';
import { courtController } from '../controllers/index.js';

const router = Router();

// GET /courts/nearby?latitude=x&longitude=y&radius=z
router.get('/nearby', (req, res, next) => courtController.getNearby(req, res, next));

// GET /courts
router.get('/', (req, res, next) => courtController.getAll(req, res, next));

// GET /courts/:id
router.get('/:id', (req, res, next) => courtController.getById(req, res, next));

// POST /courts
router.post('/', (req, res, next) => courtController.create(req, res, next));

// PUT /courts/:id
router.put('/:id', (req, res, next) => courtController.update(req, res, next));

// DELETE /courts/:id
router.delete('/:id', (req, res, next) => courtController.delete(req, res, next));

export { router as courtRoutes };

