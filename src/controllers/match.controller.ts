/**
 * Match Controller
 * HTTP handlers for exchange match endpoints with comprehensive validation
 */

import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { matchService, s3Service, imageService } from '../services/index.js';
import { config } from '../config/index.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';
import {
  createMatchSchema,
  updateMatchSchema,
  matchQuerySchema,
  joinMatchSchema,
  respondToRequestSchema,
} from '../validators/match.validator.js';
import {
  isValidMatchStatus,
  isValidUuid,
  MATCH_STATUS_VALUES,
} from '../types/match.types.js';
import type {
  CreateMatchDto,
  UpdateMatchDto,
  MatchQueryParams,
  JoinMatchDto,
  RespondToJoinRequestDto,
  MatchStatus,
} from '../types/match.types.js';

export class MatchController {
  /**
   * Create a new exchange match
   * POST /api/matches
   * Supports both multipart/form-data (with files) and application/json (with URLs)
   */
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new BadRequestError('User not authenticated');
      }

      // Handle uploaded files if present
      let imageUrls: string[] = [];
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        // Upload files to S3
        const uploadPromises = req.files.map(async (file, index) => {
          const compressedBuffer = await imageService.compressMatchImage(file.buffer);
          const timestamp = Date.now();
          const key = `matches/temp_${userId}_${timestamp}_${index}.jpg`;
          return await s3Service.uploadFile(
            compressedBuffer,
            key,
            'image/jpeg',
            config.aws.s3.bucketMatches
          );
        });
        imageUrls = await Promise.all(uploadPromises);
      }

      // Validate and parse request body with Zod (handles type coercion for multipart/form-data)
      const validationResult = createMatchSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        ).join('; ');
        throw new BadRequestError(errors);
      }
      
      const data = validationResult.data;
      
      // Merge uploaded image URLs with any URLs provided in body
      if (imageUrls.length > 0) {
        data.images = [...imageUrls, ...(data.images || [])];
      }

      // Create match
      const match = await matchService.createMatch(data as any, userId);

      // Rename S3 files with actual match ID
      if (imageUrls.length > 0) {
        const renamePromises = imageUrls.map(async (url, index) => {
          const oldKey = s3Service.extractKeyFromUrl(url);
          if (!oldKey) return url;
          
          const timestamp = Date.now();
          const newKey = `matches/${match.id}/${timestamp}_${index}.jpg`;
          
          // Copy to new location and delete old
          try {
            const buffer = await fetch(url).then(r => r.arrayBuffer()).then(b => Buffer.from(b));
            const newUrl = await s3Service.uploadFile(
              buffer,
              newKey,
              'image/jpeg',
              config.aws.s3.bucketMatches
            );
            await s3Service.deleteFile(oldKey, config.aws.s3.bucketMatches);
            return newUrl;
          } catch (error) {
            console.warn('Failed to rename match image:', error);
            return url;
          }
        });
        
        const renamedUrls = await Promise.all(renamePromises);
        
        // Update match with renamed URLs
        if (data.images) {
          const otherUrls = data.images.filter(url => !imageUrls.includes(url));
          const updatedMatch = await matchService.updateMatch(match.id, {
            images: [...renamedUrls, ...otherUrls],
          }, userId);
          match.images = updatedMatch.images;
        }
      }

      sendSuccess(res, match, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get match by ID
   * GET /api/matches/:id
   */
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || !isValidUuid(id)) {
        throw new BadRequestError('Invalid match ID format');
      }

      // Pass user ID to include current user's participation status
      const userId = req.user?.id;
      const match = await matchService.getMatchById(id, userId);
      sendSuccess(res, match);
    } catch (error) {
      next(error);
    }
  }

  /**
   * List matches with filters
   * GET /api/matches
   */
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validationResult = matchQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        ).join('; ');
        throw new BadRequestError(errors);
      }
      
      const params = validationResult.data;
      // Pass user ID to filter out joined matches
      const userId = req.user?.id;
      const { matches, total, page, limit } = await matchService.getAllMatches(params as any, userId);
      sendPaginated(res, matches, { page, limit, total });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a match
   * PUT /api/matches/:id
   */
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new BadRequestError('User not authenticated');
      }

      const { id } = req.params;
      if (!id || !isValidUuid(id)) {
        throw new BadRequestError('Invalid match ID format');
      }

      const validationResult = updateMatchSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        ).join('; ');
        throw new BadRequestError(errors);
      }
      
      const data = validationResult.data;
      const match = await matchService.updateMatch(id, data as any, userId);
      sendSuccess(res, match);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel a match
   * DELETE /api/matches/:id
   */
  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new BadRequestError('User not authenticated');
      }

      const { id } = req.params;
      if (!id || !isValidUuid(id)) {
        throw new BadRequestError('Invalid match ID format');
      }

      await matchService.cancelMatch(id, userId);
      sendSuccess(res, { message: 'Match cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Join a match
   * POST /api/matches/:id/join
   */
  async join(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new BadRequestError('User not authenticated');
      }

      const { id } = req.params;
      if (!id || !isValidUuid(id)) {
        throw new BadRequestError('Invalid match ID format');
      }

      const validationResult = joinMatchSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        ).join('; ');
        throw new BadRequestError(errors);
      }
      
      const data = validationResult.data;
      const player = await matchService.joinMatch(id, userId, data.message);
      sendSuccess(res, player, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get join requests for a match
   * GET /api/matches/:id/requests
   */
  async getJoinRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new BadRequestError('User not authenticated');
      }

      const { id } = req.params;
      if (!id || !isValidUuid(id)) {
        throw new BadRequestError('Invalid match ID format');
      }

      // Optional status filter: PENDING, ACCEPTED, REJECTED, PENDING_PAYMENT
      const { status } = req.query;
      let statusFilter: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PENDING_PAYMENT' | undefined;
      
      if (status) {
        const validStatuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'PENDING_PAYMENT'];
        if (!validStatuses.includes(status as string)) {
          throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }
        statusFilter = status as 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PENDING_PAYMENT';
      }

      const requests = await matchService.getJoinRequests(id, userId, statusFilter);
      sendSuccess(res, requests);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Respond to a join request
   * POST /api/matches/:id/requests/:playerId/respond
   */
  async respondToRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new BadRequestError('User not authenticated');
      }

      const { id, playerId } = req.params;
      if (!id || !isValidUuid(id)) {
        throw new BadRequestError('Invalid match ID format');
      }
      if (!playerId || !isValidUuid(playerId)) {
        throw new BadRequestError('Invalid player ID format');
      }

      const validationResult = respondToRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((err: any) => 
          `${err.path.join('.')}: ${err.message}`
        ).join('; ');
        throw new BadRequestError(errors);
      }
      
      const data = validationResult.data;
      const player = await matchService.respondToJoinRequest(id, playerId, data.status, userId);
      sendSuccess(res, player);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Leave a match
   * DELETE /api/matches/:id/leave
   */
  async leave(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new BadRequestError('User not authenticated');
      }

      const { id } = req.params;
      if (!id || !isValidUuid(id)) {
        throw new BadRequestError('Invalid match ID format');
      }

      await matchService.leaveMatch(id, userId);
      sendSuccess(res, { message: 'You have left the match' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get matches hosted by current user
   * GET /api/matches/hosted
   */
  async getHostedMatches(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new BadRequestError('User not authenticated');
      }

      const status = req.query.status as string | undefined;
      if (status && !isValidMatchStatus(status)) {
        throw new BadRequestError(`Invalid status. Valid values: ${MATCH_STATUS_VALUES.join(', ')}`);
      }

      const includeExpired = req.query.includeExpired === 'true';
      const matches = await matchService.getHostedMatches(userId, status as MatchStatus | undefined, includeExpired);
      sendSuccess(res, matches);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get matches joined by current user
   * GET /api/matches/joined
   */
  async getJoinedMatches(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new BadRequestError('User not authenticated');
      }

      const includeExpired = req.query.includeExpired === 'true';
      const matches = await matchService.getJoinedMatches(userId, includeExpired);
      sendSuccess(res, matches);
    } catch (error) {
      next(error);
    }
  }

}

export const matchController = new MatchController();
