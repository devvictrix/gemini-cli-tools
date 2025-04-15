// File: jest.config.ts

/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from 'jest';
import fs from 'fs'; // <-- Import the Node.js file system module
import path from 'path'; // <-- Import path module for robust path resolution

// Import the helper function using require.
//  - require is used because this configuration file might be loaded in a CommonJS environment,
//    which is common when running Jest directly without going through a transpilation step.
const { pathsToModuleNameMapper } = require('ts-jest');

// --- Load tsconfig.json manually to handle comments ---
const tsconfigPath = path.resolve(__dirname, './tsconfig.json'); // Get absolute path to tsconfig.json relative to this config file
const tsconfigFileContent = fs.readFileSync(tsconfigPath, 'utf8');
// Use JSON.parse which can handle comments (unlike require())
const tsconfig = JSON.parse(tsconfigFileContent);
// --- End loading tsconfig.json ---


/**
 * Extract the paths object from the tsconfig.json.
 *
 * - This extracts the 'paths' configuration from the 'compilerOptions' section of the tsconfig.json file.
 *   If the 'compilerOptions' or 'paths' are not defined, it defaults to an empty object to prevent errors.
 *   This ensures that the module name mapper can still function, even if no path mappings are defined in the tsconfig.
 */
const tsconfigPaths = tsconfig.compilerOptions?.paths || {};

/**
 * Jest configuration object.
 *
 * This object configures how Jest runs tests for the project.
 * It specifies settings such as coverage collection, module resolution, and other test-related behaviors.
 */
