import { Router } from 'express';
import { availabilityController } from '../controllers/index.js';

const router = Router();

// GET /bookings?phone=xxx
// Get bookings by phone number
router.get('/', (req, res, next) => availabilityController.getBookingsByPhone(req, res, next));

// GET /bookings/:id
// Get booking by ID
router.get('/:id', (req, res, next) => availabilityController.getBookingById(req, res, next));

// POST /bookings
// Create a new booking
router.post('/', (req, res, next) => availabilityController.createBooking(req, res, next));

// DELETE /bookings/:id
// Cancel a booking
router.delete('/:id', (req, res, next) => availabilityController.cancelBooking(req, res, next));

export { router as bookingRoutes };

