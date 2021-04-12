module.exports = {
  collectCoverageFrom: ['src/**/*.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest/setup.ts'],
  watchPathIgnorePatterns: ['.+/__fixtures__/.+'],
  testEnvironment: 'node',
  transform: {
    '\\.tsx?$': 'esbuild-jest',
  },
}
