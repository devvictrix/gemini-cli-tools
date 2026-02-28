import axios, { AxiosError, AxiosResponse } from 'axios';
// --- Import the validated 'env' object ---
import { env } from '../config/app.config';
// Corrected path assuming enhancement.type.ts is now in gemini/types
import { ENHANCEMENT_TYPES } from '@/gemini/types/enhancement.type';
import { extractCodeBlock } from '@/gemini/utils/code.extractor';

// --- Use the validated env object for logging ---
console.log(`[GeminiService] Initialized. Using model: ${env.GEMINI_MODEL_NAME}`);

/**
 * Represents the result of a Gemini enhancement operation.
 * This interface defines the structure of the response returned by the `enhanceCodeWithGemini` function.
 */
export interface GeminiEnhancementResult {
    /**
     * The type of content returned.  Can be 'code' if the enhancement resulted in code generation (e.g., adding comments),
     * 'text' for general text responses (e.g., analysis, explanations), or 'error' if an error occurred.
     */
    type: 'code' | 'text' | 'error';
    /**
     * The enhanced content.  Will be a string containing the code or text, or null if an error occurred.
     */
    content: string | null;
}

/**
 * Optional: Defines the structure for extra options that can be passed to the `enhanceCodeWithGemini` function.
 * This allows for flexibility in customizing the enhancement process based on specific requirements.
 */
interface GeminiEnhancementOptions {
    /**
     * A hint to the Gemini API about the framework being used (e.g., 'jest' for testing framework).
     * This helps the API generate more accurate and relevant responses.
     */
    frameworkHint?: string;
    /**
     * The perspective or goal of the code review. Used with ENHANCEMENT_TYPES.REVIEW.
     */
    reviewMode?: string;
    /**
     * The level of detail for documentation. Used with ENHANCEMENT_TYPES.DOCUMENT.
     */
    docLevel?: string;
}

/**
 * Generates a prompt for the Gemini API based on the requested enhancement type and the provided code.
 * The prompt is carefully crafted to guide the API towards producing the desired output.
 * NOTE: This function should NOT be called for ENHANCEMENT_TYPES.DEVELOP as the prompt is generated externally.
 *
 * @param {ENHANCEMENT_TYPES} enhancement - The type of enhancement requested (e.g., AddComments, Analyze, Explain).
 * @param {string} code - The code to be enhanced or analyzed by the Gemini API.
 * @param {GeminiEnhancementOptions} [options] - Optional parameters like framework hint.
 * @returns {string} The generated prompt string that will be sent to the Gemini API.
 * @throws {Error} If no prompt is defined for an API-dependent enhancement type (excluding Develop).
 */
