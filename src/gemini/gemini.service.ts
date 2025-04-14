// src/gemini/services/gemini.service.ts

import axios, { AxiosError, AxiosResponse } from 'axios';
import { GEMINI_API_ENDPOINT, GEMINI_API_KEY, GEMINI_MODEL_NAME } from '../config/app.config.js';
import { EnhancementType } from '../shared/enums/enhancement.type.js';
import { extractCodeBlock } from './utils/code.extractor.js';

// Log config when service is initialized (better than top-level in config file)
console.log(`[GeminiService] Initialized. Model: ${GEMINI_MODEL_NAME}, Endpoint: ${GEMINI_API_ENDPOINT}`);

/**
 * Represents the result of a Gemini enhancement operation.
 * NOTE: Keeping this interface here as it's tightly coupled to the service's return type.
 * If it needs to be shared more widely, move to shared/types.
 */
export interface GeminiEnhancementResult {
    /** The type of content returned: 'code', 'text', or 'error'. */
    type: 'code' | 'text' | 'error';
    /** The content of the result, which can be a string or null if an error occurred. */
    content: string | null;
}

/**
 * Generates a prompt for the Gemini API based on the enhancement type and code.
 *
 * @param {EnhancementType} enhancement - The type of enhancement to generate the prompt for.
 * @param {string} code - The code to be enhanced.
 * @returns {string} The generated prompt string.
 */
function generatePrompt(enhancement: EnhancementType, code: string): string {
    console.log(`[GeminiService] Generating prompt for enhancement type: ${enhancement}`);
    // ... (rest of generatePrompt code is identical to original)
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
            console.warn(`[GeminiService] Unknown enhancement type for prompt generation: ${enhancement}. Using generic prompt.`);
            // Returns a generic prompt as a fallback
            return `Review and provide feedback on the following code:\n\n\`\`\`typescript\n${code}\n\`\`\``;
    }
}


/**
 * Calls the Gemini API with a given prompt.
 *
 * @param {string} promptText - The prompt text to send to the Gemini API.
 * @returns {Promise<string | null>} A promise that resolves with the response text, or null if an error occurred.
 */
async function callGeminiApi(promptText: string): Promise<string | null> {
    console.log(`[GeminiService] Sending request to Gemini API (${promptText.length} chars)...`);

    const requestData = {
        contents: [{ parts: [{ text: promptText }] }],
        // Optional: Configure generation parameters
        // generationConfig: { ... },
        // Optional: Safety Settings
        // safetySettings: [ ... ]
    };

    const config = {
        headers: { 'Content-Type': 'application/json' },
        params: { key: GEMINI_API_KEY },
        timeout: 120000
    };

    try {
        // Attempt to make the POST request to the Gemini API
        const response: AxiosResponse = await axios.post(GEMINI_API_ENDPOINT, requestData, config);

        // Robustly check for response structure and potential blocks
        const candidate = response.data?.candidates?.[0];

        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
            console.warn(`[GeminiService] Warning: Response generation finished due to reason: ${candidate.finishReason}.`);
            if (candidate.finishReason === "SAFETY") {
                console.error("[GeminiService] ❌ Error: Gemini blocked the response due to safety settings.");
                if (candidate.safetyRatings) {
                    console.error("[GeminiService] Safety Ratings:", JSON.stringify(candidate.safetyRatings, null, 2));
                }
                return null;
            }
        }

        const responseText = candidate?.content?.parts?.[0]?.text;

        if (responseText) {
            console.log(`[GeminiService] Received response (${responseText.trim().length} chars).`);
            return responseText.trim();
        } else {
            console.warn("[GeminiService] Warning: Received response, but no text content found.");
            console.log("[GeminiService] Full Response Data:", JSON.stringify(response.data, null, 2));
            return null;
        }
    } catch (error) {
        console.error("[GeminiService] ❌ Error calling Gemini API:");
        // Cast the error to AxiosError to access response data
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            console.error(`  Status: ${axiosError.response.status}`);
            console.error(`  Data: ${JSON.stringify(axiosError.response.data, null, 2)}`);
            const geminiError = (axiosError.response.data as any)?.error;
            if (geminiError) {
                console.error(`  Gemini Error Code: ${geminiError.code}`);
                console.error(`  Gemini Error Message: ${geminiError.message}`);
                console.error(`  Gemini Error Status: ${geminiError.status}`);
            }
        } else if (axiosError.request) {
            console.error("  Request Error: No response received.", axiosError.code);
        } else {
            console.error('  Setup Error Message:', axiosError.message);
        }
        return null;
    }
}


/**
 * Enhances the given code with Gemini based on the specified enhancement type.
 *
 * @param {EnhancementType} enhancementType - The type of enhancement to apply.
 * @param {string} code - The code to be enhanced.
 * @returns {Promise<GeminiEnhancementResult>} A promise that resolves with the enhancement result.
 */
export async function enhanceCodeWithGemini(
    enhancementType: EnhancementType,
    code: string
): Promise<GeminiEnhancementResult> {

    // Actions expected to return code
    const expectsCode = [
        EnhancementType.AddComments,
    ].includes(enhancementType);

    // Actions expected to return text
    const expectsText = [
        EnhancementType.Analyze,
        EnhancementType.Explain,
        EnhancementType.SuggestImprovements,
        EnhancementType.GenerateDocs,
    ].includes(enhancementType);

    // Generate the prompt based on the enhancement type and code
    const prompt = generatePrompt(enhancementType, code);
    if (!prompt) {
        return { type: 'error', content: `Failed to generate prompt for action: ${enhancementType}` };
    }

    // Call Gemini API with the generated prompt
    const rawResponse = await callGeminiApi(prompt);

    if (rawResponse === null) {
        return { type: 'error', content: 'Failed to get a valid response from Gemini API.' };
    }

    if (expectsCode) {
        console.log(`[GeminiService] Processing response for ${enhancementType} (expects code)...`);
        // Extract code block from the raw response
        const extractedCode = extractCodeBlock(rawResponse); // Use local utility
        if (extractedCode) {
            console.log("[GeminiService] Code block extracted successfully.");
            return { type: 'code', content: extractedCode };
        } else {
            console.warn(`[GeminiService] ${enhancementType} requested, but couldn't extract a fenced code block.`);
            console.log("--- Full Raw Response (for debugging code extraction) ---");
            console.log(rawResponse);
            console.log("--- End Full Raw Response ---");
            return { type: 'error', content: `Failed to extract valid code block from Gemini response for ${enhancementType}. Raw response logged.` };
        }
    } else if (expectsText) {
        console.log(`[GeminiService] Processing response for ${enhancementType} (expects text)...`);
        // Return the raw response as text
        return { type: 'text', content: rawResponse };
    } else {
        console.error(`[GeminiService] Internal Error: Unhandled enhancement type: ${enhancementType}`);
        return { type: 'error', content: `Unhandled enhancement type: ${enhancementType}` };
    }
}