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
      includeExpired = false,
      page = 1,
      limit = 10,
    } = params;
    const skip = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let paramIndex = 1;

    if (courtId) {
      conditions.push(`court_id = $${paramIndex++}::uuid`);
      values.push(courtId);
    }
    if (skillLevel) {
      conditions.push(`skill_level = $${paramIndex++}`);
      values.push(skillLevel);
    }
    if (playerFormat) {
      conditions.push(`player_format = $${paramIndex++}`);
      values.push(playerFormat);
    }
    if (status) {
      conditions.push(`status = $${paramIndex++}::\"MatchStatus\"`);
      values.push(status);
    }

    // Date filtering
    if (date) {
      conditions.push(`date = $${paramIndex++}::date`);
      values.push(date);
    } else if (dateFrom || dateTo) {
      if (dateFrom) {
        conditions.push(`date >= $${paramIndex++}::date`);
        values.push(dateFrom);
      }
      if (dateTo) {
        conditions.push(`date <= $${paramIndex++}::date`);
        values.push(dateTo);
      }
    }

    // Filter out expired matches by default (leverages idx_matches_datetime_end index)
    if (!includeExpired) {
      conditions.push(`(date + end_time) > NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'`);
    }

    const whereClause = conditions.join(' AND ');

    // Execute count and data queries
    const countQuery = `SELECT COUNT(*) as count FROM matches WHERE ${whereClause}`;
    const dataQuery = `
      SELECT 
        m.*,
        (SELECT COUNT(*) FROM match_players WHERE match_id = m.id AND status = 'ACCEPTED') as accepted_count
      FROM matches m
      WHERE ${whereClause}
      ORDER BY m.date ASC, m.start_time ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    values.push(limit, skip);

    const [countResult, matchRows] = await Promise.all([
      prisma.$queryRawUnsafe(countQuery, ...values.slice(0, -2)) as Promise<any[]>,
      prisma.$queryRawUnsafe(dataQuery, ...values) as Promise<any[]>,
    ]);

    const total = parseInt(countResult[0]?.count || '0', 10);

    // Fetch full match data with relations using Prisma
    const matchIds = matchRows.map((row: any) => row.id);
    const matches = await prisma.match.findMany({
      where: { id: { in: matchIds } },
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
    });

    // Maintain order from raw query
    const matchMap = new Map(matches.map(m => [m.id, m]));
    const orderedMatches = matchIds.map(id => matchMap.get(id)).filter(Boolean);

    return { matches: orderedMatches, total, page, limit };
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
  async findByHostUserId(hostUserId: string, status?: MatchStatus, includeExpired = false) {
    const conditions: string[] = ['host_user_id = $1::uuid'];
    const values: any[] = [hostUserId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}::"MatchStatus"`);
      values.push(status);
    }

    // Filter out expired matches by default
    if (!includeExpired) {
      conditions.push(`(date + end_time) > NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'`);
    }

    const whereClause = conditions.join(' AND ');
    const query = `
      SELECT id FROM matches
      WHERE ${whereClause}
      ORDER BY date ASC, start_time ASC
    `;

    const matchRows: any[] = await prisma.$queryRawUnsafe(query, ...values);
    const matchIds = matchRows.map((row: any) => row.id);

    if (matchIds.length === 0) {
      return [];
    }

    const matches = await prisma.match.findMany({
      where: { id: { in: matchIds } },
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

    // Maintain order from raw query
    const matchMap = new Map(matches.map(m => [m.id, m]));
    return matchIds.map(id => matchMap.get(id)).filter(Boolean);
  }

  /**
   * Find matches a user has joined
   */
  async findByPlayerUserId(userId: string, status?: MatchPlayerStatus, includeExpired = false) {
    const conditions: string[] = ['mp.user_id = $1::uuid'];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`mp.status = $${paramIndex++}::"MatchPlayerStatus"`);
      values.push(status);
    }

    // Filter out expired matches by default
    if (!includeExpired) {
      conditions.push(`(m.date + m.end_time) > NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'`);
    }

    const whereClause = conditions.join(' AND ');
    const query = `
      SELECT mp.id FROM match_players mp
      JOIN matches m ON mp.match_id = m.id
      WHERE ${whereClause}
      ORDER BY mp.requested_at DESC
    `;

    const playerRows: any[] = await prisma.$queryRawUnsafe(query, ...values);
    const playerIds = playerRows.map((row: any) => row.id);

    if (playerIds.length === 0) {
      return [];
    }

    const players = await prisma.matchPlayer.findMany({
      where: { id: { in: playerIds } },
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
    });

    // Maintain order from raw query
    const playerMap = new Map(players.map(p => [p.id, p]));
    return playerIds.map(id => playerMap.get(id)).filter(Boolean);
  }

  /**
   * Get match IDs that a user has joined (accepted status only)
   */
  async getJoinedMatchIds(userId: string): Promise<string[]> {
    const players = await prisma.matchPlayer.findMany({
      where: {
        userId,
        status: 'ACCEPTED',
      },
      select: {
        matchId: true,
      },
    });
    return players.map((p) => p.matchId);
  }

  /**
   * Get user's accepted matches on a specific date
   */
  async getAcceptedMatchesByUserAndDate(userId: string, date: Date) {
    return prisma.matchPlayer.findMany({
      where: {
        userId,
        status: 'ACCEPTED',
        match: {
          date: {
            gte: new Date(date.setHours(0, 0, 0, 0)),
            lt: new Date(date.setHours(23, 59, 59, 999)),
          },
        },
      },
      include: {
        match: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            title: true,
          },
        },
      },
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
