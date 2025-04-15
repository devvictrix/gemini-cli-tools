// File: jest.config.js

/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  // Specifies the environment Jest will run tests in
  testEnvironment: "node",

  // Use the ts-jest preset designed for ES Modules (since your package.json has "type": "module")
  preset: "ts-jest/presets/default-esm",

  // --- ALIAS MAPPING ---
  // Tells Jest how to resolve module imports starting with '@app/'
  moduleNameMapper: {
    // Any import starting with '@app/' followed by anything (.*)
    // should be mapped to '<rootDir>/src/' followed by that same captured part ($1).
    // '<rootDir>' is a Jest variable representing the project's root directory (where jest.config.js is).
    "^@app/(.*)$": "<rootDir>/src/$1",

    // This line below is sometimes needed for ts-jest with ESM to handle imports correctly,
    // but try commenting it out first. The preset might handle it. Uncomment if you still see issues.
    // '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // --- END ALIAS MAPPING ---

  // Tells Jest how to transform TypeScript files using ts-jest, enabling ESM support
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
  },

  // Tells ts-jest/Jest which file extensions should be treated as ES modules
  extensionsToTreatAsEsm: [".ts"],

  // We removed rootDir: './src' so Jest searches from the project root by default,
  // allowing it to find the 'tests/' directory.
  // Jest's default testMatch pattern will find *.test.ts files.
};
