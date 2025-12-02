/** @type {import('jest').Config} */
const config = {
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Coverage configuration
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/tests/**',
    '!src/index.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    'src/services/**/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Test projects for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/tests/unit/**/*.test.ts'],
      extensionsToTreatAsEsm: ['.ts'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            useESM: true,
          },
        ],
      },
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup/jest.setup.ts'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/tests/integration/**/*.test.ts'],
      extensionsToTreatAsEsm: ['.ts'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            useESM: true,
          },
        ],
      },
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup/jest.setup.ts'],
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/src/tests/security/**/*.test.ts'],
      extensionsToTreatAsEsm: ['.ts'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            useESM: true,
          },
        ],
      },
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup/jest.setup.ts'],
    },
  ],

  // JUnit reporter for CI
  reporters: ['default'],
};

export default config;
