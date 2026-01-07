import type { 
  SkillLevel, 
  ShuttleType, 
  PlayerFormat, 
  MatchStatus,
  MatchPlayerStatus 
} from '@prisma/client';

/**
 * Match Test Fixtures
 * Sample data for testing match creation, joining, and management
 */

// Sample Match IDs
export const MATCH_ID_PUBLIC = '550e8400-e29b-41d4-a716-446655440001';
export const MATCH_ID_PRIVATE = '550e8400-e29b-41d4-a716-446655440002';
export const MATCH_ID_FREE = '550e8400-e29b-41d4-a716-446655440003';
export const MATCH_ID_FULL = '550e8400-e29b-41d4-a716-446655440004';
export const MATCH_ID_CANCELLED = '550e8400-e29b-41d4-a716-446655440005';
export const MATCH_ID_WITH_IMAGES = '550e8400-e29b-41d4-a716-446655440006';
export const MATCH_ID_CONFLICT_1 = '550e8400-e29b-41d4-a716-446655440007';
export const MATCH_ID_CONFLICT_2 = '550e8400-e29b-41d4-a716-446655440008';

// Sample MatchPlayer IDs
export const MATCH_PLAYER_ID_1 = '660e8400-e29b-41d4-a716-446655440001';
export const MATCH_PLAYER_ID_2 = '660e8400-e29b-41d4-a716-446655440002';
export const MATCH_PLAYER_ID_PENDING = '660e8400-e29b-41d4-a716-446655440003';
export const MATCH_PLAYER_ID_PAYMENT = '660e8400-e29b-41d4-a716-446655440004';

// Sample Court IDs
export const COURT_ID_1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
export const COURT_ID_2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

// Sample User IDs for matches
export const HOST_USER_ID = '770e8400-e29b-41d4-a716-446655440001';
export const PLAYER_USER_ID_1 = '770e8400-e29b-41d4-a716-446655440002';
export const PLAYER_USER_ID_2 = '770e8400-e29b-41d4-a716-446655440003';
export const PLAYER_USER_ID_3 = '770e8400-e29b-41d4-a716-446655440004';

// Test Dates
export const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

export const TOMORROW = new Date(TODAY);
TOMORROW.setDate(TOMORROW.getDate() + 1);

export const NEXT_WEEK = new Date(TODAY);
NEXT_WEEK.setDate(NEXT_WEEK.getDate() + 7);

