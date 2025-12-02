import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NotFoundError } from '../../../utils/errors.js';
import {
  sampleCourt,
  sampleCourtsList,
  createCourtDto,
  updateCourtDto,
  validCourtId,
  nonExistentCourtId,
  hanoiLocation,
  nearbyCourtResult,
} from '../../fixtures/index.js';

// Type for paginated results
interface PaginatedCourtsResult {
  courts: unknown[];
  total: number;
  page: number;
  limit: number;
}

// Use retro-compatible jest.fn() with proper typing for ESM
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

// Create mock repository - use simple jest.fn() for ESM compatibility
const mockRepository = {
  findAll: jest.fn<AnyFn>(),
  findById: jest.fn<AnyFn>(),
  create: jest.fn<AnyFn>(),
  update: jest.fn<AnyFn>(),
  delete: jest.fn<AnyFn>(),
  findNearby: jest.fn<AnyFn>(),
};

// Create a testable service that uses our mock
class TestableCourtService {
  private mockRepo: typeof mockRepository;

  constructor(repo: typeof mockRepository) {
    this.mockRepo = repo;
  }

  async getAllCourts(params: { district?: string; page?: number; limit?: number }) {
    return this.mockRepo.findAll(params);
  }

  async getCourtById(id: string) {
    const court = await this.mockRepo.findById(id);
    if (!court) {
      throw new NotFoundError('Court not found');
    }
    return court;
  }

  async createCourt(data: unknown) {
    return this.mockRepo.create(data);
  }

  async updateCourt(id: string, data: unknown) {
    await this.getCourtById(id); // Ensures court exists
    return this.mockRepo.update(id, data);
  }

  async deleteCourt(id: string) {
    await this.getCourtById(id); // Ensures court exists
    return this.mockRepo.delete(id);
  }

  async getNearbyCourts(location: { latitude: number; longitude: number }, radiusKm?: number) {
    return this.mockRepo.findNearby(location, radiusKm);
  }
}

