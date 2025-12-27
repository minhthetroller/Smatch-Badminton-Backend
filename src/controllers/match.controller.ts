/**
 * Match Controller
 * HTTP handlers for exchange match endpoints with comprehensive validation
 */

import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { matchService } from '../services/index.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';
import {
  isValidSkillLevel,
  isValidShuttleType,
  isValidPlayerFormat,
  isValidMatchStatus,
  isValidS3Url,
  isValidTimeFormat,
  isValidDateFormat,
  isValidUuid,
  SKILL_LEVEL_VALUES,
  SHUTTLE_TYPE_VALUES,
  PLAYER_FORMAT_VALUES,
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
   */
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new BadRequestError('User not authenticated');
      }

      const data = this.validateCreateMatchDto(req.body);
      const match = await matchService.createMatch(data, userId);
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

      const match = await matchService.getMatchById(id);
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
      const params = this.validateQueryParams(req.query);
      const { matches, total, page, limit } = await matchService.getAllMatches(params);
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

      const data = this.validateUpdateMatchDto(req.body);
      const match = await matchService.updateMatch(id, data, userId);
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

      const data = this.validateJoinMatchDto(req.body);
      const player = await matchService.joinMatch(id, userId, data.message);
      sendSuccess(res, player, 201);
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

      const data = this.validateRespondDto(req.body);
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

      const matches = await matchService.getHostedMatches(userId, status as MatchStatus | undefined);
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

      const matches = await matchService.getJoinedMatches(userId);
      sendSuccess(res, matches);
    } catch (error) {
      next(error);
    }
  }

  // ==================== VALIDATION METHODS ====================

  /**
   * Validate create match DTO
   */
  private validateCreateMatchDto(body: unknown): CreateMatchDto {
    if (!body || typeof body !== 'object') {
      throw new BadRequestError('Request body is required');
    }

    const data = body as Record<string, unknown>;
    const errors: string[] = [];

    // Required: courtId
    if (!data.courtId) {
      errors.push('courtId is required');
    } else if (!isValidUuid(data.courtId)) {
      errors.push('courtId must be a valid UUID');
    }

    // Required: skillLevel
    if (!data.skillLevel) {
      errors.push('skillLevel is required');
    } else if (!isValidSkillLevel(data.skillLevel)) {
      errors.push(`skillLevel must be one of: ${SKILL_LEVEL_VALUES.join(', ')}`);
    }

    // Required: shuttleType
    if (!data.shuttleType) {
      errors.push('shuttleType is required');
    } else if (!isValidShuttleType(data.shuttleType)) {
      errors.push(`shuttleType must be one of: ${SHUTTLE_TYPE_VALUES.join(', ')}`);
    }

    // Required: playerFormat
    if (!data.playerFormat) {
      errors.push('playerFormat is required');
    } else if (!isValidPlayerFormat(data.playerFormat)) {
      errors.push(`playerFormat must be one of: ${PLAYER_FORMAT_VALUES.join(', ')}`);
    }

    // Required: date
    if (!data.date) {
      errors.push('date is required');
    } else if (!isValidDateFormat(data.date)) {
      errors.push('date must be in YYYY-MM-DD format');
    }

    // Required: startTime
    if (!data.startTime) {
      errors.push('startTime is required');
    } else if (!isValidTimeFormat(data.startTime)) {
      errors.push('startTime must be in HH:mm format (24-hour)');
    }

    // Required: endTime
    if (!data.endTime) {
      errors.push('endTime is required');
    } else if (!isValidTimeFormat(data.endTime)) {
      errors.push('endTime must be in HH:mm format (24-hour)');
    }

    // Required: price
    if (data.price === undefined || data.price === null) {
      errors.push('price is required');
    } else if (typeof data.price !== 'number' || data.price < 0) {
      errors.push('price must be a non-negative number');
    }

    // Required: slotsNeeded
    if (data.slotsNeeded === undefined || data.slotsNeeded === null) {
      errors.push('slotsNeeded is required');
    } else if (typeof data.slotsNeeded !== 'number' || data.slotsNeeded < 1 || data.slotsNeeded > 20) {
      errors.push('slotsNeeded must be a number between 1 and 20');
    }

    // Optional: title
    if (data.title !== undefined && data.title !== null) {
      if (typeof data.title !== 'string') {
        errors.push('title must be a string');
      } else if (data.title.length > 255) {
        errors.push('title must not exceed 255 characters');
      }
    }

    // Optional: description
    if (data.description !== undefined && data.description !== null) {
      if (typeof data.description !== 'string') {
        errors.push('description must be a string');
      }
    }

    // Optional: images (S3 URLs)
    if (data.images !== undefined && data.images !== null) {
      if (!Array.isArray(data.images)) {
        errors.push('images must be an array');
      } else if (data.images.length > 10) {
        errors.push('Maximum 10 images allowed');
      } else {
        for (let i = 0; i < data.images.length; i++) {
          if (!isValidS3Url(data.images[i])) {
            errors.push(`images[${i}] must be a valid S3 URL (https://bucket.s3.region.amazonaws.com/...)`);
          }
        }
      }
    }

    // Optional: isPrivate
    if (data.isPrivate !== undefined && data.isPrivate !== null) {
      if (typeof data.isPrivate !== 'boolean') {
        errors.push('isPrivate must be a boolean');
      }
    }

    if (errors.length > 0) {
      throw new BadRequestError(errors.join('; '));
    }

    return {
      courtId: data.courtId as string,
      title: data.title as string | undefined,
      description: data.description as string | undefined,
      images: data.images as string[] | undefined,
      skillLevel: data.skillLevel as CreateMatchDto['skillLevel'],
      shuttleType: data.shuttleType as CreateMatchDto['shuttleType'],
      playerFormat: data.playerFormat as CreateMatchDto['playerFormat'],
      date: data.date as string,
      startTime: data.startTime as string,
      endTime: data.endTime as string,
      isPrivate: data.isPrivate as boolean | undefined,
      price: data.price as number,
      slotsNeeded: data.slotsNeeded as number,
    };
  }

  /**
   * Validate update match DTO
   */
  private validateUpdateMatchDto(body: unknown): UpdateMatchDto {
    if (!body || typeof body !== 'object') {
      throw new BadRequestError('Request body is required');
    }

    const data = body as Record<string, unknown>;
    const errors: string[] = [];
    const result: UpdateMatchDto = {};

    // Optional: title
    if (data.title !== undefined) {
      if (data.title !== null && typeof data.title !== 'string') {
        errors.push('title must be a string');
      } else if (typeof data.title === 'string' && data.title.length > 255) {
        errors.push('title must not exceed 255 characters');
      } else {
        result.title = data.title as string;
      }
    }

    // Optional: description
    if (data.description !== undefined) {
      if (data.description !== null && typeof data.description !== 'string') {
        errors.push('description must be a string');
      } else {
        result.description = data.description as string;
      }
    }

    // Optional: images
    if (data.images !== undefined) {
      if (!Array.isArray(data.images)) {
        errors.push('images must be an array');
      } else if (data.images.length > 10) {
        errors.push('Maximum 10 images allowed');
      } else {
        for (let i = 0; i < data.images.length; i++) {
          if (!isValidS3Url(data.images[i])) {
            errors.push(`images[${i}] must be a valid S3 URL`);
          }
        }
        result.images = data.images as string[];
      }
    }

    // Optional: skillLevel
    if (data.skillLevel !== undefined) {
      if (!isValidSkillLevel(data.skillLevel)) {
        errors.push(`skillLevel must be one of: ${SKILL_LEVEL_VALUES.join(', ')}`);
      } else {
        result.skillLevel = data.skillLevel as UpdateMatchDto['skillLevel'];
      }
    }

    // Optional: shuttleType
    if (data.shuttleType !== undefined) {
      if (!isValidShuttleType(data.shuttleType)) {
        errors.push(`shuttleType must be one of: ${SHUTTLE_TYPE_VALUES.join(', ')}`);
      } else {
        result.shuttleType = data.shuttleType as UpdateMatchDto['shuttleType'];
      }
    }

    // Optional: playerFormat
    if (data.playerFormat !== undefined) {
      if (!isValidPlayerFormat(data.playerFormat)) {
        errors.push(`playerFormat must be one of: ${PLAYER_FORMAT_VALUES.join(', ')}`);
      } else {
        result.playerFormat = data.playerFormat as UpdateMatchDto['playerFormat'];
      }
    }

    // Optional: date
    if (data.date !== undefined) {
      if (!isValidDateFormat(data.date)) {
        errors.push('date must be in YYYY-MM-DD format');
      } else {
        result.date = data.date as string;
      }
    }

    // Optional: startTime
    if (data.startTime !== undefined) {
      if (!isValidTimeFormat(data.startTime)) {
        errors.push('startTime must be in HH:mm format');
      } else {
        result.startTime = data.startTime as string;
      }
    }

    // Optional: endTime
    if (data.endTime !== undefined) {
      if (!isValidTimeFormat(data.endTime)) {
        errors.push('endTime must be in HH:mm format');
      } else {
        result.endTime = data.endTime as string;
      }
    }

    // Optional: isPrivate
    if (data.isPrivate !== undefined) {
      if (typeof data.isPrivate !== 'boolean') {
        errors.push('isPrivate must be a boolean');
      } else {
        result.isPrivate = data.isPrivate;
      }
    }

    // Optional: price
    if (data.price !== undefined) {
      if (typeof data.price !== 'number' || data.price < 0) {
        errors.push('price must be a non-negative number');
      } else {
        result.price = data.price;
      }
    }

    // Optional: slotsNeeded
    if (data.slotsNeeded !== undefined) {
      if (typeof data.slotsNeeded !== 'number' || data.slotsNeeded < 1 || data.slotsNeeded > 20) {
        errors.push('slotsNeeded must be between 1 and 20');
      } else {
        result.slotsNeeded = data.slotsNeeded;
      }
    }

    // Optional: status
    if (data.status !== undefined) {
      if (!isValidMatchStatus(data.status)) {
        errors.push(`status must be one of: ${MATCH_STATUS_VALUES.join(', ')}`);
      } else {
        result.status = data.status as UpdateMatchDto['status'];
      }
    }

    if (errors.length > 0) {
      throw new BadRequestError(errors.join('; '));
    }

    return result;
  }

  /**
   * Validate query params for listing matches
   */
  private validateQueryParams(query: Record<string, unknown>): MatchQueryParams {
    const params: MatchQueryParams = {};
    const errors: string[] = [];

    if (query.courtId !== undefined) {
      if (!isValidUuid(query.courtId)) {
        errors.push('courtId must be a valid UUID');
      } else {
        params.courtId = query.courtId as string;
      }
    }

    if (query.skillLevel !== undefined) {
      if (!isValidSkillLevel(query.skillLevel)) {
        errors.push(`skillLevel must be one of: ${SKILL_LEVEL_VALUES.join(', ')}`);
      } else {
        params.skillLevel = query.skillLevel as MatchQueryParams['skillLevel'];
      }
    }

    if (query.playerFormat !== undefined) {
      if (!isValidPlayerFormat(query.playerFormat)) {
        errors.push(`playerFormat must be one of: ${PLAYER_FORMAT_VALUES.join(', ')}`);
      } else {
        params.playerFormat = query.playerFormat as MatchQueryParams['playerFormat'];
      }
    }

    if (query.status !== undefined) {
      if (!isValidMatchStatus(query.status)) {
        errors.push(`status must be one of: ${MATCH_STATUS_VALUES.join(', ')}`);
      } else {
        params.status = query.status as MatchQueryParams['status'];
      }
    }

    if (query.date !== undefined) {
      if (!isValidDateFormat(query.date)) {
        errors.push('date must be in YYYY-MM-DD format');
      } else {
        params.date = query.date as string;
      }
    }

    if (query.dateFrom !== undefined) {
      if (!isValidDateFormat(query.dateFrom)) {
        errors.push('dateFrom must be in YYYY-MM-DD format');
      } else {
        params.dateFrom = query.dateFrom as string;
      }
    }

    if (query.dateTo !== undefined) {
      if (!isValidDateFormat(query.dateTo)) {
        errors.push('dateTo must be in YYYY-MM-DD format');
      } else {
        params.dateTo = query.dateTo as string;
      }
    }

    if (query.page !== undefined) {
      const page = Number(query.page);
      if (isNaN(page) || page < 1) {
        errors.push('page must be a positive number');
      } else {
        params.page = page;
      }
    }

    if (query.limit !== undefined) {
      const limit = Number(query.limit);
      if (isNaN(limit) || limit < 1 || limit > 50) {
        errors.push('limit must be between 1 and 50');
      } else {
        params.limit = limit;
      }
    }

    if (errors.length > 0) {
      throw new BadRequestError(errors.join('; '));
    }

    return params;
  }

  /**
   * Validate join match DTO
   */
  private validateJoinMatchDto(body: unknown): JoinMatchDto {
    if (!body || typeof body !== 'object') {
      return {};
    }

    const data = body as Record<string, unknown>;
    const result: JoinMatchDto = {};

    if (data.message !== undefined && data.message !== null) {
      if (typeof data.message !== 'string') {
        throw new BadRequestError('message must be a string');
      }
      if (data.message.length > 500) {
        throw new BadRequestError('message must not exceed 500 characters');
      }
      result.message = data.message;
    }

    return result;
  }

  /**
   * Validate respond to request DTO
   */
  private validateRespondDto(body: unknown): RespondToJoinRequestDto {
    if (!body || typeof body !== 'object') {
      throw new BadRequestError('Request body is required');
    }

    const data = body as Record<string, unknown>;

    if (!data.status) {
      throw new BadRequestError('status is required');
    }

    if (data.status !== 'ACCEPTED' && data.status !== 'REJECTED') {
      throw new BadRequestError('status must be either ACCEPTED or REJECTED');
    }

    return {
      status: data.status as 'ACCEPTED' | 'REJECTED',
    };
  }
}

export const matchController = new MatchController();
