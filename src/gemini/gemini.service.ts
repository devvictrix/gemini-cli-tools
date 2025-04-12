// src/gemini/gemini.service.ts

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
 * @param code The source code to be enhanced.
 * @returns The generated prompt string.
 */
function generatePrompt(enhancement: EnhancementType, code: string): string {
    console.log(`Generating prompt for enhancement type: ${enhancement}`);
    switch (enhancement) {
        case EnhancementType.AddComments:
            // Returns a prompt specifically for adding comments
            return `
Review the following TypeScript code. Add comprehensive TSDoc/JSDoc comments /** ... */ for all exported functions, classes, interfaces, and types. Include @param, @returns, and @throws tags where appropriate.
Also add concise inline comments // using // for complex or non-obvious implementation logic within functions or methods.
Ensure existing comments are preserved or improved if necessary.
**IMPORTANT: Respond ONLY with the complete, updated TypeScript code block itself, including the added comments. Do not include any explanatory text before or after the code block.**

\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.Explain:
            // Returns a prompt specifically for explaining code
            return `
Explain the following TypeScript code in simple terms. Describe its purpose, how it works, and what each major part does.

\`\`\`typescript
${code}
\`\`\`
`;
        default:
            // Should not happen if using enum correctly, but good practice
            console.warn(`Unknown enhancement type: ${enhancement}. Using generic prompt.`);
            // Returns a generic prompt as a fallback
            return `Review and provide feedback on the following code:\n\n\`\`\`typescript\n${code}\n\`\`\``;
    }
}

/**
 * Calls the Gemini API with the generated prompt.
 * @param promptText The complete prompt to send to the Gemini API.
 * @returns A promise resolving to the raw text response from Gemini, or null if an error occurs.
 * @throws {AxiosError} If the API call fails.  The error object will contain details about the failure.
 */
async function callGeminiApi(promptText: string): Promise<string | null> {
    console.log(`--- Sending Prompt to Gemini (${promptText.length} chars) ---`);
    const preview = promptText.length > 500 ? promptText.substring(0, 500) + '...' : promptText;
    console.log(preview);
    console.log("---------------------------------");

    // Request data to be sent to the Gemini API
    const requestData = {
        contents: [{ parts: [{ text: promptText }] }],
        // generationConfig: { temperature: 0.5 } // Optional: Add generation config
    };

    // Configuration for the Axios request
    const config = {
        headers: { 'Content-Type': 'application/json' },
        params: { key: GEMINI_API_KEY }, // API Key as query param
        timeout: 60000 // 60 seconds timeout
    };

    try {
        // Make the POST request to the Gemini API
        const response: AxiosResponse = await axios.post(GEMINI_API_ENDPOINT, requestData, config);

        // Extract the response text from the Gemini API response
        const candidate = response.data?.candidates?.[0];
        const responseText = candidate?.content?.parts?.[0]?.text;

        if (responseText) {
            console.log("\n--- Raw Gemini Response ---");
            console.log(`Received response (${responseText.trim().length} chars)`);
            console.log("---------------------------\n");
            return responseText.trim(); // Return the trimmed response text
        } else {
            // Handle cases where the response structure is unexpected or empty
            console.warn("Warning: Received an unexpected or empty response structure from Gemini.");
            console.log("Full Response Data:", JSON.stringify(response.data, null, 2));
            return null;
        }
    } catch (error) {
        // Handle errors during the API call
        console.error("\n--- Error calling Gemini API ---");
        const axiosError = error as AxiosError; // Type assertion for more specific error handling
        if (axiosError.response) {
            // The request was made and the server responded with an error status code
            console.error("Status:", axiosError.response.status);
            console.error("Data:", JSON.stringify(axiosError.response.data, null, 2)); // Log the detailed error from Gemini
        } else if (axiosError.request) {
            // The request was made but no response was received
            console.error("Request Error: No response received.", axiosError.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Setup Error Message:', axiosError.message);
        }
        console.error("-----------------------------\n");
        return null; // Indicate failure
    }
}

/**
 * Orchestrates the process of enhancing code via the Gemini API.
 * @param enhancementType The type of enhancement to apply to the code.
 * @param code The source code to be enhanced.
 * @returns A promise resolving to a GeminiEnhancementResult containing the enhanced code or an error message.
 */
export async function enhanceCodeWithGemini(
    enhancementType: EnhancementType,
    code: string
): Promise<GeminiEnhancementResult> {

    const prompt = generatePrompt(enhancementType, code);
    const rawResponse = await callGeminiApi(prompt);

    if (!rawResponse) {
        return { type: 'error', content: 'Failed to get response from Gemini API.' };
    }

    // Process response based on the expected output for the enhancement type
    switch (enhancementType) {
        case EnhancementType.AddComments:
            // Attempts to extract a code block from the raw response if AddComments was requested
            console.log(`Processing response for ${enhancementType}... Attempting to extract code.`);
            const extractedCode = extractCodeBlock(rawResponse);
            if (extractedCode) {
                console.log("Code block extracted successfully.");
                return { type: 'code', content: extractedCode };
            } else {
                console.warn("AddComments requested, but couldn't extract a fenced code block from response.");
                return { type: 'error', content: 'Failed to extract valid code block from Gemini response for AddComments.' };
            }
        case EnhancementType.Analyze:
        case EnhancementType.Explain:
            // Returns the raw response as text for Analyze and Explain enhancement types
            console.log(`Processing response for ${enhancementType}... Returning raw text.`);
            return { type: 'text', content: rawResponse };
        default:
            // This should technically be caught by earlier validation, but good as a safeguard
            const exhaustiveCheck: unknown = enhancementType; // For exhaustiveness checking by TypeScript
            console.error(`Unhandled enhancement type in processing: ${exhaustiveCheck}`);
            return { type: 'error', content: `Unhandled enhancement type: ${enhancementType}` };
    }
}