function generatePrompt(enhancement: ENHANCEMENT_TYPES, code: string, options?: GeminiEnhancementOptions): string {
    // Throw error immediately if called for Develop type.
    if (enhancement === ENHANCEMENT_TYPES.DEVELOP) {
        throw new Error(`Internal Error: generatePrompt should not be called directly for Develop type.`);
    }

    console.log(`[GeminiService] Generating prompt for enhancement type: ${enhancement}`);

    let moduleName = "this module";
    const firstFileMatch = code.match(/^\s*\/\/\s*File:\s*.*?\/([^\/]+)\/[^\/]+\s*$/m);
    if (firstFileMatch && firstFileMatch[1]) {
        moduleName = `'${firstFileMatch[1]}' module`;
    }

    const framework = options?.frameworkHint ?? 'jest';

    switch (enhancement) {
        // --- Cases remain the same ---
        case ENHANCEMENT_TYPES.REVIEW:
            let reviewFocus = '';
            if (options?.reviewMode === 'architecture') {
                reviewFocus = `Focus on:
1.  **Architectural Style:** Identify the dominant architectural style(s) if possible. Explain the reasoning.
2.  **Key Modules/Components:** List the major directories/components and describe their roles.
3.  **Core Interactions:** Describe how data flows through the system.
4.  **Strengths & Weaknesses:** Briefly note design strengths or bottlenecks.
Output in Markdown format suitable for an architecture review document.`;
            } else if (options?.reviewMode === 'explain') {
                reviewFocus = `Focus on explaining this code in simple terms for a developer new to the project. Describe its primary purpose, inputs, outputs, and main steps.`;
            } else {
                reviewFocus = `Focus on:
1.  **Code Quality:** Identify code smells or SOLID violations.
2.  **Structure:** Briefly describe structural components.
3.  **Potential Improvements:** Suggest actionable, high-impact improvements for readability, maintainability, or performance. Provide explanations.`;
            }

            return `
Analyze the following code snippet or consolidated codebase. ${reviewFocus}
            
Code:
\`\`\`typescript
${code}
\`\`\`
`;
        case ENHANCEMENT_TYPES.DOCUMENT:
            if (options?.docLevel === 'module') {
                 return `
The following consolidated code represents the contents of a specific software module (${moduleName}) within a larger project. Analyze this code and generate a concise, well-structured README.md file content in Markdown format specifically for this module.

The README should focus *only* on the provided code and include:
1.  **Module Name** 
2.  **Purpose/Responsibility:** Clearly state the primary goal.
3.  **Key Components/Features**
4.  **Public API/Usage**
5.  **Dependencies**

Module Code:
\`\`\`typescript
${code}
\`\`\`
`;
            } else {
                 return `
Analyze the following consolidated codebase. Generate a comprehensive README.md content in Markdown format. The README should include:
1.  **Project Title/Name:** (Infer if possible)
2.  **Description:** A brief overview.
3.  **Key Features:** (If discernible)
4.  **Module Overview:** Briefly describe the main directories/modules.
5.  **Technical Stack:** (Mention languages, key libraries if identifiable)

Codebase:
\`\`\`typescript
${code}
\`\`\`
`;
            }

        case ENHANCEMENT_TYPES.GENERATE_TESTS:
            return `
Analyze the following TypeScript code, which represents a component, function, or module. Generate comprehensive unit tests for it using the '${framework}' testing framework syntax.

Follow these guidelines:
- Focus on testing the publicly exported functions, classes, methods, and variables.
- Aim for good test coverage of different scenarios, including valid inputs, edge cases, and potential error conditions.
- Use clear and descriptive test names (e.g., \`it('should return the sum of two numbers')\`).
- Include necessary imports for the code being tested and the '${framework}' framework (e.g., \`import { describe, it, expect } from '${framework === 'vitest' ? 'vitest' : '@jest/globals'}';\`).
- If the code has external dependencies (imports from other modules/libraries), create simple mocks or stubs for them within the test file using ${framework === 'vitest' ? '`vi.fn()` or `vi.mock()`' : '`jest.fn()` or `jest.mock()`'}. Mock only what's necessary for the unit tests to run in isolation.
- Organize tests using \`describe\` blocks for different functions or classes.
- Respond ONLY with the complete test file content, enclosed in a single Markdown code block like \`\`\`typescript ... \`\`\`. Do not include any explanatory text before or after the code block.

Source Code to Test:
\`\`\`typescript
${code}
\`\`\`
`;
        // No case for Develop here - handled by throwing error above if called
        default:
            // This should only be hit if a non-API type slips through the usesApi check below, indicating a logic error.
            console.error(`[GeminiService] CRITICAL: Unhandled enhancement type in prompt generation: ${enhancement}.`);
            throw new Error(`Prompt generation not implemented for type: ${enhancement}`);
    }
}


/**
 * Calls the Gemini API with a given prompt to get a response.
 * This function handles the communication with the Gemini API, including setting headers, handling errors, and parsing the response.
 * @param {string} promptText - The prompt text to send to the Gemini API.
 * @returns {Promise<string | null>} The response text from the Gemini API, or null if an error occurred.
 */
