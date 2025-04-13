// src/gemini/utils/code.extractor.ts

/**
 * Attempts to extract a code block fenced by markdown backticks (```)
 * from a given text, prioritizing typescript/ts blocks.
 * @param text The text potentially containing the code block (e.g., Gemini response).
 * @returns The extracted code content as a string, or null if no block is found.
 */
export function extractCodeBlock(text: string): string | null {
    if (!text) return null;
    // Original simple regex (non-greedy is usually preferred if the LLM behaves)
    const markdownMatch = text.match(/```(?:typescript|ts)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1].trim();
    }
    // Keep the warning, remove verbose logs
    console.warn("[Extractor] Could not find a ```typescript ... ``` or similar fenced code block in the text.");
    return null;
}