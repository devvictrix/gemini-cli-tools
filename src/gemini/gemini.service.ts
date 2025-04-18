// File: src/gemini/gemini.service.ts

import axios, { AxiosError, AxiosResponse } from 'axios';
import { GEMINI_API_ENDPOINT, GEMINI_API_KEY, GEMINI_MODEL_NAME } from '../config/app.config';
// Corrected path assuming enhancement.type.ts is now in gemini/types
import { EnhancementType } from '@/gemini/types/enhancement.type';
import { extractCodeBlock } from '@/gemini/utils/code.extractor';

// Log config when service is initialized to help with debugging and configuration verification.
console.log(`[GeminiService] Initialized. Model: ${GEMINI_MODEL_NAME}, Endpoint: ${GEMINI_API_ENDPOINT}`);

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
}

/**
 * Generates a prompt for the Gemini API based on the requested enhancement type and the provided code.
 * The prompt is carefully crafted to guide the API towards producing the desired output.
 * NOTE: This function should NOT be called for EnhancementType.Develop as the prompt is generated externally.
 *
 * @param {EnhancementType} enhancement - The type of enhancement requested (e.g., AddComments, Analyze, Explain).
 * @param {string} code - The code to be enhanced or analyzed by the Gemini API.
 * @param {GeminiEnhancementOptions} [options] - Optional parameters like framework hint.
 * @returns {string} The generated prompt string that will be sent to the Gemini API.
 * @throws {Error} If no prompt is defined for an API-dependent enhancement type (excluding Develop).
 */
function generatePrompt(enhancement: EnhancementType, code: string, options?: GeminiEnhancementOptions): string {
    // Throw error immediately if called for Develop type.
    if (enhancement === EnhancementType.Develop) {
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
        case EnhancementType.GenerateModuleReadme:
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
        case EnhancementType.GenerateTests:
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

    const requestData = { contents: [{ parts: [{ text: promptText }] }] };
    const config = {
        headers: { 'Content-Type': 'application/json' },
        params: { key: GEMINI_API_KEY },
        timeout: 180000 // Increased timeout (3 minutes)
    };

    try {
        const response: AxiosResponse = await axios.post(GEMINI_API_ENDPOINT, requestData, config);
        const candidate = response.data?.candidates?.[0];

        // --- Finish Reason Handling ---
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
        }

        // --- Get Response Text ---
        const responseText = candidate?.content?.parts?.[0]?.text;

        if (responseText) {
            console.log(`[GeminiService] Received response (${responseText.trim().length} chars).`);
            // Prepend warning if finished abnormally but not due to safety
            if (candidate?.finishReason && candidate.finishReason !== "STOP" && candidate.finishReason !== "SAFETY") {
                return `// Gemini Warning: Finish Reason - ${candidate.finishReason}\n${responseText.trim()}`;
            }
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
        // --- Error Handling ---
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
 * For EnhancementType.Develop, it expects the full prompt to be provided.
 *
 * @param {EnhancementType} enhancementType - The type of enhancement to perform.
 * @param {string} promptOrCode - For most types, this is the code to enhance/analyze. For Develop, this is the full prompt.
 * @param {GeminiEnhancementOptions} [options] - Optional parameters to customize the enhancement process (e.g., framework hint).
 * @returns {Promise<GeminiEnhancementResult>} The result of the enhancement operation, including the content and its type.
 */
export async function enhanceCodeWithGemini(
    enhancementType: EnhancementType,
    promptOrCode: string,
    options?: GeminiEnhancementOptions
): Promise<GeminiEnhancementResult> {

    // Define which enhancement types require a call to the Gemini API.
    const usesApi = [
        EnhancementType.AddComments,
        EnhancementType.Analyze,
        EnhancementType.Explain,
        EnhancementType.SuggestImprovements,
        EnhancementType.GenerateDocs,
        EnhancementType.AnalyzeArchitecture,
        EnhancementType.GenerateModuleReadme,
        EnhancementType.GenerateTests,
        EnhancementType.Develop, // Added Develop
    ].includes(enhancementType);

    // If the enhancement type does not require an API call, log a warning and return an error result.
    if (!usesApi) {
        console.warn(`[GeminiService] Enhancement type ${enhancementType} was passed to enhanceCodeWithGemini but does not use the API.`);
        return { type: 'error', content: `Internal Error: Enhancement type ${enhancementType} is processed locally and should not call this function.` };
    }

    // Determine the actual prompt to send to the API
    let finalPrompt: string;
    if (enhancementType === EnhancementType.Develop) {
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

    /*
    // --- Previous, more complex response handling (kept for reference) ---
    const expectsCodeOrTextWithCode = [
        EnhancementType.AddComments,
        EnhancementType.GenerateTests,
        EnhancementType.Develop
    ].includes(enhancementType);
    const expectsPureText = [
        EnhancementType.Analyze,
        EnhancementType.Explain,
        EnhancementType.SuggestImprovements,
        EnhancementType.GenerateDocs,
        EnhancementType.AnalyzeArchitecture,
        EnhancementType.GenerateModuleReadme,
    ].includes(enhancementType);

    if (expectsCodeOrTextWithCode) {
        // For AddComments, try to extract code. If fails, return raw text.
        // For GenerateTests/Develop, always return raw text as code might be mixed.
        if (enhancementType === EnhancementType.AddComments) {
            const extractedCode = extractCodeBlock(rawResponse);
            if (extractedCode) {
                 if (rawResponse.startsWith('// Gemini Warning:') || rawResponse.startsWith('// Gemini Safety Block:')) {
                    console.warn(`[GeminiService] Note: Gemini response included a warning/block message before the code for ${enhancementType}.`);
                }
                return { type: 'code', content: extractedCode };
            } else {
                console.warn(`[GeminiService] Could not extract code block from Gemini response for '${enhancementType}'. Returning raw response as text.`);
                return { type: 'text', content: rawResponse }; // Fallback
            }
        } else {
            // For GenerateTests, Develop return raw response as text
            return { type: 'text', content: rawResponse };
        }
    } else if (expectsPureText) {
        return { type: 'text', content: rawResponse };
    } else {
        console.error(`[GeminiService] Internal Error: Unhandled enhancement type in response processing: ${enhancementType}.`);
        return { type: 'error', content: `Internal Error: Unhandled enhancement type ${enhancementType}` };
    }
    */
}