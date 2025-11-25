import { courtRepository } from '../repositories/index.js';
import type { CreateCourtDto, UpdateCourtDto, CourtQueryParams, CourtLocation } from '../types/index.js';
import { NotFoundError } from '../utils/errors.js';

export class CourtService {
  async getAllCourts(params: CourtQueryParams) {
    return courtRepository.findAll(params);
  }

  async getCourtById(id: string) {
    const court = await courtRepository.findById(id);
    if (!court) {
      throw new NotFoundError('Court not found');
    }
    return court;
  }

  async createCourt(data: CreateCourtDto) {
    return courtRepository.create(data);
  }

  async updateCourt(id: string, data: UpdateCourtDto) {
    await this.getCourtById(id); // Ensures court exists
    return courtRepository.update(id, data);
  }

  async deleteCourt(id: string) {
    await this.getCourtById(id); // Ensures court exists
    return courtRepository.delete(id);
  }

  async getNearbyCourts(location: CourtLocation, radiusKm?: number) {
    return courtRepository.findNearby(location, radiusKm);
  }
}

export const courtService = new CourtService();

