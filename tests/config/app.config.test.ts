import { describe, it, expect, jest } from '@jest/globals';
import * as appConfig from '../src/config/app.config';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock dotenv.config to prevent it from reading the actual .env file during tests
jest.mock('dotenv');
jest.mock('url');
jest.mock('path');

// Mock console.error and console.log to prevent output during tests
console.error = jest.fn();
console.log = jest.fn();

describe('App Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // Clears the cache between tests.

    // Reset environment variables before each test
    process.env = { ...originalEnv };

    (dotenv.config as jest.Mock).mockClear();
    (path.resolve as jest.Mock).mockClear();
    (fileURLToPath as jest.Mock).mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('GEMINI_API_KEY', () => {
    it('should export GEMINI_API_KEY if it is set in environment variables', () => {
      process.env.GEMINI_API_KEY = 'test-api-key';

      const config = require('../src/config/app.config'); // Use require to load the module after setting env vars.
      expect(config.GEMINI_API_KEY).toBe('test-api-key');
    });

    it('should terminate the process if GEMINI_API_KEY is not set', () => {
      delete process.env.GEMINI_API_KEY;
      const originalExit = process.exit;
      process.exit = jest.fn() as never;

      //Dynamically load the module and check if process.exit is called
      require('../src/config/app.config');
      expect(process.exit).toHaveBeenCalledWith(1);

      process.exit = originalExit; // Restore original exit
    });
  });

  describe('GEMINI_MODEL_NAME', () => {
    it('should export GEMINI_MODEL_NAME if it is set in environment variables', () => {
      process.env.GEMINI_MODEL_NAME = 'test-model-name';
      const config = require('../src/config/app.config');
      expect(config.GEMINI_MODEL_NAME).toBe('test-model-name');
    });

    it('should default to "gemini-1.5-flash-latest" if GEMINI_MODEL_NAME is not set', () => {
      delete process.env.GEMINI_MODEL_NAME;
      const config = require('../src/config/app.config');
      expect(config.GEMINI_MODEL_NAME).toBe('gemini-1.5-flash-latest');
    });
  });

  describe('GEMINI_API_ENDPOINT', () => {
    it('should construct the API endpoint correctly with environment variables', () => {
      process.env.GEMINI_MODEL_NAME = 'test-model';
      const config = require('../src/config/app.config');
      expect(config.GEMINI_API_ENDPOINT).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent'
      );
    });

    it('should construct the API endpoint correctly with default model name', () => {
      delete process.env.GEMINI_MODEL_NAME;
      const config = require('../src/config/app.config');
      expect(config.GEMINI_API_ENDPOINT).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent'
      );
    });
  });

  it('should call dotenv.config with the correct path', () => {
    (fileURLToPath as jest.Mock).mockReturnValue('/path/to/src/config/app.config.ts');
    (path.dirname as jest.Mock).mockReturnValue('/path/to/src/config');
    process.env.GEMINI_API_KEY = 'test-api-key'; // Prevent process.exit

    require('../src/config/app.config');

    expect(dotenv.config).toHaveBeenCalledTimes(1);
    expect(path.resolve).toHaveBeenCalledWith('/path/to/src/config', '../../.env');
    expect(dotenv.config).toHaveBeenCalledWith({ path: '/path/to/src/.env' });
  });

  it('should handle errors during dotenv path resolution', () => {
    (fileURLToPath as jest.Mock).mockImplementation(() => { throw new Error("Test Error"); });
    (path.dirname as jest.Mock).mockReturnValue('/path/to/src/config');
    process.env.GEMINI_API_KEY = 'test-api-key'; // Prevent process.exit

    expect(() => require('../src/config/app.config')).toThrowError("Test Error");
  });
});