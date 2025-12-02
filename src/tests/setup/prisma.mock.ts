import { jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';

// Type for mock methods - use unknown function signature
type MockMethod = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

// Mock Prisma client for unit tests
export const prismaMock = {
  court: {
    findMany: jest.fn() as unknown as MockMethod,
    findUnique: jest.fn() as unknown as MockMethod,
    create: jest.fn() as unknown as MockMethod,
    update: jest.fn() as unknown as MockMethod,
    delete: jest.fn() as unknown as MockMethod,
    count: jest.fn() as unknown as MockMethod,
  },
  subCourt: {
    findMany: jest.fn() as unknown as MockMethod,
    findUnique: jest.fn() as unknown as MockMethod,
    create: jest.fn() as unknown as MockMethod,
    update: jest.fn() as unknown as MockMethod,
    delete: jest.fn() as unknown as MockMethod,
  },
  booking: {
    findMany: jest.fn() as unknown as MockMethod,
    findUnique: jest.fn() as unknown as MockMethod,
    create: jest.fn() as unknown as MockMethod,
    update: jest.fn() as unknown as MockMethod,
    delete: jest.fn() as unknown as MockMethod,
    count: jest.fn() as unknown as MockMethod,
  },
  pricingRule: {
    findMany: jest.fn() as unknown as MockMethod,
    findUnique: jest.fn() as unknown as MockMethod,
  },
  subCourtClosure: {
    findMany: jest.fn() as unknown as MockMethod,
  },
  holiday: {
    findUnique: jest.fn() as unknown as MockMethod,
    findFirst: jest.fn() as unknown as MockMethod,
  },
  $queryRaw: jest.fn() as unknown as MockMethod,
  $executeRaw: jest.fn() as unknown as MockMethod,
  $connect: jest.fn() as unknown as MockMethod,
  $disconnect: jest.fn() as unknown as MockMethod,
} as unknown as jest.Mocked<PrismaClient>;

// Reset all mocks between tests
export function resetPrismaMocks(): void {
  Object.values(prismaMock).forEach(model => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach(method => {
        if (typeof method === 'function' && 'mockReset' in method) {
          (method as jest.Mock).mockReset();
        }
      });
    }
  });
}

// Helper to setup common mock responses
export function mockCourtFindById(court: unknown): void {
  (prismaMock.court.findUnique as unknown as jest.Mock<() => Promise<unknown>>).mockResolvedValue(court);
}

export function mockCourtFindAll(courts: unknown[], total: number): void {
  (prismaMock.court.findMany as unknown as jest.Mock<() => Promise<unknown>>).mockResolvedValue(courts);
  (prismaMock.court.count as unknown as jest.Mock<() => Promise<unknown>>).mockResolvedValue(total);
}

export function mockCourtCreate(court: unknown): void {
  (prismaMock.court.create as unknown as jest.Mock<() => Promise<unknown>>).mockResolvedValue(court);
}

export function mockCourtUpdate(court: unknown): void {
  (prismaMock.court.update as unknown as jest.Mock<() => Promise<unknown>>).mockResolvedValue(court);
}

export function mockCourtDelete(court: unknown): void {
  (prismaMock.court.delete as unknown as jest.Mock<() => Promise<unknown>>).mockResolvedValue(court);
}
