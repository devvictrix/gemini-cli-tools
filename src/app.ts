// src/app.ts
import axios, { AxiosError, AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv'; // Use ES6 import style

dotenv.config(); // Load .env variables

// --- Configuration ---
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent`;
const API_KEY = process.env.GEMINI_API_KEY;
// Point to the TypeScript file now
const CODE_FILE_PATH = path.join(__dirname, '../consolidated_sources.ts'); // Adjusted path relative to src/

// --- Enhancement Types Enum ---
export enum EnhancementType {
  AddComments = 'AddComments', // Add JSDoc/inline comments
  Analyze = 'Analyze', // Provide analysis/feedback text
  Explain = 'Explain', // Explain the code in plain text
  // Add more types here later (e.g., Refactor, CheckSecurity)
}

// --- Type checking for enum ---
function isValidEnhancementType(value: string): value is EnhancementType {
    return Object.values(EnhancementType).includes(value as EnhancementType);
}


if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable not found.");
  console.log("Please create a .env file in the project root and add your API key:");
  console.log("GEMINI_API_KEY=YOUR_API_KEY_HERE");
  process.exit(1);
}

// --- Utility Function to Extract Code ---
// Keep this function focused on extracting fenced code blocks
function extractCodeBlock(text: string): string | null {
  if (!text) return null;
  // Look for Markdown code blocks (```typescript ... ``` or ```ts ... ``` or just ``` ... ```)
  // Capture content within the fences
  const markdownMatch = text.match(/```(?:typescript|ts)?\s*([\s\S]*?)\s*```/);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1].trim(); // Return the captured group
  }
  // Maybe a fallback? For now, let's rely on the fenced block for safety.
  // If Gemini *only* returns code without fences (as requested for modifications),
  // this might fail. Consider adding a check if the *entire* response looks like code.
  console.warn("Could not find a ```typescript ... ``` or similar code block in the response.");
  return null; // Could not extract code reliably
}

// --- Prompt Generation ---
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
        // Add cases for other enhancement types here
        default:
             // Should not happen if using enum correctly, but good practice
            console.warn(`Unknown enhancement type: ${enhancement}. Using generic prompt.`);
            return `Review and provide feedback on the following code:\n\n\`\`\`typescript\n${code}\n\`\`\``;
    }
}


