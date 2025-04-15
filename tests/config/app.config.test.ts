import { describe, it, expect, jest } from '@jest/globals';
import * as appConfig from '../src/config/app.config';
import dotenv from 'dotenv';
import path from 'path';

// Mock dotenv.config to prevent it from reading from a real .env file during tests.
jest.mock('dotenv');

// Mock path.resolve to control the path resolution in the test environment.
jest.mock('path');

describe('app.config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment variables to restore them after each test.
    originalEnv = process.env;
    process.env = { ...originalEnv }; // Create a copy to avoid modifying the original.

    // Reset mocks before each test
    (dotenv.config as jest.Mock).mockClear();
    (path.resolve as jest.Mock).mockClear();

    // Provide a default mock implementation for path.resolve
    (path.resolve as jest.Mock).mockImplementation((...args: string[]) => args.join('/'));

    // Suppress console.log and console.error during tests to avoid cluttering the output.
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Restore process.exit mock to its original implementation before each test.
    jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code}) was called.`);
    });
  });

  afterEach(() => {
    // Restore original environment variables after each test.
    process.env = originalEnv;
    jest.restoreAllMocks();
  });


  describe('GEMINI_API_KEY', () => {
    it('should return the GEMINI_API_KEY from environment variables if it exists', () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      expect(appConfig.GEMINI_API_KEY).toBe('test-api-key');
    });

    it('should call process.exit(1) if GEMINI_API_KEY is not set', () => {
        delete process.env.GEMINI_API_KEY;
        jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
          throw new Error(`process.exit(${code}) was called.`);
        });

        expect(() => {
            // Accessing the variable triggers the error handling logic in the module's top-level scope.
            require('../src/config/app.config'); // Reload the module
          }).toThrowError('process.exit(1) was called.');

    });
  });

  describe('GEMINI_MODEL_NAME', () => {
    it('should return the GEMINI_MODEL_NAME from environment variables if it exists', () => {
      process.env.GEMINI_MODEL_NAME = 'test-model-name';
      expect(appConfig.GEMINI_MODEL_NAME).toBe('test-model-name');
    });

    it('should return the default model name if GEMINI_MODEL_NAME is not set', () => {
      delete process.env.GEMINI_MODEL_NAME;
      expect(appConfig.GEMINI_MODEL_NAME).toBe('gemini-1.5-flash-latest');
    });
  });

  describe('GEMINI_API_ENDPOINT', () => {
    it('should construct the correct GEMINI_API_ENDPOINT with the model name', () => {
      process.env.GEMINI_MODEL_NAME = 'test-model-name';
      const expectedEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/test-model-name:generateContent`;
      expect(appConfig.GEMINI_API_ENDPOINT).toBe(expectedEndpoint);
    });

    it('should construct the correct GEMINI_API_ENDPOINT with the default model name when env variable is not set', () => {
      delete process.env.GEMINI_MODEL_NAME;
      const expectedEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`;
      expect(appConfig.GEMINI_API_ENDPOINT).toBe(expectedEndpoint);
    });
  });

  describe('dotenv.config', () => {
    it('should call dotenv.config with the correct path', () => {
      // Mock the return value of path.resolve to ensure it's predictable for testing.
      (path.resolve as jest.Mock).mockImplementation(() => 'mocked/path/.env');
      // Reload the module to apply the mocked path.resolve
      jest.resetModules();
      require('../src/config/app.config');

      expect(dotenv.config).toHaveBeenCalledWith({ path: 'mocked/path/.env' });
    });
  });
});