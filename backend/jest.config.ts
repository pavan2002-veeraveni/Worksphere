import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '@config/(.*)': '<rootDir>/src/config/$1',
    '@utils/(.*)': '<rootDir>/src/utils/$1',
    '@middleware/(.*)': '<rootDir>/src/middleware/$1',
    '@services/(.*)': '<rootDir>/src/services/$1',
    '@controllers/(.*)': '<rootDir>/src/controllers/$1',
    '@repositories/(.*)': '<rootDir>/src/repositories/$1',
    '@routes/(.*)': '<rootDir>/src/routes/$1',
    '@validators/(.*)': '<rootDir>/src/validators/$1',
    '@jobs/(.*)': '<rootDir>/src/jobs/$1',
    '@integrations/(.*)': '<rootDir>/src/integrations/$1',
    '@websocket/(.*)': '<rootDir>/src/websocket/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};

export default config;
