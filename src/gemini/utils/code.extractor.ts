// src/gemini/utils/code.extractor.ts
// Utility specifically for extracting code blocks, often needed by Gemini service.

const logPrefix = "[CodeExtractor]";

/**
 * Extracts code content from the first fenced code block (```...```) found in a string.
 * Handles optional language identifiers (e.g., ```typescript).
 * @param text The text potentially containing a fenced code block.
 * @returns The extracted code content (trimmed) or null if no valid block is found.
 */
export function extractCodeBlock(text: string): string | null {
	// Regex to find fenced code blocks, capturing the content inside.
	// It handles optional language identifiers after the opening fence.
	// ```                  - Matches the opening fence
	// [\w-]*                - Matches an optional language identifier (letters, numbers, hyphen)
	// \s*                   - Matches optional whitespace
	// \n                    - Matches the newline after the opening fence
	// ([\s\S]*?)            - Captures the content inside (non-greedy)
	// \n                    - Matches the newline before the closing fence
	// ```                  - Matches the closing fence
	const codeBlockRegex = /^```[\w-]*\s*\n([\s\S]*?)\n```$/m; // Added ^ and $ for stricter matching, m for multiline

	const match = text.trim().match(codeBlockRegex); // Trim the input first

	if (match && match[1]) {
		console.log(`${logPrefix} Found and extracted code block.`);
		return match[1].trim(); // Return the captured group (the code), trimmed
	} else {
		console.warn(`${logPrefix} No fenced code block found in the provided text.`);
		// Optional: Log the text if debugging is needed
		// console.log("--- Text Searched ---");
		// console.log(text);
		// console.log("---------------------");
		return null;
	}
}