/**
 * Match Service
 * Business logic for exchange match creation, joining, and management
 */

import { matchRepository } from '../repositories/match.repository.js';
import { courtRepository } from '../repositories/court.repository.js';
import { redisService } from './redis.service.js';
import { websocketService } from './websocket.service.js';
import { notificationService } from './notification.service.js';
import type {
  MatchJoinRequestNotification,
  MatchRequestResponseNotification,
  MatchPlayerLeftNotification,
  MatchStatusChangeNotification,
} from './websocket.service.js';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors.js';
import type {
  CreateMatchDto,
  UpdateMatchDto,
  MatchQueryParams,
  MatchResponseDto,
  MatchPlayerResponseDto,
  MatchWithPlayersResponseDto,
  MatchStatus,
} from '../types/match.types.js';

export class MatchService {
  /**
   * Create a new exchange match
   */
  async createMatch(data: CreateMatchDto, hostUserId: string): Promise<MatchResponseDto> {
    // Validate court exists
    const court = await courtRepository.findById(data.courtId);
    if (!court) {
      throw new NotFoundError(`Court ${data.courtId} not found`);
    }

    // Validate time range
    this.validateTimeRange(data.startTime, data.endTime);

    // Validate date is not in the past
    this.validateFutureDate(data.date);

    // Validate slots
    if (data.slotsNeeded < 1 || data.slotsNeeded > 20) {
      throw new BadRequestError('slotsNeeded must be between 1 and 20');
    }

    // Validate price
    if (data.price < 0) {
      throw new BadRequestError('Price cannot be negative');
    }

    // Create the match
    const match = await matchRepository.create(data, hostUserId);

    return this.mapToMatchResponse(match);
  }

  /**
   * Get match by ID
   */
  async getMatchById(id: string): Promise<MatchWithPlayersResponseDto> {
    const match = await matchRepository.findById(id);
    if (!match) {
      throw new NotFoundError(`Match ${id} not found`);
    }

    return this.mapToMatchWithPlayersResponse(match);
  }

