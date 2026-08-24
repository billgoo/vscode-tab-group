/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['src'],
  testPathIgnorePatterns: ['<rootDir>/src/test/e2e/'],
};
