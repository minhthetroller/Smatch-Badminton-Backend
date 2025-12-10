import type { User } from '@prisma/client';
import type {
  AuthProvider,
  DecodedFirebaseToken,
  UserProfileDto,
  VerifyTokenDto,
  CreateAnonymousDto,
  ConvertAnonymousDto,
  UpdateProfileDto,
  CheckUsernameDto,
  LookupUsernameDto,
} from '../../types/auth.types.js';

// ==================== User IDs ====================

export const validUserId = '550e8400-e29b-41d4-a716-446655440001';
export const validUserId2 = '550e8400-e29b-41d4-a716-446655440002';
export const anonymousUserId = '550e8400-e29b-41d4-a716-446655440003';
export const nonExistentUserId = '550e8400-e29b-41d4-a716-446655440999';

// ==================== Firebase UIDs ====================

export const googleFirebaseUid = 'google-firebase-uid-123';
export const facebookFirebaseUid = 'facebook-firebase-uid-456';
export const passwordFirebaseUid = 'password-firebase-uid-789';
export const anonymousFirebaseUid = 'anonymous-firebase-uid-000';
export const newFirebaseUid = 'new-firebase-uid-999';

// ==================== Mock Firebase Tokens ====================

export const mockGoogleIdToken = 'mock-google-id-token-valid';
export const mockFacebookIdToken = 'mock-facebook-id-token-valid';
export const mockPasswordIdToken = 'mock-password-id-token-valid';
export const mockAnonymousIdToken = 'mock-anonymous-id-token-valid';
export const mockExpiredIdToken = 'mock-expired-id-token';
export const mockInvalidIdToken = 'mock-invalid-id-token';

// ==================== Decoded Firebase Tokens ====================

export const decodedGoogleToken: DecodedFirebaseToken = {
  uid: googleFirebaseUid,
  email: 'googleuser@gmail.com',
  email_verified: true,
  name: 'Google User',
  picture: 'https://lh3.googleusercontent.com/photo.jpg',
  firebase: {
    sign_in_provider: 'google.com',
    identities: {
      'google.com': ['google-id-123'],
      email: ['googleuser@gmail.com'],
    },
  },
};

export const decodedFacebookToken: DecodedFirebaseToken = {
  uid: facebookFirebaseUid,
  email: 'fbuser@example.com',
  email_verified: true,
  name: 'Facebook User',
  picture: 'https://graph.facebook.com/photo.jpg',
  firebase: {
    sign_in_provider: 'facebook.com',
    identities: {
      'facebook.com': ['facebook-id-456'],
      email: ['fbuser@example.com'],
    },
  },
};

export const decodedPasswordToken: DecodedFirebaseToken = {
  uid: passwordFirebaseUid,
  email: 'emailuser@example.com',
  email_verified: false,
  firebase: {
    sign_in_provider: 'password',
    identities: {
      email: ['emailuser@example.com'],
    },
  },
};

export const decodedAnonymousToken: DecodedFirebaseToken = {
  uid: anonymousFirebaseUid,
  firebase: {
    sign_in_provider: 'anonymous',
    identities: {},
  },
};

// ==================== Sample Users (Prisma format) ====================

const baseDate = new Date('2024-01-15T10:00:00Z');
const updatedDate = new Date('2024-01-20T15:30:00Z');

export const sampleGoogleUser: User = {
  id: validUserId,
  firebaseUid: googleFirebaseUid,
  email: 'googleuser@gmail.com',
  username: 'googleuser',
  provider: 'google',
  isAnonymous: false,
  firstName: 'Google',
  lastName: 'User',
  gender: 'male',
  phoneNumber: '0901234567',
  photoUrl: 'https://lh3.googleusercontent.com/photo.jpg',
  addressStreet: '123 Google Street',
  addressWard: 'Phường Bến Nghé',
  addressDistrict: 'Quận 1',
  addressCity: 'Hồ Chí Minh',
  createdAt: baseDate,
  updatedAt: updatedDate,
};

export const sampleFacebookUser: User = {
  id: validUserId2,
  firebaseUid: facebookFirebaseUid,
  email: 'fbuser@example.com',
  username: 'fbuser',
  provider: 'facebook',
  isAnonymous: false,
  firstName: 'Facebook',
  lastName: 'User',
  gender: 'female',
  phoneNumber: '0912345678',
  photoUrl: 'https://graph.facebook.com/photo.jpg',
  addressStreet: null,
  addressWard: null,
  addressDistrict: 'Quận Ba Đình',
  addressCity: 'Hà Nội',
  createdAt: baseDate,
  updatedAt: updatedDate,
};

export const samplePasswordUser: User = {
  id: '550e8400-e29b-41d4-a716-446655440004',
  firebaseUid: passwordFirebaseUid,
  email: 'emailuser@example.com',
  username: 'emailuser',
  provider: 'password',
  isAnonymous: false,
  firstName: 'Email',
  lastName: 'User',
  gender: null,
  phoneNumber: null,
  photoUrl: null,
  addressStreet: null,
  addressWard: null,
  addressDistrict: null,
  addressCity: 'Hà Nội',
  createdAt: baseDate,
  updatedAt: updatedDate,
};

export const sampleAnonymousUser: User = {
  id: anonymousUserId,
  firebaseUid: anonymousFirebaseUid,
  email: null,
  username: null,
  provider: 'anonymous',
  isAnonymous: true,
  firstName: null,
  lastName: null,
  gender: null,
  phoneNumber: null,
  photoUrl: null,
  addressStreet: null,
  addressWard: null,
  addressDistrict: null,
  addressCity: 'Hà Nội',
  createdAt: baseDate,
  updatedAt: updatedDate,
};

