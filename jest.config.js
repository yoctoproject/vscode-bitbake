/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  moduleFileExtensions: [
    "js",
    "json",
    "ts"
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/client/server",
    "<rootDir>/integration-tests",
    "<rootDir>/client/out"
  ],
  transform: {
    "\\.ts$": [
      "ts-jest",
      {
        "tsconfig": "./server/tsconfig.json"
      }
    ]
  },
  testMatch: [
    "<rootDir>/**/__tests__/**/*.test.ts"
  ],
  collectCoverageFrom: [
    "**/*.ts",
    "!**/__test__/**/*.ts",
    "!integration-tests",
    "!testing/*"
  ],
};
