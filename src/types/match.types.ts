/**
 * Match (Exchange) Types
 * Types for badminton exchange match creation and joining
 */

// ==================== ENUMS ====================

/**
 * Skill levels for players
 * Must match Prisma enum exactly
 */
export const SkillLevel = {
  TBY: 'TBY',           // Tập bóng yếu (Beginner weak)
  Y: 'Y',               // Yếu (Weak)
  Y_PLUS: 'Y_PLUS',     // Yếu+ (Weak+)
  Y_PLUS_PLUS: 'Y_PLUS_PLUS', // Yếu++ (Weak++)
  TBK: 'TBK',           // Trung bình khá (Average-good)
  TB: 'TB',             // Trung bình (Average)
  TB_PLUS: 'TB_PLUS',   // Trung bình+ (Average+)
  TB_PLUS_PLUS: 'TB_PLUS_PLUS', // Trung bình++ (Average++)
  K: 'K',               // Khá (Good)
  K_PLUS: 'K_PLUS',     // Khá+ (Good+)
  GIOI: 'GIOI',         // Giỏi (Excellent)
} as const;

export type SkillLevel = (typeof SkillLevel)[keyof typeof SkillLevel];

export const SKILL_LEVEL_VALUES = Object.values(SkillLevel);

/**
 * Shuttlecock types/brands
 */
export const ShuttleType = {
  TC77: 'TC77',
  BASAO: 'BASAO',
  YONEX_AS30: 'YONEX_AS30',
  YONEX_AS40: 'YONEX_AS40',
  YONEX_AS50: 'YONEX_AS50',
  VICTOR_MASTER_1: 'VICTOR_MASTER_1',
  VICTOR_CHAMPION_1: 'VICTOR_CHAMPION_1',
  RSL_CLASSIC: 'RSL_CLASSIC',
  LINDAN_40: 'LINDAN_40',
  LINDAN_50: 'LINDAN_50',
  OTHER: 'OTHER',
} as const;

export type ShuttleType = (typeof ShuttleType)[keyof typeof ShuttleType];

export const SHUTTLE_TYPE_VALUES = Object.values(ShuttleType);

/**
 * Player format for matches
 */
export const PlayerFormat = {
  SINGLE_MALE: 'SINGLE_MALE',       // Nam đơn
  SINGLE_FEMALE: 'SINGLE_FEMALE',   // Nữ đơn
  DOUBLE_MALE: 'DOUBLE_MALE',       // Nam đôi
  DOUBLE_FEMALE: 'DOUBLE_FEMALE',   // Nữ đôi
  MIXED_DOUBLE: 'MIXED_DOUBLE',     // Đôi nam nữ
  ANY: 'ANY',                       // Linh hoạt
} as const;

export type PlayerFormat = (typeof PlayerFormat)[keyof typeof PlayerFormat];

export const PLAYER_FORMAT_VALUES = Object.values(PlayerFormat);

/**
 * Match status
 */
export const MatchStatus = {
  OPEN: 'OPEN',           // Looking for players
  FULL: 'FULL',           // All slots filled
  IN_PROGRESS: 'IN_PROGRESS', // Match is happening
  COMPLETED: 'COMPLETED', // Match finished
  CANCELLED: 'CANCELLED', // Match cancelled
} as const;

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const MATCH_STATUS_VALUES = Object.values(MatchStatus);

/**
 * Match player status
 */
export const MatchPlayerStatus = {
  PENDING: 'PENDING',             // Waiting for host approval
  PENDING_PAYMENT: 'PENDING_PAYMENT', // Waiting for payment
  ACCEPTED: 'ACCEPTED',           // Approved and paid (or free match)
  REJECTED: 'REJECTED',           // Rejected by host
  LEFT: 'LEFT',                   // Player left the match
  EXPIRED: 'EXPIRED',             // Payment expired
} as const;

export type MatchPlayerStatus = (typeof MatchPlayerStatus)[keyof typeof MatchPlayerStatus];

export const MATCH_PLAYER_STATUS_VALUES = Object.values(MatchPlayerStatus);

// ==================== VALIDATION HELPERS ====================

/**
 * Validate skill level
 */
export function isValidSkillLevel(value: unknown): value is SkillLevel {
  return typeof value === 'string' && SKILL_LEVEL_VALUES.includes(value as SkillLevel);
}