async function callGeminiApi(promptText: string): Promise<string | null> {
    console.log(`[GeminiService] Sending request to Gemini API (${promptText.length} chars)...`);

    // --- Construct Endpoint Dynamically ---
    const apiEndpoint = `https://generativelanguage.googleapis.com/${env.GEMINI_API_VERSION}/models/${env.GEMINI_MODEL_NAME}:generateContent`;
    // --- Use API Key from env ---
    const apiKey = env.GEMINI_API_KEY;

    const requestData = { contents: [{ parts: [{ text: promptText }] }] };
    const config = {
        headers: { 'Content-Type': 'application/json' },
        // --- Use API Key from env ---
        params: { key: apiKey },
        timeout: 180000 // Increased timeout (3 minutes)
    };

    try {
        // --- Use constructed endpoint ---
        const response: AxiosResponse = await axios.post(apiEndpoint, requestData, config);
        const candidate = response.data?.candidates?.[0];

        // --- Finish Reason Handling (remains the same) ---
        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
            console.warn(`[GeminiService] Warning: Response generation finished due to reason: ${candidate.finishReason}.`);
            let blockMessage = `// Gemini Response Issue: ${candidate.finishReason}\n// Generation may be incomplete or blocked.`;

            if (candidate.finishReason === "SAFETY") {
                console.error("[GeminiService] Response blocked due to safety concerns. Cannot proceed.");
                blockMessage = `// Gemini Safety Block: The generated content was blocked due to safety filters (${candidate.finishReason}).`;
                return blockMessage; // Return the block message directly
            }
            if (candidate.finishReason === "MAX_TOKENS") {
                console.warn("[GeminiService] Response may be truncated due to maximum token limit.");
            }
            if (candidate.finishReason === "RECITATION") {
                console.warn("[GeminiService] Response may be incomplete due to recitation limits.");
            }
            // Prepend warning to text if finished abnormally but not due to safety
            const responseTextPartial = candidate?.content?.parts?.[0]?.text?.trim() ?? '';
            return `// Gemini Warning: Finish Reason - ${candidate.finishReason}\n${responseTextPartial}`;

        }
        // --- Get Response Text (remains the same) ---
        const responseText = candidate?.content?.parts?.[0]?.text;

        if (responseText) {
            console.log(`[GeminiService] Received response (${responseText.trim().length} chars).`);
            return responseText.trim();
        } else if (candidate?.finishReason === "SAFETY") {
            // Already handled above, returns block message
            return `// Gemini Safety Block: The generated content was blocked due to safety filters (${candidate.finishReason}).`;
        } else {
            console.warn("[GeminiService] Received empty or incomplete response text from Gemini API. Check finishReason and potential errors.");
            console.warn(`[GeminiService] Finish Reason: ${candidate?.finishReason}, Safety Ratings: ${JSON.stringify(candidate?.safetyRatings)}`);
            return null; // Indicate failure
        }
    } catch (error) {
        // --- Error Handling (remains the same) ---
        console.error("[GeminiService] ❌ Error calling Gemini API:");
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            console.error(`  Status: ${axiosError.response.status}`);
            console.error(`  Data: ${JSON.stringify(axiosError.response.data, null, 2)}`);
            if (axiosError.response.status === 400) { console.error("  Suggestion: Check API key, request format, or prompt content (possible policy violation)."); }
            else if (axiosError.response.status === 429) { console.error("  Suggestion: Rate limit exceeded. Wait before retrying."); }
            else if (axiosError.response.status >= 500) { console.error("  Suggestion: Server error on Google's side. Try again later."); }
        } else if (axiosError.request) {
            console.error("  Request Error: No response received.", axiosError.code);
            if (axiosError.code === 'ECONNABORTED') { console.error(`  Suggestion: Request timed out after ${config.timeout / 1000} seconds.`); }
        } else {
            console.error('  Setup Error Message:', axiosError.message);
        }
        return null; // Indicate failure
    }
}

/**
 * Orchestrates the process of enhancing code or generating text using the Gemini API.
 * For most enhancement types, it generates a prompt based on the code.
 * For ENHANCEMENT_TYPES.DEVELOP, it expects the full prompt to be provided.
 *
 * @param {ENHANCEMENT_TYPES} enhancementType - The type of enhancement to perform.
 * @param {string} promptOrCode - For most types, this is the code to enhance/analyze. For Develop, this is the full prompt.
 * @param {GeminiEnhancementOptions} [options] - Optional parameters to customize the enhancement process (e.g., framework hint).
 * @returns {Promise<GeminiEnhancementResult>} The result of the enhancement operation, including the content and its type.
 */
export async function enhanceCodeWithGemini(
    enhancementType: ENHANCEMENT_TYPES,
    promptOrCode: string,
    options?: GeminiEnhancementOptions
): Promise<GeminiEnhancementResult> {

    // Define which enhancement types require a call to the Gemini API.
    const usesApi = [
        ENHANCEMENT_TYPES.REVIEW,
        ENHANCEMENT_TYPES.DOCUMENT,
        ENHANCEMENT_TYPES.GENERATE_TESTS,
        ENHANCEMENT_TYPES.DEVELOP, // Added Develop
    ].includes(enhancementType);

    // If the enhancement type does not require an API call, log a warning and return an error result.
    if (!usesApi) {
        console.warn(`[GeminiService] Enhancement type ${enhancementType} was passed to enhanceCodeWithGemini but does not use the API.`);
        return { type: 'error', content: `Internal Error: Enhancement type ${enhancementType} is processed locally and should not call this function.` };
    }

    // Determine the actual prompt to send to the API
    let finalPrompt: string;
    if (enhancementType === ENHANCEMENT_TYPES.DEVELOP) {
        // For Develop, the input *is* the fully formed prompt
        finalPrompt = promptOrCode;
    } else {
        // For other types, generate the prompt using the existing logic and the provided code
        finalPrompt = generatePrompt(enhancementType, promptOrCode, options);
    }

    // Call the Gemini API with the final prompt.
    const rawResponse = await callGeminiApi(finalPrompt);

    // If the API call fails and returns null, return an error result.
    if (rawResponse === null) {
        return { type: 'error', content: 'Failed to get a valid response from Gemini API.' };
    }

    // --- Simple Response Handling (Return as 'text') ---
    // Since Develop, GenerateTests, etc., might return text mixed with code blocks,
    // it's safer and more flexible to always return the raw response as 'text' and
    // let the calling command handler extract the specific parts it needs (e.g., using extractCodeBlock).
    // The 'type' field becomes less critical here, mainly distinguishing success ('text' or 'code') from 'error'.
    return { type: 'text', content: rawResponse };

}