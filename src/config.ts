// src/config.ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`;
// CODE_FILE_PATH is removed

if (!GEMINI_API_KEY) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY environment variable not found.");
    console.log("Please create a .env file in the project root and add your API key:");
    console.log("GEMINI_API_KEY=YOUR_API_KEY_HERE");
    process.exit(1);
}

// Optional: Log confirmation that config is loaded
console.log("Configuration loaded.");