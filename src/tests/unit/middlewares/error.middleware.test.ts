import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { AppError, NotFoundError, BadRequestError, ConflictError } from '../../../utils/errors.js';
import { errorHandler, notFoundHandler } from '../../../middlewares/error.middleware.js';

describe('Error Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusCode: number;
  let jsonResponse: unknown;

  beforeEach(() => {
    statusCode = 0;
    jsonResponse = null;
    
    mockReq = {
      method: 'GET',
      path: '/api/test',
    };
    mockRes = {
      status: jest.fn((code: unknown) => {
        statusCode = code as number;
        return mockRes;
      }) as unknown as Response['status'],
      json: jest.fn((data: unknown) => {
        jsonResponse = data;
        return mockRes;
      }) as unknown as Response['json'],
    };
    mockNext = jest.fn() as unknown as NextFunction;
  });

  describe('errorHandler', () => {
    it('should handle AppError with correct status code', () => {
      const error = new AppError('Test error', 400);

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(400);
      expect(jsonResponse).toEqual({
        success: false,
        error: { message: 'Test error' },
      });
    });

    it('should handle NotFoundError (404)', () => {
      const error = new NotFoundError('Court not found');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(404);
      expect(jsonResponse).toEqual({
        success: false,
        error: { message: 'Court not found' },
      });
    });

    it('should handle BadRequestError (400)', () => {
      const error = new BadRequestError('Invalid input');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(400);
      expect(jsonResponse).toEqual({
        success: false,
        error: { message: 'Invalid input' },
      });
    });

    it('should handle ConflictError (409)', () => {
      const error = new ConflictError('Time slot already booked');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(409);
      expect(jsonResponse).toEqual({
        success: false,
        error: { message: 'Time slot already booked' },
      });
    });

    it('should handle generic Error with 500 status', () => {
      const error = new Error('Unexpected error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(500);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle TypeError', () => {
      const error = new TypeError('Cannot read property of undefined');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(500);
      consoleSpy.mockRestore();
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 for unmatched routes', () => {
      notFoundHandler(mockReq as Request, mockRes as Response);

      expect(statusCode).toBe(404);
      expect(jsonResponse).toEqual({
        success: false,
        error: { message: 'Route GET /api/test not found' },
      });
    });

    it('should include HTTP method in error message', () => {
      mockReq = { ...mockReq, method: 'POST', path: '/api/courts' };

      notFoundHandler(mockReq as Request, mockRes as Response);

      expect(jsonResponse).toEqual({
        success: false,
        error: { message: 'Route POST /api/courts not found' },
      });
    });

    it('should handle DELETE method', () => {
      mockReq = { ...mockReq, method: 'DELETE', path: '/api/bookings/123' };

      notFoundHandler(mockReq as Request, mockRes as Response);

      expect(jsonResponse).toEqual({
        success: false,
        error: { message: 'Route DELETE /api/bookings/123 not found' },
      });
    });
  });
});

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with default status code 500', () => {
      const error = new AppError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Custom error', 418);
      
      expect(error.statusCode).toBe(418);
    });

    it('should be instanceof Error', () => {
      const error = new AppError('Test');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should have stack trace', () => {
      const error = new AppError('Test');
      
      expect(error.stack).toBeDefined();
    });
  });

  describe('NotFoundError', () => {
    it('should have 404 status code', () => {
      const error = new NotFoundError();
      
      expect(error.statusCode).toBe(404);
    });

    it('should have default message', () => {
      const error = new NotFoundError();
      
      expect(error.message).toBe('Resource not found');
    });

    it('should allow custom message', () => {
      const error = new NotFoundError('Court not found');
      
      expect(error.message).toBe('Court not found');
    });
  });

  describe('BadRequestError', () => {
    it('should have 400 status code', () => {
      const error = new BadRequestError();
      
      expect(error.statusCode).toBe(400);
    });

    it('should have default message', () => {
      const error = new BadRequestError();
      
      expect(error.message).toBe('Bad request');
    });
  });

  describe('ConflictError', () => {
    it('should have 409 status code', () => {
      const error = new ConflictError();
      
      expect(error.statusCode).toBe(409);
    });

    it('should have default message', () => {
      const error = new ConflictError();
      
      expect(error.message).toBe('Conflict');
    });
  });
});