// Test Times (as Date objects for Prisma)
export function createTimeDate(hours: number, minutes: number): Date {
  const date = new Date('1970-01-01');
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// S3 URLs for test images
export const SAMPLE_IMAGE_URLS = [
  'http://localhost:4566/smatch-matches-test/matches/test-match-1/image1.jpg',
  'http://localhost:4566/smatch-matches-test/matches/test-match-1/image2.jpg',
  'http://localhost:4566/smatch-matches-test/matches/test-match-1/image3.jpg',
];

export const SAMPLE_PROFILE_IMAGE_URL = 'http://localhost:4566/smatch-profiles-test/users/test-user/profile.jpg';

// Sample Matches
export const samplePublicMatch = {
  id: MATCH_ID_PUBLIC,
  courtId: COURT_ID_1,
  hostUserId: HOST_USER_ID,
  title: 'Đánh giao lưu cuối tuần',
  description: 'Tìm bạn đánh giao lưu level TB+',
  images: [],
  skillLevel: 'TB_PLUS' as SkillLevel,
  shuttleType: 'TC77' as ShuttleType,
  playerFormat: 'DOUBLE_MALE' as PlayerFormat,
  date: TOMORROW,
  startTime: createTimeDate(18, 0),
  endTime: createTimeDate(20, 0),
  isPrivate: false,
  price: 50000,
  slotsNeeded: 3,
  status: 'OPEN' as MatchStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const samplePrivateMatch = {
  id: MATCH_ID_PRIVATE,
  courtId: COURT_ID_1,
  hostUserId: HOST_USER_ID,
  title: 'Tập luyện nghiêm túc',
  description: 'Tìm người chơi level K, có kinh nghiệm thi đấu',
  images: [],
  skillLevel: 'K' as SkillLevel,
  shuttleType: 'YONEX_AS40' as ShuttleType,
  playerFormat: 'MIXED_DOUBLE' as PlayerFormat,
  date: NEXT_WEEK,
  startTime: createTimeDate(19, 0),
  endTime: createTimeDate(21, 0),
  isPrivate: true,
  price: 75000,
  slotsNeeded: 2,
  status: 'OPEN' as MatchStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const sampleFreeMatch = {
  id: MATCH_ID_FREE,
  courtId: COURT_ID_2,
  hostUserId: HOST_USER_ID,
  title: 'Đánh giao lưu free',
  description: 'Mình đã book sân, tìm người chơi cùng không thu tiền',
  images: [],
  skillLevel: 'TB' as SkillLevel,
  shuttleType: 'TC77' as ShuttleType,
  playerFormat: 'ANY' as PlayerFormat,
  date: TOMORROW,
  startTime: createTimeDate(14, 0),
  endTime: createTimeDate(16, 0),
  isPrivate: false,
  price: 0,
  slotsNeeded: 3,
  status: 'OPEN' as MatchStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const sampleFullMatch = {
  id: MATCH_ID_FULL,
  courtId: COURT_ID_1,
  hostUserId: HOST_USER_ID,
  title: 'Match đã đủ người',
  description: null,
  images: [],
  skillLevel: 'TB_PLUS' as SkillLevel,
  shuttleType: 'TC77' as ShuttleType,
  playerFormat: 'DOUBLE_MALE' as PlayerFormat,
  date: TOMORROW,
  startTime: createTimeDate(10, 0),
  endTime: createTimeDate(12, 0),
  isPrivate: false,
  price: 50000,
  slotsNeeded: 2,
  status: 'FULL' as MatchStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const sampleMatchWithImages = {
  id: MATCH_ID_WITH_IMAGES,
  courtId: COURT_ID_1,
  hostUserId: HOST_USER_ID,
  title: 'Match có hình ảnh',
  description: 'Match có kèm hình ảnh sân và quy mô',
  images: SAMPLE_IMAGE_URLS,
  skillLevel: 'K_PLUS' as SkillLevel,
  shuttleType: 'YONEX_AS50' as ShuttleType,
  playerFormat: 'DOUBLE_MALE' as PlayerFormat,
  date: NEXT_WEEK,
  startTime: createTimeDate(20, 0),
  endTime: createTimeDate(22, 0),
  isPrivate: false,
  price: 100000,
  slotsNeeded: 3,
  status: 'OPEN' as MatchStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Matches for conflict detection testing
export const sampleConflictMatch1 = {
  id: MATCH_ID_CONFLICT_1,
  courtId: COURT_ID_1,
  hostUserId: HOST_USER_ID,
  title: 'Match 14:00-16:00',
  description: null,
  images: [],
  skillLevel: 'TB' as SkillLevel,
  shuttleType: 'TC77' as ShuttleType,
  playerFormat: 'DOUBLE_MALE' as PlayerFormat,
  date: TOMORROW,
  startTime: createTimeDate(14, 0),
  endTime: createTimeDate(16, 0),
  isPrivate: false,
  price: 50000,
  slotsNeeded: 3,
  status: 'OPEN' as MatchStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const sampleConflictMatch2 = {
  id: MATCH_ID_CONFLICT_2,
  courtId: COURT_ID_1,
  hostUserId: HOST_USER_ID,
  title: 'Match 15:00-17:00 (conflicts)',
  description: null,
  images: [],
  skillLevel: 'TB' as SkillLevel,
  shuttleType: 'TC77' as ShuttleType,
  playerFormat: 'DOUBLE_MALE' as PlayerFormat,
  date: TOMORROW,
  startTime: createTimeDate(15, 0),
  endTime: createTimeDate(17, 0),
  isPrivate: false,
  price: 50000,
  slotsNeeded: 3,
  status: 'OPEN' as MatchStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Sample MatchPlayers
export const sampleMatchPlayerAccepted = {
  id: MATCH_PLAYER_ID_1,
  matchId: MATCH_ID_PUBLIC,
  userId: PLAYER_USER_ID_1,
  status: 'ACCEPTED' as MatchPlayerStatus,
  message: null,
  position: 1,
  requestedAt: new Date(),
  respondedAt: new Date(),
};

export const sampleMatchPlayerPending = {
  id: MATCH_PLAYER_ID_PENDING,
  matchId: MATCH_ID_PRIVATE,
  userId: PLAYER_USER_ID_2,
  status: 'PENDING' as MatchPlayerStatus,
  message: 'Mình level K, đánh được cả đôi nam và đôi nữ',
  position: null,
  requestedAt: new Date(),
  respondedAt: null,
};

export const sampleMatchPlayerPendingPayment = {
  id: MATCH_PLAYER_ID_PAYMENT,
  matchId: MATCH_ID_PUBLIC,
  userId: PLAYER_USER_ID_3,
  status: 'PENDING_PAYMENT' as MatchPlayerStatus,
  message: null,
  position: null,
  requestedAt: new Date(),
  respondedAt: new Date(),
};

// DTOs for API requests
export const createPublicMatchDto = {
  courtId: COURT_ID_1,
  title: 'Đánh giao lưu cuối tuần',
  description: 'Tìm bạn đánh giao lưu level TB+',
  skillLevel: 'TB_PLUS',
  shuttleType: 'TC77',
  playerFormat: 'DOUBLE_MALE',
  date: TOMORROW.toISOString().split('T')[0],
  startTime: '18:00',
  endTime: '20:00',
  isPrivate: false,
  price: 50000,
  slotsNeeded: 3,
};

export const createPrivateMatchDto = {
  courtId: COURT_ID_1,
  title: 'Tập luyện nghiêm túc',
  skillLevel: 'K',
  shuttleType: 'YONEX_AS40',
  playerFormat: 'MIXED_DOUBLE',
  date: NEXT_WEEK.toISOString().split('T')[0],
  startTime: '19:00',
  endTime: '21:00',
  isPrivate: true,
  price: 75000,
  slotsNeeded: 2,
};

export const createMatchWithImagesDto = {
  courtId: COURT_ID_1,
  title: 'Match với hình ảnh',
  description: 'Có kèm hình ảnh sân',
  images: SAMPLE_IMAGE_URLS,
  skillLevel: 'TB_PLUS',
  shuttleType: 'TC77',
  playerFormat: 'DOUBLE_MALE',
  date: TOMORROW.toISOString().split('T')[0],
  startTime: '18:00',
  endTime: '20:00',
  price: 60000,
  slotsNeeded: 3,
};

export const updateMatchDto = {
  title: 'Updated title',
  description: 'Updated description',
  price: 60000,
};

export const joinMatchDto = {
  message: 'Mình level TB+, đánh được đôi nam',
};

export const respondToRequestDto = {
  status: 'ACCEPTED' as const,
};

// Invalid DTOs for validation testing
export const invalidMatchDtos = {
  missingRequired: {
    title: 'Missing required fields',
  },
  invalidSkillLevel: {
    ...createPublicMatchDto,
    skillLevel: 'INVALID',
  },
  invalidTimeRange: {
    ...createPublicMatchDto,
    startTime: '20:00',
    endTime: '18:00',
  },
  pastDate: {
    ...createPublicMatchDto,
    date: '2020-01-01',
  },
  negativeSlotsPrice: {
    ...createPublicMatchDto,
    price: -100,
    slotsNeeded: -1,
  },
  tooManySlots: {
    ...createPublicMatchDto,
    slotsNeeded: 25,
  },
  tooManyImages: {
    ...createPublicMatchDto,
    images: new Array(11).fill('http://localhost:4566/test.jpg'),
  },
};

// Query params for filtering
export const matchQueryParams = {
  byCourtId: { courtId: COURT_ID_1 },
  bySkillLevel: { skillLevel: 'TB_PLUS' },
  byPlayerFormat: { playerFormat: 'DOUBLE_MALE' },
  byStatus: { status: 'OPEN' },
  byDate: { date: TOMORROW.toISOString().split('T')[0] },
  byDateRange: {
    dateFrom: TODAY.toISOString().split('T')[0],
    dateTo: NEXT_WEEK.toISOString().split('T')[0],
  },
  withPagination: { page: 1, limit: 10 },
};

// Mock responses with relations
export const matchWithCourt = {
  ...samplePublicMatch,
  court: {
    id: COURT_ID_1,
    name: 'Sân cầu lông Ngọc Khánh',
    addressCity: 'Hà Nội',
    addressDistrict: 'Quận Ba Đình',
  },
  host: {
    id: HOST_USER_ID,
    firstName: 'Nguyen',
    lastName: 'Van A',
    username: 'nguyen_vana',
    photoUrl: SAMPLE_PROFILE_IMAGE_URL,
  },
  _count: {
    players: 1,
  },
};

export const matchWithPlayers = {
  ...matchWithCourt,
  players: [
    {
      ...sampleMatchPlayerAccepted,
      user: {
        id: PLAYER_USER_ID_1,
        firstName: 'Tran',
        lastName: 'Van B',
        username: 'tran_vanb',
        photoUrl: null,
      },
    },
  ],
};