// --- API Call Function ---
// Added explicit types for Promise resolution
async function callGeminiApi(promptText: string): Promise<string | null> {
  console.log(`--- Sending Prompt to Gemini (${promptText.length} chars) ---`);
  // Avoid printing huge prompts entirely
  const preview = promptText.length > 500 ? promptText.substring(0, 500) + '...' : promptText;
  console.log(preview);
  console.log("---------------------------------");

  const requestData = {
    contents: [{ parts: [{ text: promptText }] }],
    // generationConfig: { temperature: 0.5 } // Adjust if needed
  };

  const config = {
    headers: { 'Content-Type': 'application/json' },
    params: { key: API_KEY },
    // Add timeout?
    // timeout: 30000 // 30 seconds
  };

  try {
    const response: AxiosResponse = await axios.post(GEMINI_API_ENDPOINT, requestData, config);

    // Refined response checking
    const candidate = response.data?.candidates?.[0];
    const responseText = candidate?.content?.parts?.[0]?.text;

    if (responseText) {
      console.log("\n--- Raw Gemini Response ---");
      console.log(responseText.trim());
      console.log("---------------------------\n");
      return responseText.trim(); // Return the response text
    } else {
      console.warn("Warning: Received an unexpected or empty response structure from Gemini.");
      console.log("Full Response Data:", JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.error("\n--- Error calling Gemini API ---");
    const axiosError = error as AxiosError; // Type assertion
    if (axiosError.response) {
      console.error("Status:", axiosError.response.status);
      console.error("Data:", JSON.stringify(axiosError.response.data, null, 2));
    } else if (axiosError.request) {
      console.error("Request Error: No response received.", axiosError.request);
    } else {
      console.error('Error Message:', axiosError.message);
    }
    console.error("-----------------------------\n");
    return null; // Indicate failure
  }
}

// --- File Update Function (with safety check) ---
function updateCodeFile(filePath: string, newCode: string): boolean {
     // *** DANGER ZONE: Overwriting the file ***
     console.warn(`\nWARNING: Attempting to overwrite ${filePath}...`);
     try {
         fs.writeFileSync(filePath, newCode, 'utf8');
         console.log(`✅ Successfully updated ${filePath}.`);
         // Add git staging here if desired (and imported 'execSync')
         return true;
     } catch (writeError) {
         // Improve error handling for file writing
         if (writeError instanceof Error) {
             console.error(`❌ Error writing file ${filePath}:`, writeError.message);
         } else {
             console.error(`❌ An unknown error occurred while writing file ${filePath}.`);
         }
         return false;
     }
     // *** END DANGER ZONE ***
}


// --- Main Execution Logic ---
async function main() {
    // --- Argument Parsing ---
    const args = process.argv.slice(2); // Get args excluding 'node' and script path
    const requestedEnhancement = args[0]; // Expecting type as the first argument

    if (!requestedEnhancement) {
        console.error("Error: Please provide an enhancement type as a command-line argument.");
        console.log("Available types:", Object.values(EnhancementType).join(', '));
        process.exit(1);
    }

    if (!isValidEnhancementType(requestedEnhancement)) {
         console.error(`Error: Invalid enhancement type "${requestedEnhancement}".`);
         console.log("Available types:", Object.values(EnhancementType).join(', '));
         process.exit(1);
    }

    const enhancementType: EnhancementType = requestedEnhancement; // Type assertion is safe now
    console.log(`Selected enhancement: ${enhancementType}`);

    // --- Read Original Code ---
    let originalCode: string;
    try {
        originalCode = fs.readFileSync(CODE_FILE_PATH, 'utf8');
        console.log(`Successfully read original code from ${CODE_FILE_PATH}`);
    } catch (readError) {
        if (readError instanceof Error) {
            console.error(`Error reading file ${CODE_FILE_PATH}:`, readError.message);
        } else {
            console.error(`An unknown error occurred reading ${CODE_FILE_PATH}.`);
        }
        process.exit(1);
    }

    // --- Generate Prompt & Call API ---
    const prompt = generatePrompt(enhancementType, originalCode);
    const geminiResponse = await callGeminiApi(prompt);

    if (!geminiResponse) {
        console.log("\nDid not receive a valid response from Gemini. No changes made.");
        process.exit(1); // Exit if API call failed
    }

    // --- Process Response based on Enhancement Type ---
    switch (enhancementType) {
        case EnhancementType.AddComments:
            // Actions requiring code modification and merge
            console.log(`Processing response for ${enhancementType}... Attempting to extract code.`);
            const extractedCode = extractCodeBlock(geminiResponse);

            if (extractedCode) {
                console.log("Successfully extracted potential code block.");
                if (originalCode.trim() !== extractedCode.trim()) {
                    console.log("\n✨ Proposed changes detected from Gemini!");
                    console.log("--- Proposed Code Snippet (first 20 lines) ---");
                    console.log(extractedCode.split('\n').slice(0, 20).join('\n') + '\n...');
                    console.log("---------------------------------------------\n");
                    // Attempt to update the file
                    updateCodeFile(CODE_FILE_PATH, extractedCode);
                } else {
                    console.log("\n✅ Gemini response code matches original code. No file update needed.");
                }
            } else {
                console.warn("\n⚠️ Could not extract a valid code block from the Gemini response. No changes made to file.");
                console.log("   This might happen if Gemini included explanatory text despite the prompt.");
            }
            break;

        case EnhancementType.Analyze:
        case EnhancementType.Explain:
            // Actions requiring textual output only
            console.log(`\n--- Gemini ${enhancementType} Result ---`);
            console.log(geminiResponse); // Print the full response as is
            console.log(`--- End ${enhancementType} Result ---\n`);
            // No file modification for these types
            break;

        // Add cases for other enhancement types here

        default:
            console.log("Unhandled enhancement type in response processing.");
            break;
    }
}

// Execute the main function
main().catch(error => {
    // Catch any unhandled promise rejections from main
    console.error("An unexpected error occurred in main execution:", error);
    process.exit(1);
});