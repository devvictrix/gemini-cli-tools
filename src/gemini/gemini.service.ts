// File: src/gemini/gemini.service.ts

import axios, { AxiosError, AxiosResponse } from 'axios';
import { EnhancementType } from '../shared/types/enhancement.type.js';
import { GEMINI_API_KEY, GEMINI_API_ENDPOINT } from '../config.js';
import { extractCodeBlock } from './utils/code.extractor.js';

/**
 * Represents the result of a Gemini enhancement operation.
 */
export interface GeminiEnhancementResult {
    /** The type of content returned: 'code', 'text', or 'error'. */
    type: 'code' | 'text' | 'error';
    /** The content of the result, which can be a string or null if an error occurred. */
    content: string | null;
}

/**
 * Generates the appropriate prompt for the Gemini API based on the desired enhancement.
 * @param enhancement The type of enhancement to perform.
 * @param code The source code to be enhanced or analyzed.
 * @returns The generated prompt string.
 */
function generatePrompt(enhancement: EnhancementType, code: string): string {
    console.log(`[Gemini] Generating prompt for enhancement type: ${enhancement}`);
    switch (enhancement) {
        case EnhancementType.AddComments:
            return `
Review the following TypeScript/JavaScript code. Add comprehensive TSDoc/JSDoc comments /** ... */ for all exported functions, classes, interfaces, types, and significant internal logic. Include @param, @returns, @throws tags where appropriate.
Also add concise inline comments // using // for complex or non-obvious implementation steps within functions or methods.
Ensure existing comments are preserved or improved if necessary.

**CRITICAL INSTRUCTION:** You MUST return the **ENTIRE, COMPLETE, ORIGINAL FILE CONTENT**, including all existing code and comments, with ONLY the new TSDoc/JSDoc and inline comments added or updated as requested. Do NOT omit any part of the original file.
**RESPONSE FORMAT:** Respond ONLY with the full, updated code block itself, enclosed in a single \`\`\`typescript ... \`\`\` or \`\`\`javascript ... \`\`\` block. Do not include ANY introductory text, closing remarks, or explanations outside the code block.

\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.Analyze: // Keep Analyze separate for potentially different focus later
            return `
Analyze the following code. Provide a high-level overview of its purpose, structure, and key components. Identify potential areas for improvement regarding clarity, efficiency, or adherence to best practices, but focus on analysis rather than direct suggestions.

\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.Explain:
            return `
Explain the following TypeScript/JavaScript code in simple terms. Describe its overall purpose, how the main parts work together, and what specific functions or classes are responsible for. Assume the reader has some programming knowledge but may not be familiar with this specific code.

\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.SuggestImprovements: // New
            return `
Act as a senior software engineer performing a code review on the following TypeScript/JavaScript code. Provide specific, actionable suggestions for improvement. Focus on:
1.  **Readability & Clarity:** Can variable names, function names, or structure be improved? Is the logic easy to follow?
2.  **Potential Bugs & Edge Cases:** Are there any obvious logical errors, potential null/undefined issues, or unhandled edge cases?
3.  **Best Practices:** Does the code follow common language idioms and best practices (e.g., error handling, immutability, proper use of async/await)?
4.  **Performance:** Are there any obvious performance bottlenecks or areas where efficiency could be significantly improved? (Avoid premature optimization).
5.  **Maintainability:** How easy would it be to modify or extend this code later? Suggest ways to improve modularity or reduce coupling if applicable.

**RESPONSE FORMAT:** Present your suggestions clearly, perhaps using bullet points or numbered lists, referencing specific lines or sections of the code where possible. Be constructive and explain the reasoning behind each suggestion. Do NOT rewrite the code yourself. Respond only with the suggestions.

\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.GenerateDocs: // New
            return `
Analyze the following TypeScript/JavaScript code and generate documentation in Markdown format suitable for a README file section or a separate documentation file.

The documentation should include:
1.  **Overview:** A brief description of the code's overall purpose and functionality.
2.  **Key Components:** Descriptions of major functions, classes, or modules, including their responsibilities.
3.  **Usage Examples (if applicable):** Show how to use the primary functions or classes with simple examples.
4.  **Inputs/Outputs (if applicable):** Describe important function parameters and return values.

**RESPONSE FORMAT:** Respond ONLY with the generated Markdown content. Do not include any introductory text, closing remarks, or explanations outside the Markdown. Start directly with the Markdown content (e.g., starting with a heading like '## Module Documentation').

\`\`\`typescript
${code}
\`\`\`
`;
        // Note: InferFromData does not use Gemini, so no prompt needed here.
        // Note: AddPathComment and Consolidate do not use Gemini.

        default:
            // Should not happen if using enum correctly, but good practice
            console.warn(`[Gemini] Unknown enhancement type for prompt generation: ${enhancement}. Using generic prompt.`);
            // Returns a generic prompt as a fallback
            return `Review and provide feedback on the following code:\n\n\`\`\`typescript\n${code}\n\`\`\``;
    }
}

/**
 * Calls the Gemini API with the generated prompt.
 * Handles API request/response logic and basic error handling.
 * @param promptText The complete prompt to send to the Gemini API.
 * @returns A promise resolving to the raw text response from Gemini, or null if an error occurs.
 */
