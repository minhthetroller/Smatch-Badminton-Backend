import { prisma } from '../config/database.js';
import type { User, Prisma } from '@prisma/client';
import type { AuthProvider, UpdateProfileDto } from '../types/auth.types.js';

export interface CreateUserData {
  firebaseUid: string;
  email?: string | null;
  username?: string | null;
  provider: AuthProvider;
  isAnonymous?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  phoneNumber?: string | null;
  photoUrl?: string | null;
  addressStreet?: string | null;
  addressWard?: string | null;
  addressDistrict?: string | null;
  addressCity?: string | null;
}

export interface BookingHistoryParams {
  userId: string;
  page?: number;
  limit?: number;
  status?: string;
}

export class UserRepository {
  /**
   * Find user by internal UUID
   */
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  /**
   * Find user by Firebase UID
   */
  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { firebaseUid } });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { username } });
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    
    if (!user) return true;
    if (excludeUserId && user.id === excludeUserId) return true;
    return false;
  }

  /**
   * Check if email is already registered
   */
  async isEmailRegistered(email: string, excludeUserId?: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    
    if (!user) return false;
    if (excludeUserId && user.id === excludeUserId) return false;
    return true;
  }

  /**
   * Create a new user
   */
  async create(data: CreateUserData): Promise<User> {
    return prisma.user.create({
      data: {
        firebaseUid: data.firebaseUid,
        email: data.email ?? null,
        username: data.username ?? null,
        provider: data.provider,
        isAnonymous: data.isAnonymous ?? false,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        gender: data.gender ?? null,
        phoneNumber: data.phoneNumber ?? null,
        photoUrl: data.photoUrl ?? null,
        addressStreet: data.addressStreet ?? null,
        addressWard: data.addressWard ?? null,
        addressDistrict: data.addressDistrict ?? null,
        addressCity: data.addressCity ?? null,
      },
    });
  }

  /**
   * Update user profile
   */
  async updateProfile(id: string, data: UpdateProfileDto): Promise<User> {
    const updateData: Prisma.UserUpdateInput = {};

    if (data.username !== undefined) updateData.username = data.username;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
    if (data.addressStreet !== undefined) updateData.addressStreet = data.addressStreet;
    if (data.addressWard !== undefined) updateData.addressWard = data.addressWard;
    if (data.addressDistrict !== undefined) updateData.addressDistrict = data.addressDistrict;
    if (data.addressCity !== undefined) updateData.addressCity = data.addressCity;

    return prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Convert anonymous user to registered user
   */
  async convertAnonymous(
    id: string,
    data: {
      firebaseUid?: string;
      email?: string;
      username?: string;
      provider: AuthProvider;
      profile?: UpdateProfileDto;
    }
  ): Promise<User> {
    const updateData: Prisma.UserUpdateInput = {
      isAnonymous: false,
      provider: data.provider,
    };

    if (data.firebaseUid) updateData.firebaseUid = data.firebaseUid;
    if (data.email) updateData.email = data.email;
    if (data.username) updateData.username = data.username;

    // Merge profile data if provided
    if (data.profile) {
      if (data.profile.firstName !== undefined) updateData.firstName = data.profile.firstName;
      if (data.profile.lastName !== undefined) updateData.lastName = data.profile.lastName;
      if (data.profile.gender !== undefined) updateData.gender = data.profile.gender;
      if (data.profile.phoneNumber !== undefined) updateData.phoneNumber = data.profile.phoneNumber;
      if (data.profile.photoUrl !== undefined) updateData.photoUrl = data.profile.photoUrl;
      if (data.profile.addressStreet !== undefined) updateData.addressStreet = data.profile.addressStreet;
      if (data.profile.addressWard !== undefined) updateData.addressWard = data.profile.addressWard;
      if (data.profile.addressDistrict !== undefined) updateData.addressDistrict = data.profile.addressDistrict;
      if (data.profile.addressCity !== undefined) updateData.addressCity = data.profile.addressCity;
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Update Firebase UID (used when anonymous account is linked)
   */
  async updateFirebaseUid(id: string, newFirebaseUid: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { firebaseUid: newFirebaseUid },
    });
  }

  /**
   * Delete user account
   */
  async delete(id: string): Promise<User> {
    return prisma.user.delete({ where: { id } });
  }

  /**
   * Get user's booking history with pagination
   */
  async getBookingHistory(params: BookingHistoryParams) {
    const { userId, page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = { userId };
    if (status) {
      where.status = status;
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subCourt: {
            include: {
              court: {
                select: {
                  id: true,
                  name: true,
                  addressDistrict: true,
                  addressCity: true,
                },
              },
            },
          },
          payments: {
            select: {
              id: true,
              status: true,
              amount: true,
            },
          },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Link bookings to user (used when converting anonymous or linking by phone)
   */
  async linkBookingsToUser(userId: string, bookingIds: string[]): Promise<number> {
    const result = await prisma.booking.updateMany({
      where: {
        id: { in: bookingIds },
      },
      data: {
        userId,
      },
    });
    return result.count;
  }

  /**
   * Link bookings by guest phone to user
   */
  async linkBookingsByPhone(userId: string, phoneNumber: string): Promise<number> {
    const result = await prisma.booking.updateMany({
      where: {
        guestPhone: phoneNumber,
        userId: null,
      },
      data: {
        userId,
      },
    });
    return result.count;
  }

  /**
   * Link bookings by guest email to user
   */
  async linkBookingsByEmail(userId: string, email: string): Promise<number> {
    const result = await prisma.booking.updateMany({
      where: {
        guestEmail: email,
        userId: null,
      },
      data: {
        userId,
      },
    });
    return result.count;
  }

  /**
   * Count users (for admin stats)
   */
  async countUsers(filters?: { isAnonymous?: boolean; provider?: AuthProvider }): Promise<number> {
    return prisma.user.count({
      where: filters,
    });
  }

  // ==================== FCM TOKEN METHODS ====================

  /**
   * Add FCM token to user (avoid duplicates)
   */
  async addFcmToken(userId: string, token: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Avoid adding duplicate tokens
    if (user.fcmTokens.includes(token)) {
      return user;
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        fcmTokens: {
          push: token,
        },
      },
    });
  }

  /**
   * Remove FCM token from user
   */
  async removeFcmToken(userId: string, token: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const updatedTokens = user.fcmTokens.filter((t) => t !== token);

    return prisma.user.update({
      where: { id: userId },
      data: {
        fcmTokens: updatedTokens,
      },
    });
  }

  /**
   * Remove all FCM tokens for a user
   */
  async clearFcmTokens(userId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        fcmTokens: [],
      },
    });
  }

  /**
   * Remove invalid FCM tokens from all users
   */
  async removeInvalidTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;

    // Find users with these tokens
    const users = await prisma.user.findMany({
      where: {
        fcmTokens: {
          hasSome: tokens,
        },
      },
      select: {
        id: true,
        fcmTokens: true,
      },
    });

    // Update each user to remove invalid tokens
    await Promise.all(
      users.map((user) => {
        const validTokens = user.fcmTokens.filter((t) => !tokens.includes(t));
        return prisma.user.update({
          where: { id: user.id },
          data: { fcmTokens: validTokens },
        });
      })
    );
  }
}

export const userRepository = new UserRepository();

