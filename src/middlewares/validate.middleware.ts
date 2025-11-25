import type { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../utils/errors.js';

type ValidationSchema<T> = {
  [K in keyof T]?: (value: unknown) => boolean;
};

export function validate<T>(schema: ValidationSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const [key, validator] of Object.entries(schema)) {
      const value = (req.body as Record<string, unknown>)[key];
      if (validator && !validator(value)) {
        errors.push(`Invalid value for field: ${key}`);
      }
    }

    if (errors.length > 0) {
      next(new BadRequestError(errors.join(', ')));
      return;
    }

    next();
  };
}

// Common validators
export const isString = (value: unknown): boolean => 
  value === undefined || typeof value === 'string';

export const isRequiredString = (value: unknown): boolean => 
  typeof value === 'string' && value.trim().length > 0;

export const isArray = (value: unknown): boolean => 
  value === undefined || Array.isArray(value);

export const isObject = (value: unknown): boolean => 
  value === undefined || (typeof value === 'object' && value !== null && !Array.isArray(value));

export const isNumber = (value: unknown): boolean => 
  value === undefined || typeof value === 'number';

export const isUUID = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

