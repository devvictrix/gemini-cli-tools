import path from 'path';
import { z } from 'zod'; // Import Zod
import { createEnv } from 'schema-env'; // Import createEnv

// --- Define Environment Schema ---
const envSchema = z.object({
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
 * The application will not start if required variables are missing or invalid.
 */
export const env = createEnv({
    schema: envSchema,
    dotEnvPath: dotEnvPath, // Explicitly provide the path
});
console.log('env', env);

// --- Optional: Log Confirmation (can be done where env is first used) ---
// console.log(`[AppConfig] Environment loaded successfully. Using model: ${env.GEMINI_MODEL_NAME}`);

// --- Old manual logic is removed ---
// No need for manual dotenv.config() call - createEnv handles it.
// No need for manual check/process.exit() for GEMINI_API_KEY - Zod schema handles required fields.
// No need to construct GEMINI_API_ENDPOINT here - construct it where needed using env.GEMINI_MODEL_NAME.