  /**
   * List matches with filters
   */
  async getAllMatches(params: MatchQueryParams): Promise<{
    matches: MatchResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await matchRepository.findAll(params);

    return {
      matches: result.matches.map((m: unknown) => this.mapToMatchResponse(m)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * Update a match (host only)
   */
  async updateMatch(id: string, data: UpdateMatchDto, userId: string): Promise<MatchResponseDto> {
    const match = await matchRepository.findById(id);
    if (!match) {
      throw new NotFoundError(`Match ${id} not found`);
    }

    if (match.hostUserId !== userId) {
      throw new ForbiddenError('Only the host can update this match');
    }

    // Validate updates
    if (data.startTime && data.endTime) {
      this.validateTimeRange(data.startTime, data.endTime);
    }
    if (data.date) {
      this.validateFutureDate(data.date);
    }

    const updated = await matchRepository.update(id, data);
    return this.mapToMatchResponse(updated);
  }

  /**
   * Cancel a match (host only)
   */
  async cancelMatch(id: string, userId: string): Promise<void> {
    const match = await matchRepository.findById(id);
    if (!match) {
      throw new NotFoundError(`Match ${id} not found`);
    }

    if (match.hostUserId !== userId) {
      throw new ForbiddenError('Only the host can cancel this match');
    }

    if (match.status === 'CANCELLED' || match.status === 'COMPLETED') {
      throw new BadRequestError(`Cannot cancel a ${match.status.toLowerCase()} match`);
    }

    // Update status
    await matchRepository.updateStatus(id, 'CANCELLED');

    // Clear Redis queue
    await redisService.clearMatchJoinQueue(id);

    // Notify all subscribers
    const notification: MatchStatusChangeNotification = {
      type: 'match_status_change',
      matchId: id,
      status: 'CANCELLED',
      message: 'Match has been cancelled by the host',
    };
    // Get all participants to notify
    const acceptedPlayers = await matchRepository.getPlayersByMatchId(id, 'ACCEPTED');
    const participantIds = acceptedPlayers.map((p) => p.userId);
    // Send both WebSocket and FCM notifications
    await Promise.all([
      websocketService.notifyMatchSubscribers(id, notification),
      notificationService.notifyMatchCancelled(participantIds, id, match.title || 'Match'),
    ]);
  }

  /**
   * Join a match (request to join)
   */
  async joinMatch(matchId: string, userId: string, message?: string): Promise<MatchPlayerResponseDto> {
    const match = await matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError(`Match ${matchId} not found`);
    }

    // Validate match status
    if (match.status !== 'OPEN') {
      throw new BadRequestError(`Cannot join a ${match.status.toLowerCase()} match`);
    }

    // Check if user is the host
    if (match.hostUserId === userId) {
      throw new BadRequestError('Host cannot join their own match');
    }

    // Check if user already requested
    const existingPlayer = await matchRepository.findPlayer(matchId, userId);
    if (existingPlayer) {
      if (existingPlayer.status === 'PENDING') {
        throw new ConflictError('You already have a pending request for this match');
      }
      if (existingPlayer.status === 'ACCEPTED') {
        throw new ConflictError('You are already a player in this match');
      }
      if (existingPlayer.status === 'REJECTED') {
        throw new ConflictError('Your request was rejected by the host');
      }
    }

    // Acquire lock to prevent duplicate requests
    const lockAcquired = await redisService.acquireMatchPlayerLock(matchId, userId);
    if (!lockAcquired) {
      throw new ConflictError('Your join request is being processed');
    }

    try {
      // For public matches, auto-accept. For private, stay pending
      const initialStatus = match.isPrivate ? 'PENDING' : 'ACCEPTED';
      let position: number | undefined;

      if (initialStatus === 'ACCEPTED') {
        // Check if slots are available
        const acceptedCount = await matchRepository.countAcceptedPlayers(matchId);
        if (acceptedCount >= match.slotsNeeded) {
          throw new BadRequestError('Match is already full');
        }
        position = await matchRepository.getNextPosition(matchId);
      }

      // Add player to database
      const player = await matchRepository.addPlayer(matchId, userId, message, initialStatus);

      // Add to Redis queue for tracking
      await redisService.addToMatchJoinQueue(matchId, userId);

      // Get queue position for notification
      const queuePosition = await redisService.getMatchJoinQueuePosition(matchId, userId);

      // Build user name
      const userName = this.buildUserName(player.user);

      // Notify host about new request (for private matches)
      if (match.isPrivate) {
        const notification: MatchJoinRequestNotification = {
          type: 'match_join_request',
          matchId,
          playerId: player.id,
          userId,
          userName,
          userPhotoUrl: player.user.photoUrl,
          message: message ?? null,
          queuePosition: queuePosition ?? 1,
          timestamp: new Date().toISOString(),
        };
        // Send both WebSocket and FCM notifications
        await Promise.all([
          websocketService.notifyMatchHost(match.hostUserId, notification),
          notificationService.notifyMatchJoinRequest(
            match.hostUserId,
            matchId,
            match.title || 'Match',
            userName,
            userId
          ),
        ]);
      } else {
        // For public matches, notify all subscribers about new player
        const statusNotification: MatchStatusChangeNotification = {
          type: 'match_status_change',
          matchId,
          status: 'PLAYER_JOINED',
          message: `${userName} joined the match`,
        };
        websocketService.notifyMatchSubscribers(matchId, statusNotification);

        // Check if match is now full
        await this.checkAndUpdateMatchFull(matchId);
      }

      // Update position if accepted
      if (position !== undefined) {
        await matchRepository.updatePlayerStatus(player.id, 'ACCEPTED', position);
      }

      return this.mapToPlayerResponse(player);
    } finally {
      // Always release the lock
      await redisService.releaseMatchPlayerLock(matchId, userId);
    }
  }

  /**
   * Respond to a join request (host only)
   */
  async respondToJoinRequest(
    matchId: string,
    playerId: string,
    status: 'ACCEPTED' | 'REJECTED',
    hostUserId: string
  ): Promise<MatchPlayerResponseDto> {
    const match = await matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError(`Match ${matchId} not found`);
    }

    if (match.hostUserId !== hostUserId) {
      throw new ForbiddenError('Only the host can respond to join requests');
    }

    const player = await matchRepository.findPlayerById(playerId);
    if (!player) {
      throw new NotFoundError(`Player request ${playerId} not found`);
    }

    if (player.match.id !== matchId) {
      throw new BadRequestError('Player request does not belong to this match');
    }

    if (player.status !== 'PENDING') {
      throw new BadRequestError(`Cannot respond to a ${player.status.toLowerCase()} request`);
    }

    let position: number | undefined;

    if (status === 'ACCEPTED') {
      // Check if slots are available
      const acceptedCount = await matchRepository.countAcceptedPlayers(matchId);
      if (acceptedCount >= match.slotsNeeded) {
        throw new BadRequestError('Match is already full');
      }
      position = await matchRepository.getNextPosition(matchId);
    }

    // Update player status
    const updatedPlayer = await matchRepository.updatePlayerStatus(playerId, status, position);

    // Remove from Redis queue
    await redisService.removeFromMatchJoinQueue(matchId, player.userId);

    // Notify the player about the response
    const userName = this.buildUserName(updatedPlayer.user);
    const notification: MatchRequestResponseNotification = {
      type: 'match_request_response',
      matchId,
      playerId,
      status,
      position: position ?? null,
      message: status === 'ACCEPTED' 
        ? `Your request to join the match has been accepted! Position: ${position}`
        : 'Your request to join the match has been rejected',
    };
    // Send both WebSocket and FCM notifications
    await Promise.all([
      websocketService.notifyMatchPlayer(player.userId, notification),
      notificationService.notifyMatchRequestResponse(
        player.userId,
        matchId,
        match.title || 'Match',
        status === 'ACCEPTED'
      ),
    ]);

    // If accepted, notify all subscribers
    if (status === 'ACCEPTED') {
      const matchNotification: MatchStatusChangeNotification = {
        type: 'match_status_change',
        matchId,
        status: 'PLAYER_JOINED',
        message: `${userName} joined the match`,
      };
      websocketService.notifyMatchSubscribers(matchId, matchNotification);

      // Check if match is now full
      await this.checkAndUpdateMatchFull(matchId);
    }

    return this.mapToPlayerResponse(updatedPlayer);
  }

  /**
   * Leave a match
   */
  async leaveMatch(matchId: string, userId: string): Promise<void> {
    const match = await matchRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError(`Match ${matchId} not found`);
    }

    const player = await matchRepository.findPlayer(matchId, userId);
    if (!player) {
      throw new BadRequestError('You are not a participant in this match');
    }

    if (player.status === 'LEFT') {
      throw new BadRequestError('You have already left this match');
    }

    // Update status to LEFT
    await matchRepository.updatePlayerStatus(player.id, 'LEFT');

    // Remove from Redis queue
    await redisService.removeFromMatchJoinQueue(matchId, userId);

    // Calculate remaining slots
    const acceptedCount = await matchRepository.countAcceptedPlayers(matchId);
    const slotsRemaining = match.slotsNeeded - acceptedCount;

    // Notify subscribers
    const userName = this.buildUserName(player.user);
    const notification: MatchPlayerLeftNotification = {
      type: 'match_player_left',
      matchId,
      userId,
      userName,
      slotsRemaining,
    };
    // Get all participants (excluding the leaving player) to notify
    const acceptedPlayers = await matchRepository.getPlayersByMatchId(matchId, 'ACCEPTED');
    const participantIds = [match.hostUserId, ...acceptedPlayers.map((p) => p.userId)].filter(
      (id) => id !== userId
    );
    // Send both WebSocket and FCM notifications
    await Promise.all([
      websocketService.notifyMatchSubscribers(matchId, notification),
      notificationService.notifyMatchPlayerLeft(participantIds, matchId, match.title || 'Match', userName),
    ]);

    // If match was FULL, reopen it
    if (match.status === 'FULL' && slotsRemaining > 0) {
      await matchRepository.updateStatus(matchId, 'OPEN');
      const statusNotification: MatchStatusChangeNotification = {
        type: 'match_status_change',
        matchId,
        status: 'OPEN',
        message: 'Match is now open for new players',
      };
      websocketService.notifyMatchSubscribers(matchId, statusNotification);
    }
  }

