// src/app.ts
import * as fs from 'fs';
import * as path from 'path';
import { CODE_FILE_PATH } from './config';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from './gemini/gemini.service';
import { EnhancementType, isValidEnhancementType } from './shared/types/enhancement.type';
// --- NEW IMPORT ---
import { getConsolidatedSources } from './inspector/inspector.service';
// --- END NEW IMPORT ---

// readCodeFile, updateCodeFile, parseArguments functions remain the same...

/**
 * Reads the content of a code file.
 * @param filePath The path to the code file.
 * @returns The code content as a string.  Throws an error if the file cannot be read.
 */
function readCodeFile(filePath: string): string {
  // ... (implementation remains the same) ...
  console.log(`Attempting to read code from: ${filePath}`);
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    console.log(`Successfully read ${code.length} characters.`);
    return code;
  } catch (readError) {
    console.error(`❌ Error reading file ${filePath}:`);
    if (readError instanceof Error) {
      console.error(readError.message);
    } else {
      console.error("An unknown error occurred during file read.");
    }
    throw readError;
  }
}

/**
 * Updates the content of a code file.  Provides a warning before overwriting.
 * @param filePath The path to the code file.
 * @param newCode The new code content to write to the file.
 * @returns True if the file was updated successfully, false otherwise.
 */
function updateCodeFile(filePath: string, newCode: string): boolean {
  // ... (implementation remains the same) ...
  console.warn(`\n⚠️ WARNING: Attempting to automatically overwrite ${path.basename(filePath)}...`);
  try {
    fs.writeFileSync(filePath, newCode, 'utf8');
    console.log(`✅ Successfully updated ${filePath}.`);
    return true;
  } catch (writeError) {
    console.error(`❌ Error writing file ${filePath}:`);
    if (writeError instanceof Error) {
      console.error(writeError.message);
    } else {
      console.error("An unknown error occurred during file write.");
    }
    return false;
  }
}

/**
 * Parses command line arguments to determine the desired enhancement type.
 * Exits the process if no argument or an invalid argument is provided.
 * @returns The validated EnhancementType from the command-line arguments.
 */
function parseArguments(): EnhancementType {
  // ... (implementation remains the same - now recognizes ConsolidateAndAnalyze) ...
  const args = process.argv.slice(2);
  const requestedEnhancement = args[0];

  if (!requestedEnhancement) {
    console.error("\n❌ Error: Please provide an enhancement type as a command-line argument.");
    console.log("   Example: npm start AddComments");
    console.log("Available types:", Object.values(EnhancementType).join(', '));
    process.exit(1);
  }

  if (!isValidEnhancementType(requestedEnhancement)) {
    console.error(`\n❌ Error: Invalid enhancement type "${requestedEnhancement}".`);
    console.log("Available types:", Object.values(EnhancementType).join(', '));
    process.exit(1);
  }
  return requestedEnhancement as EnhancementType;
}

/**
 * The main function that orchestrates the code enhancement process.
 */
