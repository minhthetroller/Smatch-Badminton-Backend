import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Response } from 'express';
import { sendSuccess, sendError, sendPaginated } from '../../../utils/response.js';

describe('Response Utilities', () => {
  let mockRes: Partial<Response>;
  let responseData: unknown;

  beforeEach(() => {
    responseData = null;
    mockRes = {
      status: jest.fn().mockReturnThis() as unknown as Response['status'],
      json: jest.fn().mockImplementation((data) => {
        responseData = data;
        return mockRes;
      }) as unknown as Response['json'],
    };
  });

  describe('sendSuccess', () => {
    it('should send success response with data', () => {
      const data = { id: '1', name: 'Test' };

      sendSuccess(mockRes as Response, data);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(responseData).toEqual({
        success: true,
        data: { id: '1', name: 'Test' },
      });
    });

    it('should send success response with custom status code', () => {
      const data = { id: '1' };

      sendSuccess(mockRes as Response, data, 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should send success response with meta', () => {
      const data = [{ id: '1' }];
      const meta = { total: 100 };

      sendSuccess(mockRes as Response, data, 200, meta);

      expect(responseData).toEqual({
        success: true,
        data: [{ id: '1' }],
        meta: { total: 100 },
      });
    });

    it('should handle null data', () => {
      sendSuccess(mockRes as Response, null);

      expect(responseData).toEqual({
        success: true,
        data: null,
      });
    });

    it('should handle array data', () => {
      const data = [1, 2, 3];

      sendSuccess(mockRes as Response, data);

      expect(responseData).toEqual({
        success: true,
        data: [1, 2, 3],
      });
    });

    it('should handle empty object', () => {
      sendSuccess(mockRes as Response, {});

      expect(responseData).toEqual({
        success: true,
        data: {},
      });
    });
  });

  describe('sendError', () => {
    it('should send error response with message', () => {
      sendError(mockRes as Response, 'Something went wrong');

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(responseData).toEqual({
        success: false,
        error: { message: 'Something went wrong' },
      });
    });

    it('should send error response with custom status code', () => {
      sendError(mockRes as Response, 'Not found', 404);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should send error response with error code', () => {
      sendError(mockRes as Response, 'Validation failed', 400, 'VALIDATION_ERROR');

      expect(responseData).toEqual({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
        },
      });
    });

    it('should handle different status codes', () => {
      const statusCodes = [400, 401, 403, 404, 409, 500, 502];

      statusCodes.forEach((code) => {
        sendError(mockRes as Response, 'Error', code);
        expect(mockRes.status).toHaveBeenCalledWith(code);
      });
    });
  });

  describe('sendPaginated', () => {
    it('should send paginated response', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const pagination = { page: 1, limit: 10, total: 50 };

      sendPaginated(mockRes as Response, data, pagination);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(responseData).toEqual({
        success: true,
        data: [{ id: '1' }, { id: '2' }],
        meta: {
          pagination: {
            page: 1,
            limit: 10,
            total: 50,
            totalPages: 5,
            hasNext: true,
            hasPrev: false,
          },
        },
      });
    });

    it('should calculate totalPages correctly', () => {
      const data = [{ id: '1' }];

      sendPaginated(mockRes as Response, data, { page: 1, limit: 10, total: 25 });

      const pagination = (responseData as { meta: { pagination: { totalPages: number } } }).meta.pagination;
      expect(pagination.totalPages).toBe(3); // ceil(25/10) = 3
    });

    it('should set hasNext to false on last page', () => {
      const data = [{ id: '1' }];

      sendPaginated(mockRes as Response, data, { page: 5, limit: 10, total: 50 });

      const pagination = (responseData as { meta: { pagination: { hasNext: boolean } } }).meta.pagination;
      expect(pagination.hasNext).toBe(false);
    });

    it('should set hasPrev to true when not on first page', () => {
      const data = [{ id: '1' }];

      sendPaginated(mockRes as Response, data, { page: 2, limit: 10, total: 50 });

      const pagination = (responseData as { meta: { pagination: { hasPrev: boolean } } }).meta.pagination;
      expect(pagination.hasPrev).toBe(true);
    });

    it('should handle empty data array', () => {
      sendPaginated(mockRes as Response, [], { page: 1, limit: 10, total: 0 });

      expect(responseData).toEqual({
        success: true,
        data: [],
        meta: {
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      });
    });

    it('should handle single page', () => {
      const data = [{ id: '1' }];

      sendPaginated(mockRes as Response, data, { page: 1, limit: 10, total: 5 });

      const pagination = (responseData as { meta: { pagination: { hasNext: boolean; hasPrev: boolean } } }).meta.pagination;
      expect(pagination.hasNext).toBe(false);
      expect(pagination.hasPrev).toBe(false);
    });
  });
});