// ==================== User Profile DTOs (Response format) ====================

export const googleUserProfileDto: UserProfileDto = {
  id: validUserId,
  firebaseUid: googleFirebaseUid,
  email: 'googleuser@gmail.com',
  username: 'googleuser',
  provider: 'google',
  isAnonymous: false,
  firstName: 'Google',
  lastName: 'User',
  gender: 'male',
  phoneNumber: '0901234567',
  photoUrl: 'https://lh3.googleusercontent.com/photo.jpg',
  address: {
    street: '123 Google Street',
    ward: 'Phường Bến Nghé',
    district: 'Quận 1',
    city: 'Hồ Chí Minh',
  },
  createdAt: baseDate.toISOString(),
  updatedAt: updatedDate.toISOString(),
};

export const anonymousUserProfileDto: UserProfileDto = {
  id: anonymousUserId,
  firebaseUid: anonymousFirebaseUid,
  email: null,
  username: null,
  provider: 'anonymous',
  isAnonymous: true,
  firstName: null,
  lastName: null,
  gender: null,
  phoneNumber: null,
  photoUrl: null,
  address: null,
  createdAt: baseDate.toISOString(),
  updatedAt: updatedDate.toISOString(),
};

// ==================== Request DTOs ====================

export const verifyGoogleTokenDto: VerifyTokenDto = {
  idToken: mockGoogleIdToken,
};

export const verifyFacebookTokenDto: VerifyTokenDto = {
  idToken: mockFacebookIdToken,
};

export const verifyPasswordTokenDto: VerifyTokenDto = {
  idToken: mockPasswordIdToken,
  profile: {
    username: 'newuser',
    firstName: 'New',
    lastName: 'User',
  },
};

export const createAnonymousDto: CreateAnonymousDto = {
  firebaseUid: anonymousFirebaseUid,
};

export const convertAnonymousDto: ConvertAnonymousDto = {
  provider: 'google',
  newFirebaseUid: newFirebaseUid,
  email: 'converted@example.com',
  username: 'converteduser',
  profile: {
    firstName: 'Converted',
    lastName: 'User',
  },
};

export const updateProfileDto: UpdateProfileDto = {
  firstName: 'Updated',
  lastName: 'Name',
  phoneNumber: '0987654321',
  gender: 'other',
};

export const checkUsernameDto: CheckUsernameDto = {
  username: 'newusername',
};

export const lookupUsernameDto: LookupUsernameDto = {
  username: 'googleuser',
};

// ==================== Invalid/Edge Case Data ====================

export const invalidUsernameFormats = [
  'ab',              // Too short (< 3)
  'a'.repeat(51),    // Too long (> 50)
  'user name',       // Contains space
  'user@name',       // Contains @ symbol
  'user-name',       // Contains hyphen
  'ユーザー',          // Non-ASCII characters
];

export const validUsernameFormats = [
  'abc',             // Minimum valid length
  'user_name',       // Contains underscore
  'User123',         // Mixed case with numbers
  'a'.repeat(50),    // Maximum valid length
];

// ==================== Mock Booking Data for History ====================

export const sampleBookingHistory = [
  {
    id: '660e8400-e29b-41d4-a716-446655440001',
    date: new Date('2024-02-01'),
    startTime: new Date('1970-01-01T09:00:00Z'),
    endTime: new Date('1970-01-01T11:00:00Z'),
    totalPrice: 200000,
    status: 'completed',
    notes: null,
    createdAt: new Date('2024-01-25T10:00:00Z'),
    subCourt: {
      id: '770e8400-e29b-41d4-a716-446655440001',
      name: 'Sân 1',
      court: {
        id: '880e8400-e29b-41d4-a716-446655440001',
        name: 'Sân cầu lông ABC',
        addressDistrict: 'Quận 1',
        addressCity: 'Hồ Chí Minh',
      },
    },
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440002',
    date: new Date('2024-02-05'),
    startTime: new Date('1970-01-01T14:00:00Z'),
    endTime: new Date('1970-01-01T16:00:00Z'),
    totalPrice: 250000,
    status: 'pending',
    notes: 'Bring your own racket',
    createdAt: new Date('2024-02-01T10:00:00Z'),
    subCourt: {
      id: '770e8400-e29b-41d4-a716-446655440002',
      name: 'Sân 2',
      court: {
        id: '880e8400-e29b-41d4-a716-446655440001',
        name: 'Sân cầu lông ABC',
        addressDistrict: 'Quận 1',
        addressCity: 'Hồ Chí Minh',
      },
    },
  },
];

// ==================== Helper Functions ====================

/**
 * Create a mock decoded token for any provider
 */
export function createMockDecodedToken(
  provider: AuthProvider,
  uid: string,
  email?: string,
  name?: string
): DecodedFirebaseToken {
  const signInProvider = provider === 'google' ? 'google.com' 
    : provider === 'facebook' ? 'facebook.com' 
    : provider === 'anonymous' ? 'anonymous'
    : 'password';
    
  return {
    uid,
    email,
    name,
    firebase: {
      sign_in_provider: signInProvider,
      identities: email ? { email: [email] } : {},
    },
  };
}

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: validUserId,
    firebaseUid: googleFirebaseUid,
    email: 'test@example.com',
    username: 'testuser',
    provider: 'google',
    isAnonymous: false,
    firstName: 'Test',
    lastName: 'User',
    gender: null,
    phoneNumber: null,
    photoUrl: null,
    addressStreet: null,
    addressWard: null,
    addressDistrict: null,
    addressCity: 'Hà Nội',
    createdAt: baseDate,
    updatedAt: updatedDate,
    ...overrides,
  };
}

