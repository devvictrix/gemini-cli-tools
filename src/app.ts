// src/app.ts
import * as fs from 'fs';
import * as path from 'path';
// Removed CODE_FILE_PATH import
import { enhanceCodeWithGemini, GeminiEnhancementResult } from './gemini/gemini.service';
import { EnhancementType, isValidEnhancementType } from './shared/types/enhancement.type';
// Updated inspector imports
import { getConsolidatedSources, getTargetFiles } from './inspector/inspector.service';

// --- Argument Parsing Interface ---
/**
 * Represents the parsed command-line arguments.
 */
interface ParsedArgs {
	/** The type of enhancement to perform. */
	action: EnhancementType;
	/** The target file or directory path. */
	targetPath: string; // Target file or directory path - NOW REQUIRED
	/** An optional filename prefix for consolidation/directory processing. */
	prefix?: string;     // Optional filename prefix for consolidation/directory processing
}

/**
 * Parses command line arguments.
 * Expects: <ActionType> <TargetPath> [Prefix]
 * TargetPath is now mandatory.
 * @returns A ParsedArgs object. Exits if validation fails.
 */
function parseArguments(): ParsedArgs {
	const args = process.argv.slice(2);
	const actionString = args[0];
	const targetPath = args[1]; // Required
	const prefix = args[2];     // Optional

	// Validate Action Type
	if (!actionString) {
		console.error("\n❌ Error: Action type is required as the first argument.");
		// ... (updated usage examples) ...
		process.exit(1);
	}
	if (!isValidEnhancementType(actionString)) {
		console.error(`\n❌ Error: Invalid action type "${actionString}".`);
		console.log("Available Action Types:", Object.values(EnhancementType).join(', '));
		process.exit(1);
	}
	const action = actionString as EnhancementType;

	// Validate Target Path
	if (!targetPath) {
		console.error("\n❌ Error: Target path (file or directory) is required as the second argument.");
		// ... (updated usage examples) ...
		process.exit(1);
	}
	try {
		fs.accessSync(targetPath); // Check if path exists at all
	} catch (e) {
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
function readSingleCodeFile(filePath: string): string {
	console.log(`[App] Reading file: ${filePath}`);
	try {
		const stats = fs.statSync(filePath);
		if (!stats.isFile()) {
			throw new Error(`Target path is not a file: ${filePath}`);
		}
		const code = fs.readFileSync(filePath, 'utf8');
		console.log(`[App] Successfully read ${code.length} characters.`);
		return code;
	} catch (readError) {
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
function updateCodeFile(filePath: string, newCode: string): boolean {
	console.warn(`\n[App] ⚠️ WARNING: Attempting to overwrite ${path.basename(filePath)}...`);
	try {
		fs.writeFileSync(filePath, newCode, 'utf8');
		console.log(`[App] ✅ Successfully updated ${filePath}.`);
		return true;
	} catch (writeError) {
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
	const isModificationAction = (action === EnhancementType.AddComments);

	try {
		const stats = fs.statSync(targetPath);
		let targetFiles: string[] = []; // List of absolute file paths to process

		// --- Identify target files ---
		if (stats.isDirectory()) {
			console.log(`[App] Target is a directory. Finding relevant files...`);
			targetFiles = await getTargetFiles(targetPath, prefix);
			if (targetFiles.length === 0) {
				console.log("\n[App] No relevant files found in the target directory matching criteria. Exiting.");
				return; // Exit gracefully
			}
			console.log(`[App] Found ${targetFiles.length} files to process.`);
		} else if (stats.isFile()) {
			console.log(`[App] Target is a single file.`);
			targetFiles.push(path.resolve(targetPath)); // Use the single resolved file path
		} else {
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
					const result: GeminiEnhancementResult = await enhanceCodeWithGemini(action, originalCode);

					if (result.type === 'code' && result.content) {
						if (originalCode.trim() !== result.content.trim()) {
							console.log(`[App] ✨ Changes detected for ${relativeFilePath}.`);
							const updated = updateCodeFile(filePath, result.content);
							if (updated) successCount++;
							else errorCount++;
						} else {
							console.log(`[App] ✅ No changes needed for ${relativeFilePath}.`);
							unchangedCount++;
						}
					} else if (result.type === 'error') {
						console.error(`[App] ❌ Gemini service failed for ${relativeFilePath}: ${result.content}`);
						errorCount++;
					} else {
						console.warn(`[App] ⚠️ Received unexpected result type '${result.type}' (expected 'code') for ${relativeFilePath}. No changes applied.`);
						errorCount++;
					}
				} catch (fileProcessingError) {
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

		} else {
			// --- NON-MODIFICATION FLOW (Analyze/Explain - may involve consolidation) ---
			let codeToAnalyze: string;
			let geminiRequestType = action; // Analyze, Explain, ConsolidateAndAnalyze

			if (stats.isDirectory() || action === EnhancementType.ConsolidateAndAnalyze) {
				// Consolidate content from all target files for analysis/explanation
				console.log(`\n[App] Consolidating ${targetFiles.length} file(s) for non-modification action '${action}'...`);
				// IMPORTANT: We need the absolute path of the original target directory for consolidation header/paths
				const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetFiles[0]); // Best guess if single file C&A

				codeToAnalyze = await getConsolidatedSources(consolidationRoot, prefix); // Use original target path for root
				// If original action was ConsolidateAndAnalyze, the AI task is Analyze
				if (action === EnhancementType.ConsolidateAndAnalyze) {
					geminiRequestType = EnhancementType.Analyze;
				}
			} else {
				// Action is Analyze/Explain on a single file
				codeToAnalyze = readSingleCodeFile(targetFiles[0]); // Read the single file
			}

			console.log(`\n[App] Invoking Gemini service for action: ${geminiRequestType}...`);
			const result: GeminiEnhancementResult = await enhanceCodeWithGemini(geminiRequestType, codeToAnalyze);

			if (result.type === 'text') {
				console.log(`\n--- Gemini ${geminiRequestType} Result ---`);
				console.log(result.content ?? 'Gemini returned empty text content.');
				console.log(`--- End ${geminiRequestType} Result ---\n`);
			} else if (result.type === 'error') {
				console.error(`\n[App] ❌ Gemini service failed: ${result.content}`);
			} else {
				console.warn(`[App] ⚠️ Received unexpected result type '${result.type}' (expected 'text') for ${geminiRequestType} action.`);
				// Optionally print the code content if received unexpectedly
				if (result.content) {
					console.log("--- Unexpected Code Snippet (first 20 lines) ---");
					console.log(result.content.split('\n').slice(0, 20).join('\n') + (result.content.split('\n').length > 20 ? '\n...' : ''));
					console.log("----------------------------------------------");
				}
			}
		}

	} catch (error) { // Catch errors from initial statSync or getTargetFiles etc.
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