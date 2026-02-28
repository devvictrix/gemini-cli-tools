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

    /**
     * The API version to use for the Gemini API.
     * Defaults to 'v1beta'. Options usually include 'v1', 'v1beta', 'v1alpha'.
     */
    GEMINI_API_VERSION: z.string().default('v1beta'),

    /**
     * Set of file extensions to include during inspection.
     */
    INCLUDE_EXTENSIONS: z.string()
        .default(".ts,.js,.json,.env,.yml,.yaml,.md,.tsx,.py,.sh,.html,.css,.go,.bru,.sql,.prisma,.csv,.php")
        .transform((str) => new Set(str.split(',').map(s => s.trim()).filter(Boolean))),

    /**
     * Set of directory or file name patterns to exclude during inspection.
     */
    EXCLUDE_PATTERNS: z.string()
        .default("node_modules,dist,build,.git,coverage,.nuxt,.output,.vscode,public,storage,src/storage,logs,__pycache__,.mypy_cache,.venv,.expo,.next,kiosk-ui,sound-api,queue-ui")
        .transform((str) => new Set(str.split(',').map(s => s.trim()).filter(Boolean))),

    /**
     * Set of specific filenames to exclude during inspection.
     */
    EXCLUDE_FILENAMES: z.string()
        .default("package-lock.json,consolidated_sources.ts,consolidated_output.txt,code.extractor.ts,README.md,docs.md")
        .transform((str) => new Set(str.split(',').map(s => s.trim()).filter(Boolean))),

    /**
     * Set of wildcard filename patterns to exclude during inspection.
     */
    EXCLUDE_FILENAME_WILDCARDS: z.string()
        .default("*.spec.ts,*.spec.tsx,*.test.ts,*.test.tsx,*mock*,*mocks*")
        .transform((str) => new Set(str.split(',').map(s => s.trim()).filter(Boolean))),
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