// File: jest.config.js

/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  // Specifies the environment Jest will run tests in
  testEnvironment: "node",

  // Use the ts-jest preset designed for ES Modules (since your package.json has "type": "module")
  preset: "ts-jest/presets/default-esm",

  // Tells Jest how to transform TypeScript files using ts-jest, enabling ESM support
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true
      }
    ]
  },

  // Tells ts-jest/Jest which file extensions should be treated as ES modules
  extensionsToTreatAsEsm: [".ts"],
};
