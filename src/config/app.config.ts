// File: src/config/app.config.ts

import dotenv from 'dotenv';
import path from 'path';

// --- CJS Compatibility ---
// In CommonJS, __dirname is a global variable representing the directory of the current module.

// --- Load Environment Variables ---
// Load environment variables from the .env file in the project root directory.
// Assumes the configuration file is located in `src/config`, so we navigate two levels up.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });


// --- Required API Key ---
/**
 * The Gemini API key used to authenticate with the Gemini API.
 * This is a *required* environment variable. The application will terminate if it's not set.
 * @throws {Error} If the `GEMINI_API_KEY` environment variable is not set. This is a critical error indicating a missing API key.
 */
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Check if the Gemini API key is set. If not, exit the application with an error message.
if (!GEMINI_API_KEY) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY environment variable not found.");
    console.log("Please create a .env file in the project root and add your API key:");
    console.log("GEMINI_API_KEY=YOUR_API_KEY_HERE");
    // It's generally good practice to provide a more informative exit code.
    // Exit code 1 is a general error, but you could use a more specific code (e.g., 10)
    // to indicate a missing configuration error.
    process.exit(1); // Exit the process to prevent the application from running without the API key.
}

// --- Selectable Model Name ---
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash-latest'; // Define a constant for better readability.
/**
 * The Gemini model name to use for generating content.
 * Defaults to 'gemini-1.5-flash-latest' if the `GEMINI_MODEL_NAME` environment variable is not set.
 * This allows for easy switching between different Gemini models via environment configuration.
 */
export const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL_NAME || DEFAULT_GEMINI_MODEL;

// --- Construct Endpoint Dynamically ---
// Base URL structure for the generateContent method.  This is the common part of the Gemini API endpoint.
const GEMINI_API_BASE = `https://generativelanguage.googleapis.com/v1beta/models`;
/**
 * The full Gemini API endpoint URL for generating content.
 * This is constructed dynamically using the `GEMINI_API_BASE` and `GEMINI_MODEL_NAME`.
 * This approach makes it easy to update the model being used without modifying the core URL structure.
 */
export const GEMINI_API_ENDPOINT = `${GEMINI_API_BASE}/${GEMINI_MODEL_NAME}:generateContent`; // Construct the full endpoint URL

// --- Log Loaded Configuration ---
// Moved logging to where config is first imported (e.g., gemini.service) to avoid top-level side effects.
// This ensures that the configuration is only logged when it's actually being used, preventing unnecessary output.
// This also helps to keep the config file pure and free from side effects.
//  ***  IMPORTANT:  This logging *must* occur in the importing module for it to be useful.  ***

//Suggestion: Consider using a proper logging library (like Winston or Bunyan) instead of console.log
// for more robust logging features (e.g., log levels, file rotation, etc.)
//console.log("Configuration loaded.");

// Logs the configured Gemini model and endpoint to the console.
// This helps in verifying the loaded configuration during application startup.
console.log(` > Using Gemini Model: ${GEMINI_MODEL_NAME}`);
console.log(` > Gemini Endpoint: ${GEMINI_API_ENDPOINT}`);