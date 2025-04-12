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
// Removed CODE_FILE_PATH import
const gemini_service_1 = require("./gemini/gemini.service");
const enhancement_type_1 = require("./shared/types/enhancement.type");
// Updated inspector imports
const inspector_service_1 = require("./inspector/inspector.service");
/**
 * Parses command line arguments.
 * Expects: <ActionType> <TargetPath> [Prefix]
 * TargetPath is now mandatory.
 * @returns A ParsedArgs object. Exits if validation fails.
 */
function parseArguments() {
    const args = process.argv.slice(2);
    const actionString = args[0];
    const targetPath = args[1]; // Required
    const prefix = args[2]; // Optional
    // Validate Action Type
    if (!actionString) {
        console.error("\n❌ Error: Action type is required as the first argument.");
        // ... (updated usage examples) ...
        process.exit(1);
    }
    if (!(0, enhancement_type_1.isValidEnhancementType)(actionString)) {
        console.error(`\n❌ Error: Invalid action type "${actionString}".`);
        console.log("Available Action Types:", Object.values(enhancement_type_1.EnhancementType).join(', '));
        process.exit(1);
    }
    const action = actionString;
    // Validate Target Path
    if (!targetPath) {
        console.error("\n❌ Error: Target path (file or directory) is required as the second argument.");
        // ... (updated usage examples) ...
        process.exit(1);
    }
    try {
        fs.accessSync(targetPath); // Check if path exists at all
    }
    catch (e) {
        console.error(`\n❌ Error: Cannot access target path: ${targetPath}`);
        process.exit(1);
    }
    return { action, targetPath, prefix };
}
/**
 * Reads the content of a single code file.
 * @param filePath The path to the code file.
 * @returns The code content as a string. Throws an error if the file cannot be read or is not a file.
 */
function readSingleCodeFile(filePath) {
    console.log(`[App] Reading file: ${filePath}`);
    try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            throw new Error(`Target path is not a file: ${filePath}`);
        }
        const code = fs.readFileSync(filePath, 'utf8');
        console.log(`[App] Successfully read ${code.length} characters.`);
        return code;
    }
    catch (readError) {
        console.error(`❌ Error reading file ${filePath}:`);
        // ... (error logging) ...
        throw readError;
    }
}
/**
 * Updates the content of a code file. Provides a warning before overwriting.
 * @param filePath The path to the code file.
 * @param newCode The new code content to write to the file.
 * @returns True if the file was updated successfully, false otherwise.
 */
function updateCodeFile(filePath, newCode) {
    console.warn(`\n[App] ⚠️ WARNING: Attempting to overwrite ${path.basename(filePath)}...`);
    try {
        fs.writeFileSync(filePath, newCode, 'utf8');
        console.log(`[App] ✅ Successfully updated ${filePath}.`);
        return true;
    }
    catch (writeError) {
        console.error(`[App] ❌ Error writing file ${filePath}:`);
        // ... (error logging) ...
        return false;
    }
}
/**
 * The main function that orchestrates the code enhancement process.
 */