async function callGeminiApi(promptText: string): Promise<string | null> {
    console.log(`[Gemini] Sending request to Gemini API (${promptText.length} chars)...`);
    // Log a preview, careful not to log sensitive info if prompts contain keys/secrets in future
    // const preview = promptText.length > 500 ? promptText.substring(0, 500) + '...' : promptText;
    // console.log("--- Prompt Preview ---");
    // console.log(preview);
    // console.log("----------------------");

    const requestData = {
        contents: [{ parts: [{ text: promptText }] }],
        // Optional: Configure generation parameters
        // generationConfig: {
        //     temperature: 0.7, // Controls randomness (0=deterministic, 1=max creative)
        //     topK: 40,       // Consider top K most likely tokens
        //     topP: 0.95,     // Consider tokens comprising P cumulative probability
        //     maxOutputTokens: 8192, // Max tokens in response
        // },
        // Optional: Safety Settings (adjust levels as needed)
        // safetySettings: [
        //     { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        //     { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        //     { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        //     { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        // ]
    };

    const config = {
        headers: { 'Content-Type': 'application/json' },
        params: { key: GEMINI_API_KEY },
        timeout: 120000 // Increase timeout (e.g., 120 seconds) for potentially longer generation tasks
    };

    try {
        const response: AxiosResponse = await axios.post(GEMINI_API_ENDPOINT, requestData, config);

        // Robustly check for response structure and potential blocks
        const candidate = response.data?.candidates?.[0];

        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
            console.warn(`[Gemini] Warning: Response generation finished due to reason: ${candidate.finishReason}.`);
            if (candidate.finishReason === "SAFETY") {
                console.error("[Gemini] ❌ Error: Gemini blocked the response due to safety settings.");
                // Log safety ratings if available
                if (candidate.safetyRatings) {
                    console.error("[Gemini] Safety Ratings:", JSON.stringify(candidate.safetyRatings, null, 2));
                }
                return null; // Indicate failure due to safety block
            }
            // Other reasons might include MAX_TOKENS, RECITATION, etc.
        }

        const responseText = candidate?.content?.parts?.[0]?.text;

        if (responseText) {
            console.log(`[Gemini] Received response (${responseText.trim().length} chars).`);
            return responseText.trim();
        } else {
            console.warn("[Gemini] Warning: Received response, but no text content found in the expected location.");
            console.log("[Gemini] Full Response Data:", JSON.stringify(response.data, null, 2));
            return null; // Indicate unexpected structure
        }
    } catch (error) {
        console.error("[Gemini] ❌ Error calling Gemini API:");
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            console.error(`  Status: ${axiosError.response.status}`);
            console.error(`  Data: ${JSON.stringify(axiosError.response.data, null, 2)}`);
            // Check for specific Gemini error details if available
            const geminiError = (axiosError.response.data as any)?.error;
            if (geminiError) {
                console.error(`  Gemini Error Code: ${geminiError.code}`);
                console.error(`  Gemini Error Message: ${geminiError.message}`);
                console.error(`  Gemini Error Status: ${geminiError.status}`);
            }

        } else if (axiosError.request) {
            console.error("  Request Error: No response received (check network, endpoint, timeout).", axiosError.code);
        } else {
            console.error('  Setup Error Message:', axiosError.message);
        }
        return null; // Indicate failure
    }
}


/**
 * Orchestrates the process of enhancing code or generating text via the Gemini API.
 * Determines expected output type based on action and processes the response.
 * @param enhancementType The type of enhancement/generation requested.
 * @param code The source code (or consolidated code) to process.
 * @returns A promise resolving to a GeminiEnhancementResult.
 */
export async function enhanceCodeWithGemini(
    enhancementType: EnhancementType,
    code: string
): Promise<GeminiEnhancementResult> {

    // Actions expected to return code
    const expectsCode = [
        EnhancementType.AddComments,
        // Add future code-generating actions here (e.g., Refactor, GenerateTests)
    ].includes(enhancementType);

    // Actions expected to return text (analysis, explanation, docs, etc.)
    const expectsText = [
        EnhancementType.Analyze,
        EnhancementType.Explain,
        EnhancementType.SuggestImprovements,
        EnhancementType.GenerateDocs,
    ].includes(enhancementType);

    // Generate the appropriate prompt
    const prompt = generatePrompt(enhancementType, code);
    if (!prompt) {
        return { type: 'error', content: `Failed to generate prompt for action: ${enhancementType}` };
    }

    // Call the API
    const rawResponse = await callGeminiApi(prompt);

    // Handle API call failure
    if (rawResponse === null) { // Check explicitly for null, as "" could be a valid (empty) response
        return { type: 'error', content: 'Failed to get a valid response from Gemini API.' };
    }

    // Process response based on expected type
    if (expectsCode) {
        console.log(`[Gemini] Processing response for ${enhancementType} (expects code)...`);
        const extractedCode = extractCodeBlock(rawResponse);
        if (extractedCode) {
            console.log("[Gemini] Code block extracted successfully.");
            return { type: 'code', content: extractedCode };
        } else {
            console.warn(`[Gemini] ${enhancementType} requested, but couldn't extract a fenced code block.`);
            console.log("--- Full Raw Response (for debugging code extraction) ---");
            console.log(rawResponse);
            console.log("--- End Full Raw Response ---");
            return { type: 'error', content: `Failed to extract valid code block from Gemini response for ${enhancementType}. Raw response logged.` };
        }
    } else if (expectsText) {
        console.log(`[Gemini] Processing response for ${enhancementType} (expects text)...`);
        // For text-based results, return the raw response directly
        return { type: 'text', content: rawResponse };
    } else {
        // Should not happen if all Gemini-using types are covered above
        console.error(`[Gemini] Internal Error: Unhandled enhancement type in Gemini response processing: ${enhancementType}`);
        return { type: 'error', content: `Unhandled enhancement type: ${enhancementType}` };
    }
}