const config: Config = {
	// All imported modules in your tests should be mocked automatically
	// automock: false,

	// Stop running tests after `n` failures
	// bail: 0,

	// The directory where Jest should store its cached dependency information
	// cacheDirectory: "C:\\Users\\devvi\\AppData\\Local\\Temp\\jest", // Example path, likely system-specific

	/**
	 * Automatically clear mock calls, instances, contexts and results before every test.
	 *
	 * - This setting is enabled to ensure that each test starts with a clean slate, preventing state from previous tests
	 *   from interfering with the current test.
	 */
	clearMocks: true,

	/**
	 * Indicates whether the coverage information should be collected while executing the test.
	 *
	 * - When enabled, Jest collects data on which parts of the codebase are executed during the tests.
	 *   This data is then used to generate coverage reports.
	 */
	collectCoverage: true,

	// An array of glob patterns indicating a set of files for which coverage information should be collected
	// collectCoverageFrom: undefined,

	/**
	 * The directory where Jest should output its coverage files.
	 *
	 * - This specifies the location where Jest will write the coverage reports.
	 *   The reports can then be used to analyze test coverage and identify areas of the code that are not adequately tested.
	 */
	coverageDirectory: 'coverage',

	// An array of regexp pattern strings used to skip coverage collection
	// coveragePathIgnorePatterns: [
	//   "\\\\node_modules\\\\" // Default pattern for node_modules
	// ],

	/**
	 * Indicates which provider should be used to instrument code for coverage.
	 *
	 * - 'v8' is chosen as the coverage provider. This leverages the V8 engine's built-in coverage capabilities.
	 */
	coverageProvider: 'v8',

	// A list of reporter names that Jest uses when writing coverage reports
	// coverageReporters: [
	//   "json",
	//   "text",
	//   "lcov",
	//   "clover"
	// ],

	// An object that configures minimum threshold enforcement for coverage results
	// coverageThreshold: undefined,

	// A path to a custom dependency extractor
	// dependencyExtractor: undefined,

	// Make calling deprecated APIs throw helpful error messages
	// errorOnDeprecated: false,

	// The default configuration for fake timers
	// fakeTimers: {
	//   "enableGlobally": false
	// },

	// Force coverage collection from ignored files using an array of glob patterns
	// forceCoverageMatch: [],

	// A path to a module which exports an async function that is triggered once before all test suites
	// globalSetup: undefined,

	// A path to a module which exports an async function that is triggered once after all test suites
	// globalTeardown: undefined,

	// A set of global variables that need to be available in all test environments
	// globals: {},

	// The maximum amount of workers used to run your tests. Can be specified as % or a number. E.g. maxWorkers: 10% will use 10% of your CPU amount + 1 as the maximum worker number. maxWorkers: 2 will use a maximum of 2 workers.
	// maxWorkers: "50%", // Default based on system

	// An array of directory names to be searched recursively up from the requiring module's location
	// moduleDirectories: [
	//   "node_modules" // Default
	// ],

	// An array of file extensions your modules use
	// moduleFileExtensions: [ // Default extensions Jest looks for
	//   "js",
	//   "mjs",
	//   "cjs",
	//   "jsx",
	//   "ts",
	//   "tsx",
	//   "json",
	//   "node"
	// ],

	/**
	 * A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module.
	 *
	 * - Uses `ts-jest`'s helper function `pathsToModuleNameMapper` to generate a module name mapper based on the paths defined in `tsconfig.json`.
	 *   This allows Jest to resolve modules using the same path aliases as TypeScript, such as `@/components`.
	 *   The `prefix` option is essential, it defines the root directory, relative to the jest config file.
	 */
	moduleNameMapper: pathsToModuleNameMapper(tsconfigPaths, {
		/**
		 *  Prefix needs to be set to the project root directory relative to the jest config file location.
		 *  <rootDir> is Jest's token for the project root.
		 */
		prefix: '<rootDir>/'
	}),

	// An array of regexp pattern strings, matched against all module paths before considered 'visible' to the module loader
	// modulePathIgnorePatterns: [],

	// Activates notifications for test results
	// notify: false,

	// An enum that specifies notification mode. Requires { notify: true }
	// notifyMode: "failure-change",

	/**
	 * A preset that is used as a base for Jest's configuration.
	 *
	 * - 'ts-jest' is used as the preset. This preconfigures Jest to work seamlessly with TypeScript projects,
	 *   handling compilation and module resolution.
	 */
	preset: 'ts-jest',

	// Run tests from one or more projects
	// projects: undefined,

	// Use this configuration option to add custom reporters to Jest
	// reporters: undefined,

	// Automatically reset mock state before every test
	// resetMocks: false,

	// Reset the module registry before running each individual test
	// resetModules: false,

	// A path to a custom resolver
	// resolver: undefined,

	// Automatically restore mock state and implementation before every test
	// restoreMocks: false,

	// The root directory that Jest should scan for tests and modules within
	// rootDir: undefined, // Jest usually figures this out

	// A list of paths to directories that Jest should use to search for files in
	// roots: [ // Defaults to <rootDir>
	//   "<rootDir>"
	// ],

	// Allows you to use a custom runner instead of Jest's default test runner
	// runner: "jest-runner",

	// The paths to modules that run some code to configure or set up the testing environment before each test
	// setupFiles: [],

	// A list of paths to modules that run some code to configure or set up the testing framework before each test
	// setupFilesAfterEnv: [],

	// The number of seconds after which a test is considered as slow and reported as such in the results.
	// slowTestThreshold: 5,

	// A list of paths to snapshot serializer modules Jest should use for snapshot testing
	// snapshotSerializers: [],

	/**
	 * The test environment that will be used for testing.
	 *
	 * - Explicitly set to 'node' as this is a Node.js project.
	 */
	testEnvironment: "node",

	// Options that will be passed to the testEnvironment
	// testEnvironmentOptions: {},

	// Adds a location field to test results
	// testLocationInResults: false,

	// The glob patterns Jest uses to detect test files
	// testMatch: [ // Default patterns
	//   "**/__tests__/**/*.[jt]s?(x)",
	//   "**/?(*.)+(spec|test).[tj]s?(x)"
	// ],

	// An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
	// testPathIgnorePatterns: [ // Default pattern
	//   "\\\\node_modules\\\\"
	// ],

	// The regexp pattern or array of patterns that Jest uses to detect test files
	// testRegex: [], // Can be used instead of testMatch

	// This option allows the use of a custom results processor
	// testResultsProcessor: undefined,

	// This option allows use of a custom test runner
	// testRunner: "jest-circus/runner", // Default runner

	// A map from regular expressions to paths to transformers
	// transform: undefined, // ts-jest preset handles this

	// An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
	// transformIgnorePatterns: [ // Default patterns
	//   "\\\\node_modules\\\\",
	//   "\\.pnp\\.[^\\\\]+$"
	// ],

	// An array of regexp pattern strings that are matched against all modules before the module loader will automatically return a mock for them
	// unmockedModulePathPatterns: undefined,

	// Indicates whether each individual test should be reported during the run
	// verbose: undefined, // Defaults to false

	// An array of regexp patterns that are matched against all source file paths before re-running tests in watch mode
	// watchPathIgnorePatterns: [],

	// Whether to use watchman for file crawling
	// watchman: true, // Defaults to true if watchman is installed
};

/**
 * Exports the Jest configuration object.
 *
 * This allows Jest to load and use the configuration when running tests.
 */
export default config;