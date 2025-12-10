import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { availabilityService } from '../../services/availability.service.js';
import { availabilityRepository } from '../../repositories/availability.repository.js';
import { BadRequestError } from '../../utils/errors.js';

jest.mock('../../config/database.js', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  }
}));

describe('AvailabilityService - Group Booking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create multiple bookings with same groupId', async () => {
    const mockData = {
      bookings: [
        { subCourtId: 'sc1', date: '2025-12-25', startTime: '10:00', endTime: '11:00' },
        { subCourtId: 'sc2', date: '2025-12-25', startTime: '10:00', endTime: '11:00' }
      ],
      guestName: 'Test User',
      guestPhone: '1234567890',
      userId: 'user1'
    };

    // Mock repository responses
    jest.spyOn(availabilityRepository, 'getSubCourtWithCourt').mockResolvedValue({
      id: 'sc1', court_id: 'c1', name: 'Sub Court 1', is_active: true
    } as any);
    jest.spyOn(availabilityRepository, 'hasOverlappingBooking').mockResolvedValue(false);
    jest.spyOn(availabilityRepository, 'isHoliday').mockResolvedValue(false);
    jest.spyOn(availabilityRepository, 'getHolidayMultiplier').mockResolvedValue(1.0);
    jest.spyOn(availabilityRepository, 'getPricingRulesByCourtId').mockResolvedValue([
      { start_time: '00:00', end_time: '23:59', price_per_hour: 100000, day_type: 'weekday', is_active: true }
    ] as any);
    jest.spyOn(availabilityRepository, 'createBookings').mockResolvedValue(['id1', 'id2']);
    jest.spyOn(availabilityRepository, 'getBookingById').mockImplementation((id) => Promise.resolve({
      id,
      sub_court_id: id === 'id1' ? 'sc1' : 'sc2',
      total_price: 50000,
      status: 'pending',
      created_at: new Date(),
      date: new Date('2025-12-25'),
      start_time: '10:00',
      end_time: '11:00',
      guest_name: 'Test User',
      guest_phone: '1234567890',
      sub_court_name: 'Sub Court 1',
      court_name: 'Court 1',
      court_id: 'c1',
      guest_email: null,
      notes: null,
      group_id: 'some-uuid'
    }));

    const result = await availabilityService.createBooking(mockData);

    expect(result).toHaveLength(2);
    expect(availabilityRepository.createBookings).toHaveBeenCalledTimes(1);
    const callArgs = (availabilityRepository.createBookings as jest.Mock).mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs![0]).toHaveLength(2); // 2 bookings
    expect((callArgs![1] as { groupId?: string }).groupId).toBeDefined(); // groupId generated
  });
});
