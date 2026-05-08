/**
 * Re-export from the actual test utilities.
 * This allows imports via @/tests/utils/mocks/prisma to resolve correctly
 * since @ alias points to ./src.
 */

export {
  createMockPrismaClient,
  type DeepMockProxy,
  getMockPrisma,
  mockPrisma,
  mockTransaction,
  mockUsers,
  mockVectorSearch,
  mockWorkspaces,
  resetPrismaMocks,
  setupDefaultMockReturns,
} from '../../../../tests/utils/mocks/prisma';
