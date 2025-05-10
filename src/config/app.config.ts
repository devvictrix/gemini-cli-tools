import path from 'path';
import { z } from 'zod'; // Import Zod
import { createEnv } from 'schema-env'; // Import createEnv

// --- Define Environment Schema ---
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production"]).default("development"),

    /**
     * The Gemini API key used to authenticate with the Gemini API.
     * This is a *required* environment variable. schema-env will throw an error if it's not set.
     */
    GEMINI_API_KEY: z.string().min(1, { message: "GEMINI_API_KEY environment variable cannot be empty." }),

    /**
     * The Gemini model name to use for generating content.
     * Defaults to 'gemini-1.5-flash-latest' if the `GEMINI_MODEL_NAME` environment variable is not set.
     */
    GEMINI_MODEL_NAME: z.string().default('gemini-1.5-flash-latest'),
});

// --- Load and Validate Environment ---
// Determine the path to the .env file, assuming it's in the project root
// process.cwd() usually refers to the directory where you run the `node` command from.
const dotEnvPath = path.resolve(process.cwd(), '.env');

/**
 * Validated and typed environment variables.
 * Loaded from `.env` (if present) and `process.env`, validated against envSchema.
 * Access variables like `env.GEMINI_API_KEY`.
 * The application will not start if required variables are missing or invalid,
 * as `createEnv` will throw an error.
 */
export const env = createEnv({
    schema: envSchema,
    dotEnvPath: dotEnvPath, // Explicitly provide the path
    // logging: true, // Optional: set to true for schema-env internal logging
    // override: false, // Optional: default is false (process.env does not override .env)
});

// --- Optional: Log Confirmation (can be done where env is first used, or enable schema-env logging) ---
console.log(`[AppConfig] Environment loaded successfully. Using model: ${env.GEMINI_MODEL_NAME}`);