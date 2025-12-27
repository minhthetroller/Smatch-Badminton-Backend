/**
 * Match Repository
 * Data access layer for Match and MatchPlayer entities
 */

import { prisma } from '../config/database.js';
import type { Prisma, MatchPlayerStatus, MatchStatus } from '@prisma/client';
import type {
  CreateMatchDto,
  UpdateMatchDto,
  MatchQueryParams,
} from '../types/match.types.js';

export class MatchRepository {
  /**
   * Create a new match
   */
  async create(data: CreateMatchDto, hostUserId: string) {
    return prisma.match.create({
      data: {
        courtId: data.courtId,
        hostUserId,
        title: data.title,
        description: data.description,
        images: data.images ?? [],
        skillLevel: data.skillLevel,
        shuttleType: data.shuttleType,
        playerFormat: data.playerFormat,
        date: new Date(data.date),
        startTime: this.timeToDate(data.startTime),
        endTime: this.timeToDate(data.endTime),
        isPrivate: data.isPrivate ?? false,
        price: data.price,
        slotsNeeded: data.slotsNeeded,
        status: 'OPEN',
      },
      include: {
        court: true,
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find match by ID with relations
   */
  async findById(id: string) {
    return prisma.match.findUnique({
      where: { id },
      include: {
        court: true,
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
        players: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
              },
            },
          },
          orderBy: { requestedAt: 'asc' },
        },
      },
    });
  }

  /**
   * Find all matches with filters and pagination
   */
  async findAll(params: MatchQueryParams) {
    const {
      courtId,
      skillLevel,
      playerFormat,
      status,
      date,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.MatchWhereInput = {};

    if (courtId) where.courtId = courtId;
    if (skillLevel) where.skillLevel = skillLevel;
    if (playerFormat) where.playerFormat = playerFormat;
    if (status) where.status = status;

    // Date filtering
    if (date) {
      where.date = new Date(date);
    } else if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        include: {
          court: true,
          host: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              photoUrl: true,
            },
          },
          players: {
            where: { status: 'ACCEPTED' },
            select: { id: true },
          },
        },
      }),
      prisma.match.count({ where }),
    ]);

    return { matches, total, page, limit };
  }

  /**
   * Update a match
   */
  async update(id: string, data: UpdateMatchDto) {
    const updateData: Prisma.MatchUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.images !== undefined) updateData.images = data.images;
    if (data.skillLevel !== undefined) updateData.skillLevel = data.skillLevel;
    if (data.shuttleType !== undefined) updateData.shuttleType = data.shuttleType;
    if (data.playerFormat !== undefined) updateData.playerFormat = data.playerFormat;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.startTime !== undefined) updateData.startTime = this.timeToDate(data.startTime);
    if (data.endTime !== undefined) updateData.endTime = this.timeToDate(data.endTime);
    if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.slotsNeeded !== undefined) updateData.slotsNeeded = data.slotsNeeded;
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.match.update({
      where: { id },
      data: updateData,
      include: {
        court: true,
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });
  }

  /**
   * Update match status
   */
  async updateStatus(id: string, status: MatchStatus) {
    return prisma.match.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Delete a match
   */
  async delete(id: string) {
    return prisma.match.delete({ where: { id } });
  }

  // ==================== MATCH PLAYER METHODS ====================

  /**
   * Add a player to a match (create join request)
   */
  async addPlayer(matchId: string, userId: string, message?: string, status: MatchPlayerStatus = 'PENDING') {
    return prisma.matchPlayer.create({
      data: {
        matchId,
        userId,
        message,
        status,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find a player entry
   */
  async findPlayer(matchId: string, userId: string) {
    return prisma.matchPlayer.findUnique({
      where: {
        matchId_userId: { matchId, userId },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find player by ID
   */
  async findPlayerById(playerId: string) {
    return prisma.matchPlayer.findUnique({
      where: { id: playerId },
      include: {
        match: {
          select: {
            id: true,
            hostUserId: true,
            isPrivate: true,
            slotsNeeded: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });
  }

  /**
   * Update player status (accept/reject)
   */
  async updatePlayerStatus(playerId: string, status: MatchPlayerStatus, position?: number) {
    return prisma.matchPlayer.update({
      where: { id: playerId },
      data: {
        status,
        position,
        respondedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });
  }

  /**
   * Remove a player from a match
   */
  async removePlayer(matchId: string, userId: string) {
    return prisma.matchPlayer.delete({
      where: {
        matchId_userId: { matchId, userId },
      },
    });
  }

  /**
   * Get all players for a match
   */
  async getPlayersByMatchId(matchId: string, status?: MatchPlayerStatus) {
    const where: Prisma.MatchPlayerWhereInput = { matchId };
    if (status) where.status = status;

    return prisma.matchPlayer.findMany({
      where,
      orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
      },
    });
  }

  /**
   * Count accepted players for a match
   */
  async countAcceptedPlayers(matchId: string): Promise<number> {
    return prisma.matchPlayer.count({
      where: {
        matchId,
        status: 'ACCEPTED',
      },
    });
  }

  /**
   * Get the next available position for a player
   */
  async getNextPosition(matchId: string): Promise<number> {
    const maxPosition = await prisma.matchPlayer.aggregate({
      where: {
        matchId,
        status: 'ACCEPTED',
      },
      _max: {
        position: true,
      },
    });

    return (maxPosition._max.position ?? 0) + 1;
  }

  /**
   * Find matches hosted by a user
   */
  async findByHostUserId(hostUserId: string, status?: MatchStatus) {
    const where: Prisma.MatchWhereInput = { hostUserId };
    if (status) where.status = status;

    return prisma.match.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: {
        court: true,
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
          },
        },
        players: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find matches a user has joined
   */
  async findByPlayerUserId(userId: string, status?: MatchPlayerStatus) {
    const where: Prisma.MatchPlayerWhereInput = { userId };
    if (status) where.status = status;

    return prisma.matchPlayer.findMany({
      where,
      include: {
        match: {
          include: {
            court: true,
            host: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                photoUrl: true,
              },
            },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  // ==================== HELPERS ====================

  /**
   * Convert time string (HH:mm) to Date object for Prisma
   */
  private timeToDate(time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date('1970-01-01');
    date.setHours(hours!, minutes!, 0, 0);
    return date;
  }
}

export const matchRepository = new MatchRepository();
