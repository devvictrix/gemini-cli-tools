// File: src/gemini/gemini.service.ts
// Status: Updated (Added GenerateModuleReadme prompt and handling)

import axios, { AxiosError, AxiosResponse } from 'axios';
import { GEMINI_API_ENDPOINT, GEMINI_API_KEY, GEMINI_MODEL_NAME } from '../config/app.config.js';
import { EnhancementType } from '../shared/enums/enhancement.type.js';
import { extractCodeBlock } from './utils/code.extractor.js'; // Assuming this utility exists and is correct

// Log config when service is initialized
console.log(`[GeminiService] Initialized. Model: ${GEMINI_MODEL_NAME}, Endpoint: ${GEMINI_API_ENDPOINT}`);

/**
 * Represents the result of a Gemini enhancement operation.
 */
export interface GeminiEnhancementResult {
    type: 'code' | 'text' | 'error';
    content: string | null;
}

/**
 * Generates a prompt for the Gemini API based on the enhancement type and code.
 * @param {EnhancementType} enhancement - The type of enhancement requested.
 * @param {string} code - The code to be enhanced or analyzed.
 * @returns {string} The generated prompt for the Gemini API.
 * @throws {Error} If no prompt is defined for an API-dependent enhancement type.
 */
function generatePrompt(enhancement: EnhancementType, code: string): string {
    console.log(`[GeminiService] Generating prompt for enhancement type: ${enhancement}`);
    let moduleName = "this module"; // Default placeholder
    // Attempt to extract a potential module name from the first file path comment
    const firstFileMatch = code.match(/^\s*\/\/\s*File:\s*.*?\/([^\/]+)\/[^\/]+\s*$/m);
    if (firstFileMatch && firstFileMatch[1]) {
        moduleName = `'${firstFileMatch[1]}' module`;
    }

    switch (enhancement) {
        case EnhancementType.AddComments:
            return `
Review the following TypeScript/JavaScript code. Add comprehensive TSDoc/JSDoc comments to all functions, classes, methods, and exported variables. Add clarifying inline comments for complex logic blocks where necessary. Ensure comments explain the 'why' not just the 'what'. Respond ONLY with the fully commented code block, enclosed in \`\`\`typescript ... \`\`\`. Do not include any explanatory text before or after the code block.

Code:
\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.Analyze:
            return `
Analyze the following code snippet or consolidated codebase. Focus on:
1.  **Code Quality:** Identify potential issues like code smells, overly complex functions, or areas violating SOLID principles.
2.  **Structure:** Briefly describe the apparent structure (e.g., functions, classes, modules involved).
3.  **Potential Improvements:** Suggest 1-2 specific, high-impact improvements related to readability, maintainability, or performance if applicable.
Provide the analysis as concise bullet points or short paragraphs.

Code:
\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.Explain:
            return `
Explain the following TypeScript/JavaScript code in simple terms. Describe its primary purpose, inputs, outputs, and the main steps it performs. Target the explanation towards a developer who is new to this specific code.

Code:
\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.SuggestImprovements:
            return `
Act as a senior software engineer reviewing the following code. Provide specific, actionable suggestions for improvement. Focus on areas like:
- Readability and Clarity
- Maintainability and Modularity
- Potential Bugs or Edge Cases
- Performance Optimizations (if obvious)
- Adherence to Best Practices (e.g., SOLID, DRY)
Format suggestions clearly, perhaps as a list with explanations.

Code:
\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.GenerateDocs: // For root project README
            return `
Analyze the following consolidated codebase, likely representing a significant part or the whole of a project. Generate a comprehensive README.md content in Markdown format. The README should include:
1.  **Project Title/Name:** (Infer if possible, otherwise use a placeholder)
2.  **Description:** A brief overview of the project's purpose.
3.  **Key Features:** (If discernible from the code)
4.  **Module Overview:** Briefly describe the main directories/modules and their roles.
5.  **Getting Started/Usage:** (Provide placeholder sections if details aren't in the code)
6.  **Technical Stack:** (Mention languages, key libraries/frameworks if identifiable)
Structure the output clearly using Markdown headings and formatting.

Codebase:
\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.AnalyzeArchitecture:
            return `
Analyze the overall software architecture of the following consolidated codebase, representing a project or a major subsystem. Provide the analysis in Markdown format, suitable for inclusion in a 'AI_Architecture_Analyzed.md' file. Focus on:

1.  **Architectural Style:** Identify the dominant architectural style(s) if possible (e.g., Layered, MVC/MVP/MVVM, Microservices-like, Monolith, Event-Driven, etc.). Explain the reasoning.
2.  **Key Modules/Components:** List the major directories/components identified in the code and briefly describe their primary responsibilities and roles within the architecture.
3.  **Core Interactions & Data Flow:** Describe the main ways these components interact (e.g., function calls, events, message queues, API calls). How does data typically flow through the system?
4.  **Cross-Cutting Concerns:** Mention how aspects like configuration, error handling, logging, or authentication seem to be handled (if patterns are visible).
5.  **Potential Strengths & Weaknesses:** Briefly note any apparent architectural strengths (e.g., modularity, testability) or potential weaknesses/areas for concern (e.g., high coupling, god objects, potential bottlenecks) based *only* on the provided code structure.
6.  **Technology Choices:** Briefly mention key frameworks or libraries observed that significantly influence the architecture.

Aim for a high-level overview. Do not describe individual functions or minor implementation details unless they are critical to understanding a core architectural concept.

Consolidated Codebase:
\`\`\`typescript
${code}
\`\`\`
`;
        case EnhancementType.GenerateModuleReadme: // <<< New Prompt
            return `
The following consolidated code represents the contents of a specific software module (${moduleName}) within a larger project. Analyze this code and generate a concise, well-structured README.md file content in Markdown format specifically for this module.

The README should focus *only* on the provided code and include:

1.  **Module Name:** (Infer a suitable name, e.g., based on the directory or primary class/function, or use the placeholder '${moduleName}')
2.  **Purpose/Responsibility:** Clearly state the primary goal and responsibility of this module within the larger application context. What problem does it solve?
3.  **Key Components/Features:** List the main classes, functions, or sub-components defined within this module and briefly describe what they do.
4.  **Public API/Usage:** Describe how other parts of the application are expected to interact with this module. Highlight the main entry points, exported functions, or classes. Provide brief usage examples if possible based on the code (e.g., how to instantiate a key class or call a primary function).
5.  **Dependencies:** Mention any significant external libraries or other internal modules this module appears to depend on heavily (if clearly identifiable from imports or usage).
6.  **Configuration:** If the module requires specific configuration (e.g., environment variables, setup steps), mention it here (or state if none seems required).

Structure the output clearly using Markdown headings (e.g., \`## Purpose\`, \`## Usage\`). Be concise and focus on information essential for another developer to understand and use this specific module. Do not invent features not present in the code.

Module Code:
\`\`\`typescript
${code}
\`\`\`
`;
        default:
            // This should only be hit if a non-API type slips through the check below
            console.error(`[GeminiService] CRITICAL: No prompt defined for API-dependent enhancement type: ${enhancement}.`);
            throw new Error(`Prompt generation not implemented for type: ${enhancement}`);
    }
}


