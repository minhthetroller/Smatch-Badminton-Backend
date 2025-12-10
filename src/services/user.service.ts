import { userRepository } from '../repositories/user.repository.js';
import { firebaseService } from './firebase.service.js';
import { AppError } from '../utils/errors.js';
import type { User } from '@prisma/client';
import type {
  AuthProvider,
  UpdateProfileDto,
  ConvertAnonymousDto,
  DecodedFirebaseToken,
  BookingHistoryItemDto,
  BookingHistoryResponseDto,
  UserProfileDto,
  mapUserToDto,
} from '../types/auth.types.js';
import { mapUserToDto as mapUser } from '../types/auth.types.js';

export class UserService {
  /**
   * Verify token and create/get user
   * Main entry point for authentication
   */
  async verifyAndGetUser(
    idToken: string,
    profileData?: UpdateProfileDto
  ): Promise<{ user: User; isNewUser: boolean }> {
    // Verify the Firebase token
    const decodedToken = await firebaseService.verifyIdToken(idToken);
    
    // Check if user already exists
    let user = await userRepository.findByFirebaseUid(decodedToken.uid);
    let isNewUser = false;

    if (!user) {
      // Create new user
      const provider = firebaseService.getProviderFromToken(decodedToken);
      const isAnonymous = firebaseService.isAnonymousToken(decodedToken);

      user = await userRepository.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email ?? null,
        provider,
        isAnonymous,
        firstName: profileData?.firstName ?? (decodedToken.name?.split(' ')[0] ?? null),
        lastName: profileData?.lastName ?? (decodedToken.name?.split(' ').slice(1).join(' ') ?? null),
        phoneNumber: profileData?.phoneNumber ?? decodedToken.phone_number ?? null,
        photoUrl: profileData?.photoUrl ?? decodedToken.picture ?? null,
        username: profileData?.username ?? null,
        gender: profileData?.gender ?? null,
        addressStreet: profileData?.addressStreet ?? null,
        addressWard: profileData?.addressWard ?? null,
        addressDistrict: profileData?.addressDistrict ?? null,
        addressCity: profileData?.addressCity ?? null,
      });
      isNewUser = true;

      // Auto-link bookings by email if registered with email
      if (user.email) {
        await userRepository.linkBookingsByEmail(user.id, user.email);
      }
      // Auto-link bookings by phone if provided
      if (user.phoneNumber) {
        await userRepository.linkBookingsByPhone(user.id, user.phoneNumber);
      }
    } else if (profileData) {
      // Update existing user profile if data provided
      user = await userRepository.updateProfile(user.id, profileData);
    }

    return { user, isNewUser };
  }

  /**
   * Create or get anonymous user
   */
  async createAnonymousUser(firebaseUid: string): Promise<{ user: User; isNewUser: boolean }> {
    // Check if user already exists
    let user = await userRepository.findByFirebaseUid(firebaseUid);
    
    if (user) {
      return { user, isNewUser: false };
    }

    // Create new anonymous user
    user = await userRepository.create({
      firebaseUid,
      provider: 'anonymous',
      isAnonymous: true,
    });

    return { user, isNewUser: true };
  }

  /**
   * Convert anonymous user to registered user
   */
  async convertAnonymousUser(
    currentUserId: string,
    data: ConvertAnonymousDto
  ): Promise<User> {
    const user = await userRepository.findById(currentUserId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!user.isAnonymous) {
      throw new AppError('User is not anonymous', 400, 'NOT_ANONYMOUS');
    }

    // Check if email is already registered
    if (data.email) {
      const emailExists = await userRepository.isEmailRegistered(data.email, currentUserId);
      if (emailExists) {
        throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
      }
    }

    // Check if username is available
    if (data.username) {
      const usernameAvailable = await userRepository.isUsernameAvailable(data.username, currentUserId);
      if (!usernameAvailable) {
        throw new AppError('Username already taken', 409, 'USERNAME_TAKEN');
      }
    }

    // Convert the user
    const updatedUser = await userRepository.convertAnonymous(currentUserId, {
      firebaseUid: data.newFirebaseUid,
      email: data.email,
      username: data.username,
      provider: data.provider,
      profile: data.profile,
    });

    // Auto-link bookings by email if now registered with email
    if (updatedUser.email) {
      await userRepository.linkBookingsByEmail(updatedUser.id, updatedUser.email);
    }
    // Auto-link bookings by phone if provided
    if (updatedUser.phoneNumber) {
      await userRepository.linkBookingsByPhone(updatedUser.id, updatedUser.phoneNumber);
    }

    return updatedUser;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return userRepository.findById(id);
  }

  /**
   * Get user by Firebase UID
   */
  async getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return userRepository.findByFirebaseUid(firebaseUid);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateProfileDto): Promise<User> {
    const user = await userRepository.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check username availability if changing
    if (data.username && data.username !== user.username) {
      const usernameAvailable = await userRepository.isUsernameAvailable(data.username, userId);
      if (!usernameAvailable) {
        throw new AppError('Username already taken', 409, 'USERNAME_TAKEN');
      }
    }

    return userRepository.updateProfile(userId, data);
  }

  /**
   * Check username availability
   */
  async checkUsernameAvailability(username: string): Promise<boolean> {
    return userRepository.isUsernameAvailable(username);
  }

  /**
   * Lookup email by username (for login flow)
   */
  async lookupEmailByUsername(username: string): Promise<string | null> {
    const user = await userRepository.findByUsername(username);
    return user?.email ?? null;
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await userRepository.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Delete from Firebase first
    await firebaseService.deleteFirebaseUser(user.firebaseUid);
    
    // Delete from database (bookings will have userId set to null due to onDelete: SetNull)
    await userRepository.delete(userId);
  }

  /**
   * Get user's booking history with pagination
   */
  async getBookingHistory(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: string
  ): Promise<BookingHistoryResponseDto> {
    const user = await userRepository.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const result = await userRepository.getBookingHistory({
      userId,
      page,
      limit,
      status,
    });

    // Map bookings to DTOs
    const bookings: BookingHistoryItemDto[] = result.bookings.map((booking) => ({
      id: booking.id,
      date: booking.date.toISOString().split('T')[0] ?? '',
      startTime: this.formatTime(booking.startTime),
      endTime: this.formatTime(booking.endTime),
      totalPrice: booking.totalPrice,
      status: booking.status,
      notes: booking.notes,
      createdAt: booking.createdAt.toISOString(),
      court: {
        id: booking.subCourt.court.id,
        name: booking.subCourt.court.name,
        addressDistrict: booking.subCourt.court.addressDistrict,
        addressCity: booking.subCourt.court.addressCity,
      },
      subCourt: {
        id: booking.subCourt.id,
        name: booking.subCourt.name,
      },
    }));

    return {
      bookings,
      pagination: result.pagination,
    };
  }

  /**
   * Link existing bookings to user by phone number
   */
  async linkBookingsByPhone(userId: string, phoneNumber: string): Promise<number> {
    return userRepository.linkBookingsByPhone(userId, phoneNumber);
  }

  /**
   * Link existing bookings to user by email
   */
  async linkBookingsByEmail(userId: string, email: string): Promise<number> {
    return userRepository.linkBookingsByEmail(userId, email);
  }

  /**
   * Format time from Date to HH:mm string
   */
  private formatTime(date: Date): string {
    return date.toISOString().substring(11, 16);
  }
}

export const userService = new UserService();