async function main() {
    const { action, targetPath, prefix } = parseArguments();
    console.log(`\nSelected action: ${action} on target: ${targetPath}${prefix ? ` with prefix: ${prefix}` : ''}`);
    // --- Determine if the action intends to modify files ---
    // Add other modifying actions here in the future
    const isModificationAction = (action === enhancement_type_1.EnhancementType.AddComments);
    try {
        const stats = fs.statSync(targetPath);
        let targetFiles = []; // List of absolute file paths to process
        // --- Identify target files ---
        if (stats.isDirectory()) {
            console.log(`[App] Target is a directory. Finding relevant files...`);
            targetFiles = await (0, inspector_service_1.getTargetFiles)(targetPath, prefix);
            if (targetFiles.length === 0) {
                console.log("\n[App] No relevant files found in the target directory matching criteria. Exiting.");
                return; // Exit gracefully
            }
            console.log(`[App] Found ${targetFiles.length} files to process.`);
        }
        else if (stats.isFile()) {
            console.log(`[App] Target is a single file.`);
            targetFiles.push(path.resolve(targetPath)); // Use the single resolved file path
        }
        else {
            console.error(`\n❌ Error: Target path ${targetPath} is neither a file nor a directory.`);
            process.exit(1);
        }
        // --- Process based on action type ---
        if (isModificationAction) {
            // --- MODIFICATION FLOW (Process files individually) ---
            console.log(`\n[App] Starting modification action '${action}' on ${targetFiles.length} file(s)...`);
            let successCount = 0;
            let unchangedCount = 0;
            let errorCount = 0;
            for (const filePath of targetFiles) {
                const relativeFilePath = path.relative(process.cwd(), filePath);
                console.log(`\n--- Processing file: ${relativeFilePath} ---`);
                try {
                    const originalCode = readSingleCodeFile(filePath);
                    console.log(`[App] Sending '${relativeFilePath}' to Gemini for '${action}'...`);
                    const result = await (0, gemini_service_1.enhanceCodeWithGemini)(action, originalCode);
                    if (result.type === 'code' && result.content) {
                        if (originalCode.trim() !== result.content.trim()) {
                            console.log(`[App] ✨ Changes detected for ${relativeFilePath}.`);
                            const updated = updateCodeFile(filePath, result.content);
                            if (updated)
                                successCount++;
                            else
                                errorCount++;
                        }
                        else {
                            console.log(`[App] ✅ No changes needed for ${relativeFilePath}.`);
                            unchangedCount++;
                        }
                    }
                    else if (result.type === 'error') {
                        console.error(`[App] ❌ Gemini service failed for ${relativeFilePath}: ${result.content}`);
                        errorCount++;
                    }
                    else {
                        console.warn(`[App] ⚠️ Received unexpected result type '${result.type}' (expected 'code') for ${relativeFilePath}. No changes applied.`);
                        errorCount++;
                    }
                }
                catch (fileProcessingError) {
                    console.error(`[App] ❌ Error processing file ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
                    errorCount++;
                }
                console.log(`--- Finished processing: ${relativeFilePath} ---`);
            }
            console.log("\n--- Modification Summary ---");
            console.log(`  Processed: ${targetFiles.length} file(s)`);
            console.log(`  Updated:   ${successCount}`);
            console.log(`  Unchanged: ${unchangedCount}`);
            console.log(`  Errors:    ${errorCount}`);
            console.log("--------------------------");
        }
        else {
            // --- NON-MODIFICATION FLOW (Analyze/Explain - may involve consolidation) ---
            let codeToAnalyze;
            let geminiRequestType = action; // Analyze, Explain, ConsolidateAndAnalyze
            if (stats.isDirectory() || action === enhancement_type_1.EnhancementType.ConsolidateAndAnalyze) {
                // Consolidate content from all target files for analysis/explanation
                console.log(`\n[App] Consolidating ${targetFiles.length} file(s) for non-modification action '${action}'...`);
                // IMPORTANT: We need the absolute path of the original target directory for consolidation header/paths
                const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetFiles[0]); // Best guess if single file C&A
                codeToAnalyze = await (0, inspector_service_1.getConsolidatedSources)(consolidationRoot, prefix); // Use original target path for root
                // If original action was ConsolidateAndAnalyze, the AI task is Analyze
                if (action === enhancement_type_1.EnhancementType.ConsolidateAndAnalyze) {
                    geminiRequestType = enhancement_type_1.EnhancementType.Analyze;
                }
            }
            else {
                // Action is Analyze/Explain on a single file
                codeToAnalyze = readSingleCodeFile(targetFiles[0]); // Read the single file
            }
            console.log(`\n[App] Invoking Gemini service for action: ${geminiRequestType}...`);
            const result = await (0, gemini_service_1.enhanceCodeWithGemini)(geminiRequestType, codeToAnalyze);
            if (result.type === 'text') {
                console.log(`\n--- Gemini ${geminiRequestType} Result ---`);
                console.log(result.content ?? 'Gemini returned empty text content.');
                console.log(`--- End ${geminiRequestType} Result ---\n`);
            }
            else if (result.type === 'error') {
                console.error(`\n[App] ❌ Gemini service failed: ${result.content}`);
            }
            else {
                console.warn(`[App] ⚠️ Received unexpected result type '${result.type}' (expected 'text') for ${geminiRequestType} action.`);
                // Optionally print the code content if received unexpectedly
                if (result.content) {
                    console.log("--- Unexpected Code Snippet (first 20 lines) ---");
                    console.log(result.content.split('\n').slice(0, 20).join('\n') + (result.content.split('\n').length > 20 ? '\n...' : ''));
                    console.log("----------------------------------------------");
                }
            }
        }
    }
    catch (error) { // Catch errors from initial statSync or getTargetFiles etc.
        console.error("\n❌ Error determining or accessing target path(s):", error instanceof Error ? error.message : error);
        process.exit(1);
    }
    console.log("\nScript execution finished.");
}
// Execute main function with top-level error catching
main().catch(error => {
    console.error("\n🚨 An unexpected critical error occurred during execution:");
    // ... (error logging remains the same) ...
    process.exit(1);
});
//# sourceMappingURL=app.js.map