/**
 * Calls the Gemini API with a given prompt.
 * @param {string} promptText - The prompt to send.
 * @returns {Promise<string | null>} The response text or null on error.
 */
async function callGeminiApi(promptText: string): Promise<string | null> {
    // ... (implementation remains the same - includes logging, axios call, error handling, safety checks)
    console.log(`[GeminiService] Sending request to Gemini API (${promptText.length} chars)...`);
    const requestData = { contents: [{ parts: [{ text: promptText }] }] };
    const config = {
        headers: { 'Content-Type': 'application/json' },
        params: { key: GEMINI_API_KEY },
        timeout: 180000 // Increased timeout
    };

    try {
        const response: AxiosResponse = await axios.post(GEMINI_API_ENDPOINT, requestData, config);
        const candidate = response.data?.candidates?.[0];

        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
            console.warn(`[GeminiService] Warning: Response generation finished due to reason: ${candidate.finishReason}.`);
            if (candidate.finishReason === "SAFETY") {
                console.error("[GeminiService] Response blocked due to safety concerns. Cannot proceed.");
                return `## README Generation Blocked\n\nError: The generated content was blocked by Gemini's safety filters (${candidate.finishReason}). Please review the module code for potentially problematic content or try adjusting the prompt/code.`; // Return specific message
            }
            if (candidate.finishReason === "MAX_TOKENS") {
                console.warn("[GeminiService] Response may be truncated due to maximum token limit.");
            }
            if (candidate.finishReason === "RECITATION") {
                console.warn("[GeminiService] Response may be incomplete due to recitation limits.");
            }
        }

        const responseText = candidate?.content?.parts?.[0]?.text;
        if (responseText) {
            console.log(`[GeminiService] Received response (${responseText.trim().length} chars).`);
            return responseText.trim();
        } else if (candidate?.finishReason === "SAFETY") {
            return `## README Generation Blocked\n\nError: The generated content was blocked by Gemini's safety filters (${candidate.finishReason}).`;
        }
        else {
            console.warn("[GeminiService] Received empty or incomplete response text from Gemini API. Check finishReason and potential errors.");
            console.warn(`[GeminiService] Finish Reason: ${candidate?.finishReason}, Safety Ratings: ${JSON.stringify(candidate?.safetyRatings)}`);
            return null; // Indicate failure
        }
    } catch (error) {
        // ... (error handling remains the same)
        console.error("[GeminiService] ❌ Error calling Gemini API:");
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            console.error(`  Status: ${axiosError.response.status}`);
            console.error(`  Data: ${JSON.stringify(axiosError.response.data, null, 2)}`);
            if (axiosError.response.status === 400) { console.error("  Suggestion: Check API key, request format, or prompt content."); }
            else if (axiosError.response.status === 429) { console.error("  Suggestion: Rate limit exceeded. Wait before retrying."); }
            else if (axiosError.response.status >= 500) { console.error("  Suggestion: Server error on Google's side. Try again later."); }
        } else if (axiosError.request) {
            console.error("  Request Error: No response received.", axiosError.code);
            if (axiosError.code === 'ECONNABORTED') { console.error(`  Suggestion: Request timed out after ${config.timeout / 1000} seconds.`); }
        } else { console.error('  Setup Error Message:', axiosError.message); }
        return null; // Indicate failure
    }
}


