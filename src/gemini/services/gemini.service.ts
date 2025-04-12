// src/gemini/gemini.service.ts
import axios, { AxiosError, AxiosResponse } from 'axios';
import { EnhancementType } from '../../shared/types/enhancement.type';
import { GEMINI_API_KEY, GEMINI_API_ENDPOINT } from '../../config';
import { extractCodeBlock } from '../utils/code.extractor';
// --- IMPORT PATHS UPDATED ---
// --- END IMPORT PATHS UPDATED ---

export interface GeminiEnhancementResult {
    type: 'code' | 'text' | 'error';
    content: string | null;
}

/**
 * Generates the appropriate prompt for the Gemini API based on the desired enhancement.
 */
function generatePrompt(enhancement: EnhancementType, code: string): string {
    console.log(`Generating prompt for enhancement type: ${enhancement}`);
    switch (enhancement) {
        case EnhancementType.AddComments:
            return `
Review the following TypeScript code and add detailed JSDoc comments for functions, classes, and complex logic, as well as inline comments where necessary for clarity.
**IMPORTANT: Respond with ONLY the complete, updated TypeScript code block itself, including the added comments. Do not include any explanatory text before or after the code block.**

\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.Analyze:
            return `
Analyze the following TypeScript code for potential issues, areas for improvement (e.g., efficiency, readability, maintainability, potential bugs), and overall code quality. Provide your analysis as clear, concise text. Do not suggest code modifications directly in this analysis, just describe the findings.

\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.Explain:
            return `
Explain the following TypeScript code in simple terms. Describe its purpose, how it works, and what each major part does.

\`\`\`typescript
${code}
\`\`\`
`;
        default:
            // Should not happen if using enum correctly, but good practice
            console.warn(`Unknown enhancement type: ${enhancement}. Using generic prompt.`);
            return `Review and provide feedback on the following code:\n\n\`\`\`typescript\n${code}\n\`\`\``;
    }
}

/**
 * Calls the Gemini API with the generated prompt.
 * @param promptText The complete prompt to send.
 * @returns A promise resolving to the raw text response from Gemini, or null on error.
 */
async function callGeminiApi(promptText: string): Promise<string | null> {
    console.log(`--- Sending Prompt to Gemini (${promptText.length} chars) ---`);
    const preview = promptText.length > 500 ? promptText.substring(0, 500) + '...' : promptText;
    console.log(preview);
    console.log("---------------------------------");

    // --- REQUEST DATA IMPLEMENTATION ---
    const requestData = {
        contents: [{ parts: [{ text: promptText }] }],
        // generationConfig: { temperature: 0.5 } // Optional: Add generation config
    };

    // --- CONFIG IMPLEMENTATION ---
    const config = {
        headers: { 'Content-Type': 'application/json' },
        params: { key: GEMINI_API_KEY }, // API Key as query param
        timeout: 60000 // 60 seconds timeout
    };

    try {
        // --- AXIOS CALL IMPLEMENTATION ---
        const response: AxiosResponse = await axios.post(GEMINI_API_ENDPOINT, requestData, config);

        // --- RESPONSE PROCESSING IMPLEMENTATION ---
        const candidate = response.data?.candidates?.[0];
        const responseText = candidate?.content?.parts?.[0]?.text;

        if (responseText) {
            console.log("\n--- Raw Gemini Response ---");
            console.log(`Received response (${responseText.trim().length} chars)`);
            console.log("---------------------------\n");
            return responseText.trim(); // Return the trimmed response text
        } else {
            console.warn("Warning: Received an unexpected or empty response structure from Gemini.");
            console.log("Full Response Data:", JSON.stringify(response.data, null, 2));
            return null;
        }
    } catch (error) {
        // --- ERROR HANDLING IMPLEMENTATION ---
        console.error("\n--- Error calling Gemini API ---");
        const axiosError = error as AxiosError; // Type assertion
        if (axiosError.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
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
 * Orchestrates the process of enhancing code via Gemini API.
 * @param enhancementType The type of enhancement requested.
 * @param code The source code to enhance.
 * @returns A promise resolving to a GeminiEnhancementResult object.
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

    // Process response based on the *expected* output for the enhancement type
    switch (enhancementType) {
        case EnhancementType.AddComments:
            console.log(`Processing response for ${enhancementType}... Attempting to extract code.`);
            const extractedCode = extractCodeBlock(rawResponse);
            if (extractedCode) {
                console.log("Code block extracted successfully.");
                return { type: 'code', content: extractedCode };
            } else {
                console.warn("AddComments requested, but couldn't extract a fenced code block from response.");
                // Corrected error message content
                return { type: 'error', content: 'Failed to extract valid code block from Gemini response for AddComments.' };
            }
        case EnhancementType.Analyze:
        case EnhancementType.Explain:
            console.log(`Processing response for ${enhancementType}... Returning raw text.`);
            return { type: 'text', content: rawResponse };
        default:
            // This should technically be caught by earlier validation, but good as a safeguard
            const exhaustiveCheck: never = enhancementType;
            console.error(`Unhandled enhancement type in processing: ${exhaustiveCheck}`);
            return { type: 'error', content: `Unhandled enhancement type: ${enhancementType}` };
    }
}