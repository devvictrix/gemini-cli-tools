// src/gemini/utils/code.extractor.ts

/**
 * Attempts to extract a code block fenced by markdown backticks (```)
 * from a given text. Handles optional language identifiers like 'ts' or 'typescript'.
 * Prioritizes the first matching block found.
 * @param text The text potentially containing the code block (e.g., Gemini response).
 * @returns The extracted code content as a string, or null if no block is found.
 */
export function extractCodeBlock(text: string): string | null {
    if (!text) return null;

    // Regex tries to find ``` optionally followed by a language identifier (like ts, typescript, etc.)
    // It captures everything non-greedily until the closing ```
    const markdownMatch = text.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/);

    if (markdownMatch && typeof markdownMatch[1] === 'string') { // Check if group 1 exists and is a string
        // Return the captured content, trimming leading/trailing whitespace common in blocks
        return markdownMatch[1].trim();
    }

    // If the primary regex fails, maybe the response formatting is simpler?
    // Try a simpler match just for backticks, though less specific.
    const simpleMatch = text.match(/```([\s\S]*?)```/);
    if (simpleMatch && typeof simpleMatch[1] === 'string') {
        console.warn("Used fallback regex for code block extraction (no language identifier found).");
        return simpleMatch[1].trim();
    }

    console.warn("Could not find any fenced code block (```...```) in the text.");
    return null;
}