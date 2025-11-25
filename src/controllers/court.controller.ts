import type { Request, Response, NextFunction } from 'express';
import { courtService } from '../services/index.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import type { CreateCourtDto, UpdateCourtDto, CourtQueryParams } from '../types/index.js';

export class CourtController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params: CourtQueryParams = {
        district: req.query.district as string | undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
      };

      const { courts, total, page, limit } = await courtService.getAllCourts(params);
      sendPaginated(res, courts, { page, limit, total });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const court = await courtService.getCourtById(req.params.id!);
      sendSuccess(res, court);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateCourtDto = req.body;
      const court = await courtService.createCourt(data);
      sendSuccess(res, court, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: UpdateCourtDto = req.body;
      const court = await courtService.updateCourt(req.params.id!, data);
      sendSuccess(res, court);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await courtService.deleteCourt(req.params.id!);
      sendSuccess(res, { message: 'Court deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getNearby(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { latitude, longitude, radius } = req.query;
      const location = {
        latitude: Number(latitude),
        longitude: Number(longitude),
      };
      const radiusKm = radius ? Number(radius) : undefined;

      const courts = await courtService.getNearbyCourts(location, radiusKm);
      sendSuccess(res, courts);
    } catch (error) {
      next(error);
    }
  }
}

export const courtController = new CourtController();