/**
 * Validate shuttle type
 */
export function isValidShuttleType(value: unknown): value is ShuttleType {
  return typeof value === 'string' && SHUTTLE_TYPE_VALUES.includes(value as ShuttleType);
}

/**
 * Validate player format
 */
export function isValidPlayerFormat(value: unknown): value is PlayerFormat {
  return typeof value === 'string' && PLAYER_FORMAT_VALUES.includes(value as PlayerFormat);
}

/**
 * Validate match status
 */
export function isValidMatchStatus(value: unknown): value is MatchStatus {
  return typeof value === 'string' && MATCH_STATUS_VALUES.includes(value as MatchStatus);
}

/**
 * Validate match player status
 */
export function isValidMatchPlayerStatus(value: unknown): value is MatchPlayerStatus {
  return typeof value === 'string' && MATCH_PLAYER_STATUS_VALUES.includes(value as MatchPlayerStatus);
}

/**
 * Validate S3 URL format
 * Accepts URLs like: https://bucket-name.s3.region.amazonaws.com/path/to/file.jpg
 */
export function isValidS3Url(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const s3UrlPattern = /^https:\/\/[\w.-]+\.s3\.[\w.-]+\.amazonaws\.com\/.+$/;
  return s3UrlPattern.test(value);
}

/**
 * Validate array of S3 URLs
 */
export function isValidS3UrlArray(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every(isValidS3Url);
}

/**
 * Validate time format (HH:mm)
 */
export function isValidTimeFormat(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  return timePattern.test(value);
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDateFormat(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Validate UUID format
 */
export function isValidUuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value);
}

// ==================== DTOs ====================

/**
 * DTO for creating a new match
 */
export interface CreateMatchDto {
  courtId: string;
  title?: string;
  description?: string;
  images?: string[];          // S3 URLs
  skillLevel: SkillLevel;
  shuttleType: ShuttleType;
  playerFormat: PlayerFormat;
  date: string;               // YYYY-MM-DD
  startTime: string;          // HH:mm
  endTime: string;            // HH:mm
  isPrivate?: boolean;
  price: number;              // Price per player in VND
  slotsNeeded: number;        // Number of players needed
}

/**
 * DTO for updating a match
 */
export interface UpdateMatchDto {
  title?: string;
  description?: string;
  images?: string[];
  skillLevel?: SkillLevel;
  shuttleType?: ShuttleType;
  playerFormat?: PlayerFormat;
  date?: string;
  startTime?: string;
  endTime?: string;
  isPrivate?: boolean;
  price?: number;
  slotsNeeded?: number;
  status?: MatchStatus;
}

/**
 * DTO for joining a match
 */
export interface JoinMatchDto {
  message?: string;           // Optional message to host
}

/**
 * DTO for responding to a join request
 */
export interface RespondToJoinRequestDto {
  status: 'ACCEPTED' | 'REJECTED';
}

/**
 * Query params for listing matches
 */
export interface MatchQueryParams {
  courtId?: string;
  skillLevel?: SkillLevel;
  playerFormat?: PlayerFormat;
  status?: MatchStatus;
  date?: string;              // Filter by specific date
  dateFrom?: string;          // Filter from date
  dateTo?: string;            // Filter to date
  page?: number;
  limit?: number;
}

/**
 * Match response DTO (what we return to clients)
 */
export interface MatchResponseDto {
  id: string;
  courtId: string;
  courtName: string;
  courtAddress: string;
  hostUserId: string;
  hostName: string;
  title: string | null;
  description: string | null;
  images: string[];
  skillLevel: SkillLevel;
  shuttleType: ShuttleType;
  playerFormat: PlayerFormat;
  date: string;
  startTime: string;
  endTime: string;
  isPrivate: boolean;
  price: number;
  slotsNeeded: number;
  slotsAccepted: number;      // Number of accepted players
  status: MatchStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Match player response DTO
 */
export interface MatchPlayerResponseDto {
  id: string;
  matchId: string;
  userId: string;
  userName: string;
  userPhotoUrl: string | null;
  status: MatchPlayerStatus;
  message: string | null;
  position: number | null;
  requestedAt: string;
  respondedAt: string | null;
}

/**
 * Match with players response
 */
export interface MatchWithPlayersResponseDto extends MatchResponseDto {
  players: MatchPlayerResponseDto[];
}
