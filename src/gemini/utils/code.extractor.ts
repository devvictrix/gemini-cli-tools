// src/gemini/utils/code.extractor.ts

/**
 * Attempts to extract a code block fenced by markdown backticks (```)
 * from a given text. Handles optional language identifiers like 'ts' or 'typescript'.
 * Prioritizes the first matching block found. Includes detailed logging.
 * @param text The text potentially containing the code block (e.g., Gemini response).
 * @returns The extracted code content as a string, or null if no block is found.
 */
export function extractCodeBlock(text: string): string | null {
    if (!text) {
        console.warn("[Extractor] Input text is null or empty.");
        return null;
    }
    // Log the very beginning of the text received for context
    console.log(`[Extractor] Received text to process (start): "${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"`);

    console.log("[Extractor] Attempting extraction with primary regex: /```(?:\\w+)?\\s*([\\s\\S]*?)\\s*```/");
    const primaryRegex = /```(?:\w+)?\s*([\s\S]*?)\s*```/;
    const markdownMatch = text.match(primaryRegex);

    if (markdownMatch && typeof markdownMatch[1] === 'string') {
        const extracted = markdownMatch[1]; // Content of the first capture group
        console.log(`[Extractor] Primary regex matched successfully.`);
        console.log(`[Extractor] Captured Group 1 Length: ${extracted.length}`);
        // Log a preview of what was actually captured inside the group
        console.log(`[Extractor] Captured Group 1 Preview: "${extracted.substring(0, 150)}${extracted.length > 150 ? '...' : ''}"`);
        // Trim the result before returning
        const trimmedResult = extracted.trim();
        console.log(`[Extractor] Trimmed Result Length: ${trimmedResult.length}`);
        return trimmedResult;
    } else {
        console.log("[Extractor] Primary regex did NOT match or group 1 was invalid/not found.");
        if (markdownMatch) {
            console.log(`[Extractor] Primary regex matched overall, but group 1 was: ${markdownMatch[1] === undefined ? 'undefined' : typeof markdownMatch[1]}`);
        }
    }

    // Fallback attempt only if primary failed
    console.log("[Extractor] Attempting extraction with fallback regex: /```([\\s\\S]*?)```/");
    const fallbackRegex = /```([\s\S]*?)```/;
    const simpleMatch = text.match(fallbackRegex);

    if (simpleMatch && typeof simpleMatch[1] === 'string') {
        const extracted = simpleMatch[1];
        console.warn("[Extractor] Using FALLBACK regex for code block extraction.");
        console.log(`[Extractor] Fallback regex matched successfully.`);
        console.log(`[Extractor] Fallback Captured Group 1 Length: ${extracted.length}`);
        console.log(`[Extractor] Fallback Captured Group 1 Preview: "${extracted.substring(0, 150)}${extracted.length > 150 ? '...' : ''}"`);
        const trimmedResult = extracted.trim();
        console.log(`[Extractor] Fallback Trimmed Result Length: ${trimmedResult.length}`);
        return trimmedResult;
    } else {
        console.log("[Extractor] Fallback regex did NOT match or group 1 was invalid/not found.");
        if (simpleMatch) {
            console.log(`[Extractor] Fallback regex matched overall, but group 1 was: ${simpleMatch[1] === undefined ? 'undefined' : typeof simpleMatch[1]}`);
        }
    }

    console.warn("[Extractor] CRITICAL: Could not find any fenced code block (```...```) in the received text.");
    // Log the beginning of the text again when extraction completely fails
    console.log(`[Extractor] Text start that FAILED extraction: "${text.substring(0, 250)}${text.length > 250 ? '...' : ''}"`)
    return null;
}