  /**
   * Get matches hosted by a user
   */
  async getHostedMatches(userId: string, status?: MatchStatus): Promise<MatchWithPlayersResponseDto[]> {
    const matches = await matchRepository.findByHostUserId(userId, status);
    return matches.map((m: unknown) => this.mapToMatchWithPlayersResponse(m));
  }

  /**
   * Get matches a user has joined
   */
  async getJoinedMatches(userId: string): Promise<MatchWithPlayersResponseDto[]> {
    const playerEntries = await matchRepository.findByPlayerUserId(userId);
    return playerEntries.map((p: { match: unknown }) => this.mapToMatchWithPlayersResponse(p.match));
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Check if match is full and update status
   */
  private async checkAndUpdateMatchFull(matchId: string): Promise<void> {
    const match = await matchRepository.findById(matchId);
    if (!match) return;

    const acceptedCount = await matchRepository.countAcceptedPlayers(matchId);
    if (acceptedCount >= match.slotsNeeded && match.status === 'OPEN') {
      await matchRepository.updateStatus(matchId, 'FULL');
      
      const notification: MatchStatusChangeNotification = {
        type: 'match_status_change',
        matchId,
        status: 'FULL',
        message: 'Match is now full!',
      };
      websocketService.notifyMatchSubscribers(matchId, notification);
    }
  }

  /**
   * Validate time range
   */
  private validateTimeRange(startTime: string, endTime: string): void {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour! * 60 + startMin!;
    const endMinutes = endHour! * 60 + endMin!;

    if (startMinutes >= endMinutes) {
      throw new BadRequestError('Start time must be before end time');
    }
  }

  /**
   * Validate date is not in the past
   */
  private validateFutureDate(dateStr: string): void {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) {
      throw new BadRequestError('Match date cannot be in the past');
    }
  }

