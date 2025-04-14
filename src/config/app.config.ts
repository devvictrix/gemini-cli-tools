// src/config/app.config.ts

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Handle ESM paths for dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env from project root (assuming config is in src/config)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });


// --- Required API Key ---
/**
 * The Gemini API key.
 * This is a required environment variable.
 * @throws {Error} If the GEMINI_API_KEY environment variable is not set.
 */
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY environment variable not found.");
    console.log("Please create a .env file in the project root and add your API key:");
    console.log("GEMINI_API_KEY=YOUR_API_KEY_HERE");
    process.exit(1);
}

// --- Selectable Model Name ---
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash-latest';
/**
 * The Gemini model name to use.
 * Defaults to 'gemini-1.5-flash-latest' if the GEMINI_MODEL_NAME environment variable is not set.
 */
export const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL_NAME || DEFAULT_GEMINI_MODEL;

// --- Construct Endpoint Dynamically ---
// Base URL structure for the generateContent method
const GEMINI_API_BASE = `https://generativelanguage.googleapis.com/v1beta/models`;
/**
 * The full Gemini API endpoint URL.
 * This is constructed dynamically using the GEMINI_API_BASE and GEMINI_MODEL_NAME.
 */
export const GEMINI_API_ENDPOINT = `${GEMINI_API_BASE}/${GEMINI_MODEL_NAME}:generateContent`; // Construct the full endpoint URL


// --- Log Loaded Configuration ---
// Moved logging to where config is first imported (e.g., gemini.service) to avoid top-level side effects
console.log("Configuration loaded.");
console.log(` > Using Gemini Model: ${GEMINI_MODEL_NAME}`);
console.log(` > Gemini Endpoint: ${GEMINI_API_ENDPOINT}`);