/**
 * Orchestrates enhancing code or generating text via the Gemini API.
 * @param {EnhancementType} enhancementType - The type of enhancement.
 * @param {string} code - The code to be enhanced/analyzed.
 * @returns {Promise<GeminiEnhancementResult>} The result.
 */
export async function enhanceCodeWithGemini(
    enhancementType: EnhancementType,
    code: string
): Promise<GeminiEnhancementResult> {

    // Define which types require an API call
    const usesApi = [
        EnhancementType.AddComments,
        EnhancementType.Analyze,
        EnhancementType.Explain,
        EnhancementType.SuggestImprovements,
        EnhancementType.GenerateDocs,
        EnhancementType.AnalyzeArchitecture,
        EnhancementType.GenerateModuleReadme, // <<< Added
    ].includes(enhancementType);

    if (!usesApi) {
        // This path should ideally not be taken if called correctly, but good safeguard.
        console.warn(`[GeminiService] Enhancement type ${enhancementType} was passed to enhanceCodeWithGemini but does not use the API.`);
        return { type: 'error', content: `Internal Error: Enhancement type ${enhancementType} is processed locally and should not call this function.` };
    }

    // Define expected output type
    const expectsCode = [EnhancementType.AddComments].includes(enhancementType);
    const expectsText = [
        EnhancementType.Analyze,
        EnhancementType.Explain,
        EnhancementType.SuggestImprovements,
        EnhancementType.GenerateDocs,
        EnhancementType.AnalyzeArchitecture,
        EnhancementType.GenerateModuleReadme, // <<< Added
    ].includes(enhancementType);

    const prompt = generatePrompt(enhancementType, code); // Generate the specific prompt

    const rawResponse = await callGeminiApi(prompt);

    if (rawResponse === null) {
        // callGeminiApi already logged the details
        return { type: 'error', content: 'Failed to get a valid response from Gemini API.' };
    }

    // Process based on expected type
    if (expectsCode) {
        // ... (logic remains the same)
        const extractedCode = extractCodeBlock(rawResponse);
        if (extractedCode) {
            return { type: 'code', content: extractedCode };
        } else {
            console.warn("[GeminiService] Could not extract code block from Gemini response for 'AddComments'. Returning raw response.");
            return { type: 'text', content: rawResponse }; // Treat as text if extraction fails
        }
    } else if (expectsText) {
        // For text-based results, return the raw response directly
        return { type: 'text', content: rawResponse };
    } else {
        // This state should be unreachable if expectsCode/expectsText covers all usesApi types
        console.error(`[GeminiService] Internal Error: Unhandled enhancement type in response processing: ${enhancementType}. Expected code or text.`);
        return { type: 'error', content: `Internal Error: Unhandled enhancement type ${enhancementType}` };
    }
}