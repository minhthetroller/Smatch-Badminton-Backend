import { courtRepository } from '../repositories/index.js';
import { searchService } from './search.service.js';
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
    const court = await courtRepository.create(data);

    // Sync to Redis autocomplete index (non-blocking)
    if (court) {
      this.syncToSearchIndex(court.id).catch((err) => {
        console.error('Failed to sync court to search index:', err);
      });
    }

    return court;
  }

  async updateCourt(id: string, data: UpdateCourtDto) {
    await this.getCourtById(id); // Ensures court exists
    const court = await courtRepository.update(id, data);

    // Sync to Redis autocomplete index (non-blocking)
    this.syncToSearchIndex(id).catch((err) => {
      console.error('Failed to sync court to search index:', err);
    });

    return court;
  }

  async deleteCourt(id: string) {
    await this.getCourtById(id); // Ensures court exists
    const result = await courtRepository.delete(id);

    // Remove from Redis autocomplete index (non-blocking)
    searchService.removeCourtFromIndex(id).catch((err) => {
      console.error('Failed to remove court from search index:', err);
    });

    return result;
  }

  async getNearbyCourts(location: CourtLocation, radiusKm?: number) {
    return courtRepository.findNearby(location, radiusKm);
  }

  /**
   * Sync a court to the search index
   * Private helper method for indexing operations
   */
  private async syncToSearchIndex(courtId: string): Promise<void> {
    const court = await courtRepository.findById(courtId);
    if (court) {
      await searchService.indexCourt({
        id: court.id,
        name: court.name,
        addressDistrict: court.addressDistrict,
        addressWard: court.addressWard,
        addressCity: court.addressCity,
      });
    }
  }
}

export const courtService = new CourtService();

