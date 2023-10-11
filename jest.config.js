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
    "<rootDir>/server/out",
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
    "<rootDir>/**/__tests__/*.ts"
  ],
  collectCoverageFrom: [
    "**/*.ts",
    "!**/__test__/*",
    "!testing/*"
  ],
};