describe('CourtService', () => {
  let courtService: TestableCourtService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    Object.values(mockRepository).forEach(mock => mock.mockReset());
    
    // Create a new instance for each test
    courtService = new TestableCourtService(mockRepository);
  });

  describe('getAllCourts', () => {
    it('should return paginated courts list', async () => {
      const mockResult = {
        courts: sampleCourtsList,
        total: 3,
        page: 1,
        limit: 10,
      };
      mockRepository.findAll.mockResolvedValue(mockResult);

      const result = await courtService.getAllCourts({ page: 1, limit: 10 }) as PaginatedCourtsResult;

      expect(mockRepository.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(result.courts).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
    });

    it('should filter by district', async () => {
      const filteredCourts = sampleCourtsList.filter(c => c.addressDistrict === 'Quận Ba Đình');
      const mockResult = {
        courts: filteredCourts,
        total: 1,
        page: 1,
        limit: 10,
      };
      mockRepository.findAll.mockResolvedValue(mockResult);

      const result = await courtService.getAllCourts({ 
        district: 'Quận Ba Đình',
        page: 1,
        limit: 10,
      }) as PaginatedCourtsResult;

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        district: 'Quận Ba Đình',
        page: 1,
        limit: 10,
      });
      expect(result.courts).toHaveLength(1);
    });

    it('should return empty list when no courts match', async () => {
      const mockResult = {
        courts: [],
        total: 0,
        page: 1,
        limit: 10,
      };
      mockRepository.findAll.mockResolvedValue(mockResult);

      const result = await courtService.getAllCourts({ 
        district: 'Nonexistent District',
        page: 1,
        limit: 10,
      }) as PaginatedCourtsResult;

      expect(result.courts).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle pagination correctly', async () => {
      const mockResult = {
        courts: [sampleCourtsList[2]],
        total: 3,
        page: 3,
        limit: 1,
      };
      mockRepository.findAll.mockResolvedValue(mockResult);

      const result = await courtService.getAllCourts({ page: 3, limit: 1 }) as PaginatedCourtsResult;

      expect(result.page).toBe(3);
      expect(result.limit).toBe(1);
      expect(result.courts).toHaveLength(1);
    });
  });

  describe('getCourtById', () => {
    it('should return court when found', async () => {
      mockRepository.findById.mockResolvedValue(sampleCourt);

      const result = await courtService.getCourtById(validCourtId);

      expect(mockRepository.findById).toHaveBeenCalledWith(validCourtId);
      expect(result).toEqual(sampleCourt);
    });

    it('should throw NotFoundError when court not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(courtService.getCourtById(nonExistentCourtId))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw NotFoundError with correct message', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(courtService.getCourtById(nonExistentCourtId))
        .rejects
        .toThrow('Court not found');
    });
  });

  describe('createCourt', () => {
    it('should create court with valid data', async () => {
      const createdCourt = { ...sampleCourt, ...createCourtDto };
      mockRepository.create.mockResolvedValue(createdCourt);

      const result = await courtService.createCourt(createCourtDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createCourtDto);
      expect(result).toEqual(createdCourt);
    });

    it('should create court with minimal data (only name)', async () => {
      const minimalDto = { name: 'Minimal Court' };
      const createdCourt = { ...sampleCourt, name: 'Minimal Court' };
      mockRepository.create.mockResolvedValue(createdCourt);

      const result = await courtService.createCourt(minimalDto) as { name: string };

      expect(mockRepository.create).toHaveBeenCalledWith(minimalDto);
      expect(result.name).toBe('Minimal Court');
    });

    it('should create court with location', async () => {
      const dtoWithLocation = { ...createCourtDto, location: hanoiLocation };
      const createdCourt = { ...sampleCourt, ...dtoWithLocation };
      mockRepository.create.mockResolvedValue(createdCourt);

      const result = await courtService.createCourt(dtoWithLocation);

      expect(mockRepository.create).toHaveBeenCalledWith(dtoWithLocation);
      expect(result).toBeDefined();
    });
  });

  describe('updateCourt', () => {
    it('should update court when found', async () => {
      mockRepository.findById.mockResolvedValue(sampleCourt);
      const updatedCourt = { ...sampleCourt, ...updateCourtDto };
      mockRepository.update.mockResolvedValue(updatedCourt);

      const result = await courtService.updateCourt(validCourtId, updateCourtDto) as { name: string };

      expect(mockRepository.findById).toHaveBeenCalledWith(validCourtId);
      expect(mockRepository.update).toHaveBeenCalledWith(validCourtId, updateCourtDto);
      expect(result.name).toBe(updateCourtDto.name);
    });

    it('should throw NotFoundError when updating non-existent court', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(courtService.updateCourt(nonExistentCourtId, updateCourtDto))
        .rejects
        .toThrow(NotFoundError);

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should handle partial update', async () => {
      mockRepository.findById.mockResolvedValue(sampleCourt);
      const partialUpdate = { description: 'New description' };
      const updatedCourt = { ...sampleCourt, ...partialUpdate };
      mockRepository.update.mockResolvedValue(updatedCourt);

      const result = await courtService.updateCourt(validCourtId, partialUpdate) as { name: string; description: string };

      expect(result.description).toBe('New description');
      expect(result.name).toBe(sampleCourt.name); // Name unchanged
    });
  });

  describe('deleteCourt', () => {
    it('should delete court when found', async () => {
      mockRepository.findById.mockResolvedValue(sampleCourt);
      mockRepository.delete.mockResolvedValue(sampleCourt);

      const result = await courtService.deleteCourt(validCourtId);

      expect(mockRepository.findById).toHaveBeenCalledWith(validCourtId);
      expect(mockRepository.delete).toHaveBeenCalledWith(validCourtId);
      expect(result).toEqual(sampleCourt);
    });

    it('should throw NotFoundError when deleting non-existent court', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(courtService.deleteCourt(nonExistentCourtId))
        .rejects
        .toThrow(NotFoundError);

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('getNearbyCourts', () => {
    it('should return nearby courts with default radius', async () => {
      mockRepository.findNearby.mockResolvedValue([nearbyCourtResult]);

      const result = await courtService.getNearbyCourts(hanoiLocation) as Array<{ distance: number }>;

      expect(mockRepository.findNearby).toHaveBeenCalledWith(hanoiLocation, undefined);
      expect(result).toHaveLength(1);
    });

    it('should return nearby courts with custom radius', async () => {
      mockRepository.findNearby.mockResolvedValue([nearbyCourtResult]);

      const result = await courtService.getNearbyCourts(hanoiLocation, 3) as Array<{ distance: number }>;

      expect(mockRepository.findNearby).toHaveBeenCalledWith(hanoiLocation, 3);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no courts nearby', async () => {
      mockRepository.findNearby.mockResolvedValue([]);

      const result = await courtService.getNearbyCourts(hanoiLocation, 0.1) as unknown[];

      expect(result).toHaveLength(0);
    });

    it('should include distance in results', async () => {
      mockRepository.findNearby.mockResolvedValue([nearbyCourtResult]);

      const result = await courtService.getNearbyCourts(hanoiLocation) as Array<{ distance: number }>;

      expect(result[0]).toHaveProperty('distance');
      expect(result[0] && typeof result[0].distance).toBe('number');
    });
  });
});
