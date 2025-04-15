// src/gemini/services/gemini.service.ts // Correct new path

import axios, { AxiosError, AxiosResponse } from 'axios';
// Ensure config path is correct relative to this new location
import { GEMINI_API_ENDPOINT, GEMINI_API_KEY, GEMINI_MODEL_NAME } from '../config/app.config.js';
// Ensure enum path is correct relative to this new location
import { EnhancementType } from '../shared/enums/enhancement.type.js';
// Ensure util path is correct relative to this new location
import { extractCodeBlock } from './utils/code.extractor.js';

// Log config when service is initialized.  This helps in debugging and verifying configuration.
console.log(`[GeminiService] Initialized. Model: ${GEMINI_MODEL_NAME}, Endpoint: ${GEMINI_API_ENDPOINT}`);

/**
 * Represents the result of a Gemini enhancement operation.
 *  - `type`: Indicates the type of content returned (code, text, or error).  Crucial for downstream processing.
 *  - `content`: The actual content of the enhancement, or an error message if the operation failed.  Can be null if an error occurred.
 */
export interface GeminiEnhancementResult {
    type: 'code' | 'text' | 'error';
    content: string | null;
}

/**
 * Generates a prompt for the Gemini API based on the enhancement type and code.
 * Each enhancement type has a specific prompt tailored to the desired outcome.
 * @param {EnhancementType} enhancement - The type of enhancement requested (e.g., AddComments, Analyze).
 * @param {string} code - The code to be enhanced.
 * @returns {string} The generated prompt for the Gemini API.
 */
function generatePrompt(enhancement: EnhancementType, code: string): string {
    console.log(`[GeminiService] Generating prompt for enhancement type: ${enhancement}`);
    switch (enhancement) {
        case EnhancementType.AddComments:
            return `
Review the following TypeScript/JavaScript code... [AddComments Prompt Text] ...
\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.Analyze:
            return `
Analyze the following code... [Analyze Prompt Text] ...
\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.Explain:
            return `
Explain the following TypeScript/JavaScript code... [Explain Prompt Text] ...
\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.SuggestImprovements:
            return `
Act as a senior software engineer... [SuggestImprovements Prompt Text] ...
\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.GenerateDocs:
            return `
Analyze the following TypeScript/JavaScript code and generate documentation... [GenerateDocs Prompt Text] ...
\`\`\`typescript
${code}
\`\`\`
`;
        // No prompts needed for local-only actions like Consolidate, AddPathComment, InferFromData, GenerateStructureDoc
        default:
            // This case might now be reachable if a new enum value is added without a prompt
            console.warn(`[GeminiService] No specific prompt defined for enhancement type: ${enhancement}.`);
            // Decide if you want a generic prompt or to throw an error if an unknown type reaches here
            // throw new Error(`Prompt generation not implemented for type: ${enhancement}`);
            return `Review and provide feedback on the following code:\n\n\`\`\`typescript\n${code}\n\`\`\``; // Fallback
    }
}


/**
 * Calls the Gemini API with a given prompt.
 * @param {string} promptText - The prompt to send to the Gemini API.
 * @returns {Promise<string | null>} A promise that resolves to the Gemini API's response, or null if an error occurred.
 */
async function callGeminiApi(promptText: string): Promise<string | null> {
    console.log(`[GeminiService] Sending request to Gemini API (${promptText.length} chars)...`);
    const requestData = { contents: [{ parts: [{ text: promptText }] }] };
    const config = {
        headers: { 'Content-Type': 'application/json' },
        params: { key: GEMINI_API_KEY },
        timeout: 120000  // Consider making this configurable
    };

    try {
        const response: AxiosResponse = await axios.post(GEMINI_API_ENDPOINT, requestData, config);
        const candidate = response.data?.candidates?.[0];

        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
            console.warn(`[GeminiService] Warning: Response generation finished due to reason: ${candidate.finishReason}.`);
            if (candidate.finishReason === "SAFETY") {
                console.warn("[GeminiService] Response blocked due to safety concerns."); // Add more specific handling/logging
                /* handle safety */ return null;
            }
        }
        const responseText = candidate?.content?.parts?.[0]?.text;
        if (responseText) {
            console.log(`[GeminiService] Received response (${responseText.trim().length} chars).`);
            return responseText.trim();
        } else {
            console.warn("[GeminiService] Received empty response from Gemini API."); // Better logging for empty responses
            /* handle missing text */ return null;
        }
    } catch (error) { /* handle axios error */
        console.error("[GeminiService] ❌ Error calling Gemini API:");
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            console.error(`  Status: ${axiosError.response.status}`);
            console.error(`  Data: ${JSON.stringify(axiosError.response.data, null, 2)}`);
        } else if (axiosError.request) { console.error("  Request Error: No response received.", axiosError.code); }
        else { console.error('  Setup Error Message:', axiosError.message); }
        // Consider re-throwing the error or returning a more descriptive error message
        return null;
    }
}


/**
 * Orchestrates enhancing code or generating text via the Gemini API.
 * @param {EnhancementType} enhancementType - The type of enhancement to perform.
 * @param {string} code - The code to be enhanced.
 * @returns {Promise<GeminiEnhancementResult>} A promise that resolves to a `GeminiEnhancementResult` object.
 */
export async function enhanceCodeWithGemini(
    enhancementType: EnhancementType,
    code: string
): Promise<GeminiEnhancementResult> {

    // Filter out types that don't actually use the API
    const usesApi = [
        EnhancementType.AddComments,
        EnhancementType.Analyze,
        EnhancementType.Explain,
        EnhancementType.SuggestImprovements,
        EnhancementType.GenerateDocs,
    ].includes(enhancementType);

    if (!usesApi) {
        console.warn(`[GeminiService] Enhancement type ${enhancementType} does not use the Gemini API.`);
        // Return an error or a specific result indicating no API call was made
        return { type: 'error', content: `Enhancement type ${enhancementType} is processed locally.` };
    }


    const expectsCode = [EnhancementType.AddComments].includes(enhancementType);
    const expectsText = [EnhancementType.Analyze, EnhancementType.Explain, EnhancementType.SuggestImprovements, EnhancementType.GenerateDocs].includes(enhancementType);

    const prompt = generatePrompt(enhancementType, code); // Will use fallback/error if needed

    const rawResponse = await callGeminiApi(prompt);

    if (rawResponse === null) {
        return { type: 'error', content: 'Failed to get a valid response from Gemini API.' };
    }

    if (expectsCode) {
        const extractedCode = extractCodeBlock(rawResponse);
        if (extractedCode) {
            return { type: 'code', content: extractedCode };
        } else {
            console.warn("[GeminiService] Could not extract code from raw response."); // More informative logging
            /* handle extraction failure */ return { type: 'error', content: `Failed to extract code block.` };
        }
    } else if (expectsText) {
        return { type: 'text', content: rawResponse };
    } else {
        // Should ideally be unreachable if prompts/types handled correctly
        console.error(`[GeminiService] Internal Error: Unhandled enhancement type in response processing: ${enhancementType}`);
        return { type: 'error', content: `Unhandled enhancement type: ${enhancementType}` };
    }
}