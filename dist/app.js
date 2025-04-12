"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// src/app.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const gemini_service_1 = require("./gemini/gemini.service");
const enhancement_type_1 = require("./shared/types/enhancement.type");
// --- NEW IMPORT ---
const inspector_service_1 = require("./inspector/inspector.service");
// --- END NEW IMPORT ---
// readCodeFile, updateCodeFile, parseArguments functions remain the same...
/**
 * Reads the content of a code file.
 * @param filePath The path to the code file.
 * @returns The code content as a string.  Throws an error if the file cannot be read.
 */
function readCodeFile(filePath) {
    // ... (implementation remains the same) ...
    console.log(`Attempting to read code from: ${filePath}`);
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        console.log(`Successfully read ${code.length} characters.`);
        return code;
    }
    catch (readError) {
        console.error(`❌ Error reading file ${filePath}:`);
        if (readError instanceof Error) {
            console.error(readError.message);
        }
        else {
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
function updateCodeFile(filePath, newCode) {
    // ... (implementation remains the same) ...
    console.warn(`\n⚠️ WARNING: Attempting to automatically overwrite ${path.basename(filePath)}...`);
    try {
        fs.writeFileSync(filePath, newCode, 'utf8');
        console.log(`✅ Successfully updated ${filePath}.`);
        return true;
    }
    catch (writeError) {
        console.error(`❌ Error writing file ${filePath}:`);
        if (writeError instanceof Error) {
            console.error(writeError.message);
        }
        else {
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
function parseArguments() {
    // ... (implementation remains the same - now recognizes ConsolidateAndAnalyze) ...
    const args = process.argv.slice(2);
    const requestedEnhancement = args[0];
    if (!requestedEnhancement) {
        console.error("\n❌ Error: Please provide an enhancement type as a command-line argument.");
        console.log("   Example: npm start AddComments");
        console.log("Available types:", Object.values(enhancement_type_1.EnhancementType).join(', '));
        process.exit(1);
    }
    if (!(0, enhancement_type_1.isValidEnhancementType)(requestedEnhancement)) {
        console.error(`\n❌ Error: Invalid enhancement type "${requestedEnhancement}".`);
        console.log("Available types:", Object.values(enhancement_type_1.EnhancementType).join(', '));
        process.exit(1);
    }
    return requestedEnhancement;
}
/**
 * The main function that orchestrates the code enhancement process.
 */
async function main() {
    const actionType = parseArguments(); // Changed variable name for clarity
    console.log(`Selected action: ${actionType}`);
    let codeToProcess;
    let isModificationAllowed = false; // Flag to control if file update happens
    // --- Determine the code source and action ---
    if (actionType === enhancement_type_1.EnhancementType.ConsolidateAndAnalyze) {
        console.log("\nAction requires consolidation...");
        try {
            // Consolidate from the project's root directory
            const projectRoot = process.cwd(); // Or get from config if needed
            codeToProcess = await (0, inspector_service_1.getConsolidatedSources)(projectRoot);
            // We don't modify files when just consolidating and analyzing
            isModificationAllowed = false;
            console.log("Consolidation complete. Proceeding to analysis...");
        }
        catch (consolidationError) {
            console.error("❌ Failed during code consolidation step:", consolidationError);
            process.exit(1);
        }
    }
    else {
        // For other actions, read the specifically configured target file
        console.log("\nAction targets specific code file...");
        try {
            const originalCode = readCodeFile(config_1.CODE_FILE_PATH);
            codeToProcess = originalCode; // The code to send to Gemini is from the file
            // Only allow modification for specific types like AddComments
            isModificationAllowed = (actionType === enhancement_type_1.EnhancementType.AddComments);
            if (!codeToProcess && codeToProcess !== '') {
                throw new Error("Read code file but result was empty or invalid.");
            }
        }
        catch (error) {
            console.error(`Failed to read initial code file (${config_1.CODE_FILE_PATH}). Exiting.`);
            process.exit(1);
        }
    }
    // --- Determine the type of enhancement to request from Gemini ---
    let geminiEnhancementRequestType;
    if (actionType === enhancement_type_1.EnhancementType.ConsolidateAndAnalyze) {
        geminiEnhancementRequestType = enhancement_type_1.EnhancementType.Analyze; // Analyze the consolidated code
    }
    else {
        geminiEnhancementRequestType = actionType; // Use the action type directly
    }
    // --- Call the Gemini service ---
    console.log(`\nInvoking Gemini service for enhancement: ${geminiEnhancementRequestType}...`);
    const result = await (0, gemini_service_1.enhanceCodeWithGemini)(geminiEnhancementRequestType, codeToProcess);
    // --- Process the result from the service ---
    console.log("\nProcessing Gemini service result...");
    switch (result.type) {
        case 'code':
            // Handle results where code modification was expected (e.g., AddComments)
            if (result.content) {
                if (isModificationAllowed) {
                    // Compare with the ORIGINAL code read from the file, not the consolidated one
                    const originalCodeForComparison = readCodeFile(config_1.CODE_FILE_PATH); // Re-read for safety? Or use stored 'originalCode'
                    if (originalCodeForComparison.trim() !== result.content.trim()) {
                        console.log("\n✨ Proposed code changes detected from Gemini!");
                        console.log(`--- Proposed Code Snippet for ${path.basename(config_1.CODE_FILE_PATH)} (first 20 lines) ---`);
                        console.log(result.content.split('\n').slice(0, 20).join('\n'));
                        if (result.content.split('\n').length > 20)
                            console.log('...');
                        console.log("-----------------------------------------------------");
                        updateCodeFile(config_1.CODE_FILE_PATH, result.content); // Attempt to overwrite the specific target file
                    }
                    else {
                        console.log("\n✅ Gemini response code seems identical to original code. No file update needed.");
                    }
                }
                else {
                    console.log("\nℹ️ Gemini returned code, but modification is not enabled for this action type.");
                    console.log("--- Received Code Snippet (first 20 lines) ---");
                    console.log(result.content.split('\n').slice(0, 20).join('\n'));
                    if (result.content.split('\n').length > 20)
                        console.log('...');
                    console.log("----------------------------------------------");
                }
            }
            else {
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
            const exhaustiveCheck = result;
            console.error(`Internal Error: Unhandled result type encountered in switch. Result object:`, exhaustiveCheck);
            throw new Error(`Unhandled GeminiEnhancementResult type: ${exhaustiveCheck?.type ?? 'unknown type'}`);
    }
    console.log("\nScript execution finished.");
}
// Execute main function with top-level error catching
main().catch(error => {
    console.error("\n🚨 An unexpected critical error occurred during execution:");
    if (error instanceof Error) {
        console.error(error.message);
        // console.error(error.stack); // Optional: log stack trace for debugging
    }
    else {
        console.error(error);
    }
    process.exit(1); // Exit with failure code on unhandled errors
});
//# sourceMappingURL=app.js.map