import multer from 'multer';
import type { Request } from 'express';
import { BadRequestError } from '../utils/errors.js';

/**
 * Multer configuration for file uploads
 * Uses memory storage for processing before S3 upload
 */

// Allowed image MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Configure multer with memory storage
const storage = multer.memoryStorage();

// File filter to validate image types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(
        `Invalid file type. Only ${ALLOWED_MIME_TYPES.join(', ')} are allowed.`
      )
    );
  }
};

// Base multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

/**
 * Middleware for single file upload
 * Field name: 'image'
 */
export const uploadSingle = upload.single('image');

/**
 * Middleware for multiple file uploads
 * Field name: 'images'
 * @param max Maximum number of files (default: 3)
 */
export const uploadMultiple = (max: number = 3) => {
  return upload.array('images', max);
};

/**
 * Error handler for multer errors
 */
export const handleMulterError = (error: any): never => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      throw new BadRequestError(
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
      );
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      throw new BadRequestError('Too many files uploaded.');
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      throw new BadRequestError('Unexpected field in upload.');
    }
  }
  throw error;
};