async function main() {
  const actionType = parseArguments(); // Changed variable name for clarity
  console.log(`Selected action: ${actionType}`);

  let codeToProcess: string;
  let isModificationAllowed = false; // Flag to control if file update happens

  // --- Determine the code source and action ---
  if (actionType === EnhancementType.ConsolidateAndAnalyze) {
    console.log("\nAction requires consolidation...");
    try {
      // Consolidate from the project's root directory
      const projectRoot = process.cwd(); // Or get from config if needed
      codeToProcess = await getConsolidatedSources(projectRoot);
      // We don't modify files when just consolidating and analyzing
      isModificationAllowed = false;
      console.log("Consolidation complete. Proceeding to analysis...");
    } catch (consolidationError) {
      console.error("❌ Failed during code consolidation step:", consolidationError);
      process.exit(1);
    }
  } else {
    // For other actions, read the specifically configured target file
    console.log("\nAction targets specific code file...");
    try {
      originalCode = readCodeFile(CODE_FILE_PATH);
      codeToProcess = originalCode; // The code to send to Gemini is from the file
      // Only allow modification for specific types like AddComments
      isModificationAllowed = (actionType === EnhancementType.AddComments);
      if (!codeToProcess && codeToProcess !== '') {
        throw new Error("Read code file but result was empty or invalid.");
      }
    } catch (error) {
      console.error(`Failed to read initial code file (${CODE_FILE_PATH}). Exiting.`);
      process.exit(1);
    }
  }


  // --- Determine the type of enhancement to request from Gemini ---
  let geminiEnhancementRequestType: EnhancementType;
  if (actionType === EnhancementType.ConsolidateAndAnalyze) {
    geminiEnhancementRequestType = EnhancementType.Analyze; // Analyze the consolidated code
  } else {
    geminiEnhancementRequestType = actionType; // Use the action type directly
  }


  // --- Call the Gemini service ---
  console.log(`\nInvoking Gemini service for enhancement: ${geminiEnhancementRequestType}...`);
  const result: GeminiEnhancementResult = await enhanceCodeWithGemini(geminiEnhancementRequestType, codeToProcess);

  // --- Process the result from the service ---
  console.log("\nProcessing Gemini service result...");
  switch (result.type) {
    case 'code':
      // Handle results where code modification was expected (e.g., AddComments)
      if (result.content) {
        if (isModificationAllowed) {
          // Compare with the ORIGINAL code read from the file, not the consolidated one
          const originalCodeForComparison = readCodeFile(CODE_FILE_PATH); // Re-read for safety? Or use stored 'originalCode'

          if (originalCodeForComparison.trim() !== result.content.trim()) {
            console.log("\n✨ Proposed code changes detected from Gemini!");
            console.log(`--- Proposed Code Snippet for ${path.basename(CODE_FILE_PATH)} (first 20 lines) ---`);
            console.log(result.content.split('\n').slice(0, 20).join('\n'));
            if (result.content.split('\n').length > 20) console.log('...');
            console.log("-----------------------------------------------------");
            updateCodeFile(CODE_FILE_PATH, result.content); // Attempt to overwrite the specific target file
          } else {
            console.log("\n✅ Gemini response code seems identical to original code. No file update needed.");
          }
        } else {
          console.log("\nℹ️ Gemini returned code, but modification is not enabled for this action type.");
          console.log("--- Received Code Snippet (first 20 lines) ---");
          console.log(result.content.split('\n').slice(0, 20).join('\n'));
          if (result.content.split('\n').length > 20) console.log('...');
          console.log("----------------------------------------------");
        }
      } else {
        console.error("❌ Internal Error: Gemini service result type is 'code' but content is missing.");
      }
      break;

    case 'text':
      // Handle results that are purely textual (e.g., Analyze, Explain)
      console.log(`\n--- Gemini ${geminiEnhancementRequestType} Result ---`); // Use the type sent to Gemini
      console.log(result.content ?? 'Gemini returned empty text content.');
      console.log(`--- End ${geminiEnhancementRequestType} Result ---\n`);
      break;

    case 'error':
      // Handle errors reported by the Gemini service itself
      console.error(`\n❌ Enhancement process failed: ${result.content ?? 'No specific error message provided.'}`);
      break;

    default:
      // Should be unreachable
      const exhaustiveCheck: unknown = result;
      console.error(`Internal Error: Unhandled result type encountered in switch. Result object:`, exhaustiveCheck);
      throw new Error(`Unhandled GeminiEnhancementResult type: ${(exhaustiveCheck as any)?.type ?? 'unknown type'}`);
  }

  console.log("\nScript execution finished.");
}

// Execute main function with top-level error catching
main().catch(error => {
  console.error("\n🚨 An unexpected critical error occurred during execution:");
  if (error instanceof Error) {
    console.error(error.message);
    // console.error(error.stack); // Optional: log stack trace for debugging
  } else {
    console.error(error);
  }
  process.exit(1); // Exit with failure code on unhandled errors
});