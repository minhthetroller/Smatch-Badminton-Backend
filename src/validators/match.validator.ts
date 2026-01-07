/**
 * Match Validation Schemas
 * Zod schemas for match DTOs with type coercion for multipart/form-data
 */

import { z } from 'zod';

// Valid enum values
const SKILL_LEVELS = ['MOI_CHOI', 'TB', 'TB_KHA', 'TB_PLUS', 'KHA', 'KHA_GIOI', 'GIOI', 'CHUYEN'] as const;
const SHUTTLE_TYPES = ['TC77', 'ECOFLY', 'OTHER'] as const;
const PLAYER_FORMATS = ['SINGLE_MALE', 'SINGLE_FEMALE', 'DOUBLE_MALE', 'DOUBLE_FEMALE', 'DOUBLE_MIXED'] as const;
const MATCH_STATUSES = ['OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Date format validation (YYYY-MM-DD)
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Time format validation (HH:mm)
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Helper to coerce string to number (for multipart/form-data)
 */
const coerceNumber = z.union([
  z.number(),
  z.string().transform((val, ctx) => {
    const parsed = Number(val);
    if (isNaN(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a valid number',
      });
      return z.NEVER;
    }
    return parsed;
  }),
]);

/**
 * Helper to coerce string to boolean (for multipart/form-data)
 */
const coerceBoolean = z.union([
  z.boolean(),
  z.string().transform((val) => {
    if (val === 'true' || val === '1') return true;
    if (val === 'false' || val === '0') return false;
    return undefined;
  }).optional(),
]);

/**
 * Helper to parse JSON array from string (for multipart/form-data)
 */
const coerceStringArray = z.union([
  z.array(z.string()),
  z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val);
      if (!Array.isArray(parsed)) {
        ctx.issues.push({
            code: "custom",
            message: 'Must be a JSON array',
            input: ctx.value,
        });
        return z.NEVER;
      }
      return parsed;
    } catch {
      // If not JSON, treat as single-item array
      return [val];
    }
  }),
]).optional();

/**
 * Create Match Schema
 * Handles both JSON and multipart/form-data with proper type coercion
 */
export const createMatchSchema = z.object({
  courtId: z.string().regex(UUID_REGEX, 'courtId must be a valid UUID'),
  
  title: z.string().max(255, 'title must not exceed 255 characters').optional(),
  
  description: z.string().optional(),
  
  images: coerceStringArray,
  
  skillLevel: z.enum(SKILL_LEVELS, {
    message: `skillLevel must be one of: ${SKILL_LEVELS.join(', ')}`
  }),
  
  shuttleType: z.enum(SHUTTLE_TYPES, {
    message: `shuttleType must be one of: ${SHUTTLE_TYPES.join(', ')}`
  }),
  
  playerFormat: z.enum(PLAYER_FORMATS, {
    message: `playerFormat must be one of: ${PLAYER_FORMATS.join(', ')}`
  }),
  
  date: z.string().regex(DATE_REGEX, 'date must be in YYYY-MM-DD format'),
  
  startTime: z.string().regex(TIME_REGEX, 'startTime must be in HH:mm format (24-hour)'),
  
  endTime: z.string().regex(TIME_REGEX, 'endTime must be in HH:mm format (24-hour)'),
  
  isPrivate: coerceBoolean,
  
  price: coerceNumber.pipe(
    z.number().nonnegative('price must be a non-negative number')
  ),
  
  slotsNeeded: coerceNumber.pipe(
    z.number().int('slotsNeeded must be an integer')
      .min(1, 'slotsNeeded must be at least 1')
      .max(20, 'slotsNeeded must not exceed 20')
  ),
});

/**
 * Update Match Schema
 * All fields are optional
 */
export const updateMatchSchema = z.object({
  title: z.string().max(255, 'title must not exceed 255 characters').optional(),
  
  description: z.string().optional(),
  
  images: coerceStringArray,
  
  skillLevel: z.enum(SKILL_LEVELS).optional(),
  
  shuttleType: z.enum(SHUTTLE_TYPES).optional(),
  
  playerFormat: z.enum(PLAYER_FORMATS).optional(),
  
  date: z.string().regex(DATE_REGEX, 'date must be in YYYY-MM-DD format').optional(),
  
  startTime: z.string().regex(TIME_REGEX, 'startTime must be in HH:mm format').optional(),
  
  endTime: z.string().regex(TIME_REGEX, 'endTime must be in HH:mm format').optional(),
  
  isPrivate: coerceBoolean,
  
  price: coerceNumber.pipe(
    z.number().nonnegative('price must be a non-negative number')
  ).optional(),
  
  slotsNeeded: coerceNumber.pipe(
    z.number().int().min(1).max(20)
  ).optional(),
  
  status: z.enum(MATCH_STATUSES).optional(),
});

/**
 * Match Query Parameters Schema
 */
export const matchQuerySchema = z.object({
  courtId: z.string().regex(UUID_REGEX).optional(),
  skillLevel: z.enum(SKILL_LEVELS).optional(),
  playerFormat: z.enum(PLAYER_FORMATS).optional(),
  status: z.enum(MATCH_STATUSES).optional(),
  date: z.string().regex(DATE_REGEX).optional(),
  dateFrom: z.string().regex(DATE_REGEX).optional(),
  dateTo: z.string().regex(DATE_REGEX).optional(),
  includeExpired: coerceBoolean,
  page: coerceNumber.pipe(z.number().int().min(1)).optional(),
  limit: coerceNumber.pipe(z.number().int().min(1).max(50)).optional(),
});

/**
 * Join Match Schema
 */
export const joinMatchSchema = z.object({
  message: z.string().max(500, 'message must not exceed 500 characters').optional(),
});

/**
 * Respond to Join Request Schema
 */
export const respondToRequestSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED'], {
    message: 'Status must be either ACCEPTED or REJECTED'
  }),
});

// Export types
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
export type MatchQueryInput = z.infer<typeof matchQuerySchema>;
export type JoinMatchInput = z.infer<typeof joinMatchSchema>;
export type RespondToRequestInput = z.infer<typeof respondToRequestSchema>;
