import { describe, it, expect, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock the fs and path modules
jest.mock('fs');
jest.mock('path');

// Import the module under test (jest.config.ts)
import config from '../jest.config';

describe('jest.config.ts', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should define a Jest configuration object', () => {
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('should have clearMocks set to true', () => {
    expect(config.clearMocks).toBe(true);
  });

  it('should have collectCoverage set to true', () => {
    expect(config.collectCoverage).toBe(true);
  });

  it('should have coverageDirectory set to "coverage"', () => {
    expect(config.coverageDirectory).toBe('coverage');
  });

  it('should have coverageProvider set to "v8"', () => {
    expect(config.coverageProvider).toBe('v8');
  });

  it('should have preset set to "ts-jest"', () => {
    expect(config.preset).toBe('ts-jest');
  });

  it('should have testEnvironment set to "node"', () => {
    expect(config.testEnvironment).toBe('node');
  });

  describe('moduleNameMapper', () => {
    it('should use pathsToModuleNameMapper to create a module name mapper', () => {
      const mockTsconfig = {
        compilerOptions: {
          paths: {
            '@/components/*': ['src/components/*'],
          },
        },
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockTsconfig));
      (path.resolve as jest.Mock).mockReturnValue('/path/to/tsconfig.json');
      const { pathsToModuleNameMapper } = require('ts-jest'); // Import here after mocking

      const expectedModuleNameMapper = pathsToModuleNameMapper(mockTsconfig.compilerOptions.paths, {
        prefix: '<rootDir>/',
      });

      // Reload the config module after mocking fs and path and before asserting
      jest.resetModules();
      const reloadedConfig = require('../jest.config').default;

      expect(reloadedConfig.moduleNameMapper).toEqual(expectedModuleNameMapper);
    });

    it('should handle missing compilerOptions or paths gracefully', () => {
      const mockTsconfig = {};
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockTsconfig));
      (path.resolve as jest.Mock).mockReturnValue('/path/to/tsconfig.json');
      const { pathsToModuleNameMapper } = require('ts-jest'); // Import here after mocking

      const expectedModuleNameMapper = pathsToModuleNameMapper({}, {
        prefix: '<rootDir>/',
      });
       // Reload the config module after mocking fs and path and before asserting
       jest.resetModules();
       const reloadedConfig = require('../jest.config').default;

      expect(reloadedConfig.moduleNameMapper).toEqual(expectedModuleNameMapper);
    });
    it('should use <rootDir> in the prefix of the moduleNameMapper', () => {
      const mockTsconfig = {
        compilerOptions: {
          paths: {
            '@/components/*': ['src/components/*'],
          },
        },
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockTsconfig));
      (path.resolve as jest.Mock).mockReturnValue('/path/to/tsconfig.json');
      const { pathsToModuleNameMapper } = require('ts-jest'); // Import here after mocking

      pathsToModuleNameMapper(mockTsconfig.compilerOptions.paths, {
        prefix: '<rootDir>/',
      });

       // Reload the config module after mocking fs and path and before asserting
       jest.resetModules();
       const reloadedConfig = require('../jest.config').default;

       const prefix = Object.values(reloadedConfig.moduleNameMapper)[0][0];
       expect(prefix).toContain('<rootDir>/')
    });
  });
  it('reads tsconfig.json using fs.readFileSync', () => {
    const mockTsconfig = {
      compilerOptions: {
        paths: {
          '@/components/*': ['src/components/*'],
        },
      },
    };

    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockTsconfig));
    (path.resolve as jest.Mock).mockReturnValue('/path/to/tsconfig.json');

    jest.resetModules();
    require('../jest.config').default; // Re-require the module to apply mocks

    expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('tsconfig.json'), 'utf8');
  });
});