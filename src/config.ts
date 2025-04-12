// src/config.ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// --- Required API Key ---
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY environment variable not found.");
    console.log("Please create a .env file in the project root and add your API key:");
    console.log("GEMINI_API_KEY=YOUR_API_KEY_HERE");
    process.exit(1);
}

// --- Selectable Model Name ---
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash-latest';
export const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL_NAME || DEFAULT_GEMINI_MODEL;

// --- Construct Endpoint Dynamically ---
// Base URL structure for the generateContent method
const GEMINI_API_BASE = `https://generativelanguage.googleapis.com/v1beta/models`;
export const GEMINI_API_ENDPOINT = `${GEMINI_API_BASE}/${GEMINI_MODEL_NAME}:generateContent`;


// --- Log Loaded Configuration ---
console.log("Configuration loaded.");
console.log(` > Using Gemini Model: ${GEMINI_MODEL_NAME}`);
// Optionally log the endpoint for debugging, but it can be long
// console.log(` > Gemini Endpoint: ${GEMINI_API_ENDPOINT}`);