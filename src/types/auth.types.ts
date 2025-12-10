import type { User, Booking } from '@prisma/client';

// ==================== Provider Types ====================

export type AuthProvider = 'google' | 'facebook' | 'password' | 'anonymous';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

// ==================== Request DTOs ====================

/**
 * Token verification request - used when frontend sends Firebase ID token
 */
export interface VerifyTokenDto {
  idToken: string;
  /** Optional profile data to update on verification */
  profile?: UpdateProfileDto;
}

/**
 * Create anonymous user request
 */
export interface CreateAnonymousDto {
  /** Firebase anonymous UID from client */
  firebaseUid: string;
}

/**
 * Convert anonymous user to registered user
 */
export interface ConvertAnonymousDto {
  /** New Firebase UID after linking/upgrading account */
  newFirebaseUid?: string;
  /** Provider used for upgrade */
  provider: Exclude<AuthProvider, 'anonymous'>;
  /** Email (required for password/email providers) */
  email?: string;
  /** Username (optional) */
  username?: string;
  /** Profile data to set */
  profile?: UpdateProfileDto;
}

/**
 * Update user profile request
 */
export interface UpdateProfileDto {
  username?: string;
  firstName?: string;
  lastName?: string;
  gender?: Gender;
  phoneNumber?: string;
  photoUrl?: string;
  addressStreet?: string;
  addressWard?: string;
  addressDistrict?: string;
  addressCity?: string;
}

/**
 * Check username availability request
 */
export interface CheckUsernameDto {
  username: string;
}

/**
 * Lookup email by username request
 */
export interface LookupUsernameDto {
  username: string;
}

// ==================== Response DTOs ====================

/**
 * User profile response - excludes sensitive internal fields
 */
export interface UserProfileDto {
  id: string;
  firebaseUid: string;
  email: string | null;
  username: string | null;
  provider: AuthProvider;
  isAnonymous: boolean;
  firstName: string | null;
  lastName: string | null;
  gender: Gender | null;
  phoneNumber: string | null;
  photoUrl: string | null;
  address: UserAddressDto | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * User address response
 */
export interface UserAddressDto {
  street: string | null;
  ward: string | null;
  district: string | null;
  city: string | null;
}

/**
 * Auth verification response
 */
export interface AuthResponseDto {
  user: UserProfileDto;
  isNewUser: boolean;
}

/**
 * Username availability response
 */
export interface UsernameAvailabilityDto {
  username: string;
  available: boolean;
}

/**
 * Username lookup response (returns email for login)
 */
export interface UsernameLookupDto {
  username: string;
  email: string;
}

/**
 * Booking history item for user
 */
export interface BookingHistoryItemDto {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: string;
  notes: string | null;
  createdAt: string;
  court: {
    id: string;
    name: string;
    addressDistrict: string | null;
    addressCity: string | null;
  };
  subCourt: {
    id: string;
    name: string;
  };
}

/**
 * Booking history response with pagination
 */
export interface BookingHistoryResponseDto {
  bookings: BookingHistoryItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==================== Internal Types ====================

/**
 * Decoded Firebase token payload
 */
export interface DecodedFirebaseToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  name?: string;
  picture?: string;
  firebase: {
    sign_in_provider: string;
    identities: Record<string, unknown>;
  };
}

/**
 * User with bookings relation
 */
export type UserWithBookings = User & {
  bookings: Booking[];
};

/**
 * Express request with authenticated user
 */
export interface AuthenticatedRequest {
  user?: UserProfileDto;
  firebaseToken?: DecodedFirebaseToken;
}

// ==================== Mapper Functions ====================

/**
 * Map Prisma User to UserProfileDto
 */
export function mapUserToDto(user: User): UserProfileDto {
  const hasAddress = user.addressStreet || user.addressWard || user.addressDistrict || user.addressCity;
  
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    username: user.username,
    provider: user.provider as AuthProvider,
    isAnonymous: user.isAnonymous,
    firstName: user.firstName,
    lastName: user.lastName,
    gender: user.gender as Gender | null,
    phoneNumber: user.phoneNumber,
    photoUrl: user.photoUrl,
    address: hasAddress
      ? {
          street: user.addressStreet,
          ward: user.addressWard,
          district: user.addressDistrict,
          city: user.addressCity,
        }
      : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

