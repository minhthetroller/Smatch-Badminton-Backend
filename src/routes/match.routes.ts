/**
 * Match Routes
 * API endpoints for exchange match management
 */

import { Router } from 'express';
import { matchController } from '../controllers/match.controller.js';
import { paymentController } from '../controllers/payment.controller.js';
import { requireAuth, requireRegisteredUser } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @route GET /api/matches
 * @desc List all matches with optional filters
 * @access Public
 */
router.get('/', matchController.getAll.bind(matchController));

/**
 * @route GET /api/matches/hosted
 * @desc Get matches hosted by current user
 * @access Private (Registered users)
 */
router.get('/hosted', requireAuth, requireRegisteredUser, matchController.getHostedMatches.bind(matchController));

/**
 * @route GET /api/matches/joined
 * @desc Get matches joined by current user
 * @access Private (Registered users)
 */
router.get('/joined', requireAuth, requireRegisteredUser, matchController.getJoinedMatches.bind(matchController));

/**
 * @route GET /api/matches/:id
 * @desc Get match by ID with players
 * @access Public
 */
router.get('/:id', matchController.getById.bind(matchController));

/**
 * @route POST /api/matches
 * @desc Create a new exchange match
 * @access Private (Registered users)
 */
router.post('/', requireAuth, requireRegisteredUser, matchController.create.bind(matchController));

/**
 * @route PUT /api/matches/:id
 * @desc Update a match (host only)
 * @access Private (Host only)
 */
router.put('/:id', requireAuth, requireRegisteredUser, matchController.update.bind(matchController));

/**
 * @route DELETE /api/matches/:id
 * @desc Cancel a match (host only)
 * @access Private (Host only)
 */
router.delete('/:id', requireAuth, requireRegisteredUser, matchController.cancel.bind(matchController));

/**
 * @route POST /api/matches/:id/join
 * @desc Request to join a match
 * @access Private (Registered users)
 */
router.post('/:id/join', requireAuth, requireRegisteredUser, matchController.join.bind(matchController));

/**
 * @route DELETE /api/matches/:id/leave
 * @desc Leave a match
 * @access Private (Registered users)
 */
router.delete('/:id/leave', requireAuth, requireRegisteredUser, matchController.leave.bind(matchController));

/**
 * @route POST /api/matches/:id/requests/:playerId/respond
 * @desc Respond to a join request (host only, for private matches)
 * @access Private (Host only)
 */
router.post('/:id/requests/:playerId/respond', requireAuth, requireRegisteredUser, matchController.respondToRequest.bind(matchController));

/**
 * @route POST /api/matches/:id/payment
 * @desc Create a payment for joining a match (100% upfront fee)
 * @access Private (Registered users)
 */
router.post('/:id/payment', requireAuth, requireRegisteredUser, paymentController.createMatchJoinPayment.bind(paymentController));

/**
 * @route GET /api/matches/:id/payment/:paymentId/status
 * @desc Query match join payment status
 * @access Private (Registered users)
 */
router.get('/:id/payment/:paymentId/status', requireAuth, requireRegisteredUser, paymentController.queryMatchPaymentStatus.bind(paymentController));

export { router as matchRoutes };
