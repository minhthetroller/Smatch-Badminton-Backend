import { Router } from 'express';
import { paymentController } from '../controllers/index.js';

const router = Router();

// POST /payments/create
// Create a payment for a booking (returns ZaloPay QR code URL)
router.post('/create', (req, res, next) => paymentController.createPayment(req, res, next));

// POST /payments/callback
// ZaloPay callback webhook (called by ZaloPay after payment)
router.post('/callback', (req, res, next) => paymentController.handleCallback(req, res, next));

// GET /payments/:id
// Get payment by ID with booking details
router.get('/:id', (req, res, next) => paymentController.getPaymentById(req, res, next));

// GET /payments/:id/status
// Query payment status from ZaloPay and sync
router.get('/:id/status', (req, res, next) => paymentController.queryPaymentStatus(req, res, next));

// POST /payments/:id/cancel
// Cancel a pending payment (user-initiated cancellation)
router.post('/:id/cancel', (req, res, next) => paymentController.cancelPayment(req, res, next));

export { router as paymentRoutes };