  /**
   * Build user display name with null-safety
   */
  private buildUserName(user?: { firstName?: string | null; lastName?: string | null; username?: string | null; email?: string | null } | null): string {
    if (!user) {
      return 'Unknown';
    }
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`.trim();
    }
    if (user.firstName) {
      return user.firstName;
    }
    if (user.lastName) {
      return user.lastName;
    }
    if (user.username) {
      return user.username;
    }
    if (user.email) {
      return user.email;
    }
    return 'Unknown';
  }

  /**
   * Format time from Date to HH:mm
   */
  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  /**
   * Format date to YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]!;
  }

  /**
   * Build court address string
   */
  private buildCourtAddress(court: {
    addressStreet?: string | null;
    addressWard?: string | null;
    addressDistrict?: string | null;
    addressCity?: string | null;
  }): string {
    const parts = [
      court.addressStreet,
      court.addressWard,
      court.addressDistrict,
      court.addressCity,
    ].filter(Boolean);
    return parts.join(', ');
  }

  /**
   * Map database match to response DTO
   */
  private mapToMatchResponse(match: any): MatchResponseDto {
    const hostName = this.buildUserName(match.host ?? null);
    const acceptedCount = match.players?.filter((p: any) => p.status === 'ACCEPTED').length ?? 0;

    return {
      id: match.id,
      courtId: match.courtId,
      courtName: match.court.name,
      courtAddress: this.buildCourtAddress(match.court),
      hostUserId: match.hostUserId,
      hostName,
      title: match.title,
      description: match.description,
      images: match.images ?? [],
      skillLevel: match.skillLevel,
      shuttleType: match.shuttleType,
      playerFormat: match.playerFormat,
      date: this.formatDate(match.date),
      startTime: this.formatTime(match.startTime),
      endTime: this.formatTime(match.endTime),
      isPrivate: match.isPrivate,
      price: match.price,
      slotsNeeded: match.slotsNeeded,
      slotsAccepted: acceptedCount,
      status: match.status,
      createdAt: match.createdAt.toISOString(),
      updatedAt: match.updatedAt.toISOString(),
    };
  }

  /**
   * Map database player to response DTO
   */
  private mapToPlayerResponse(player: any): MatchPlayerResponseDto {
    return {
      id: player.id,
      matchId: player.matchId,
      userId: player.userId,
      userName: this.buildUserName(player.user),
      userPhotoUrl: player.user.photoUrl,
      status: player.status,
      message: player.message,
      position: player.position,
      requestedAt: player.requestedAt.toISOString(),
      respondedAt: player.respondedAt?.toISOString() ?? null,
    };
  }

  /**
   * Map database match with players to response DTO
   */
  private mapToMatchWithPlayersResponse(match: any): MatchWithPlayersResponseDto {
    return {
      ...this.mapToMatchResponse(match),
      players: (match.players ?? []).map((p: any) => this.mapToPlayerResponse(p)),
    };
  }
}

export const matchService = new MatchService();
