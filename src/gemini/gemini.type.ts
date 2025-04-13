// File: src/gemini/gemini.type.ts

/**
 * Represents the standardized result structure from the Gemini service.
 */
export interface GeminiEnhancementResult {
    /** The type of content returned: 'code', 'text', or 'error'. */
    type: 'code' | 'text' | 'error';
    /** The content of the result (code, text, or error message), or null if an error occurred before content generation. */
    content: string | null;
}