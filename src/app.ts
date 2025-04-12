// src/app.ts
import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit'; // Import p-limit for concurrency control
import { enhanceCodeWithGemini, GeminiEnhancementResult } from './gemini/gemini.service.js';
import { EnhancementType, isValidEnhancementType } from './shared/types/enhancement.type.js';
import { getConsolidatedSources, getTargetFiles } from './inspector/inspector.service.js';
// Note: Removed import for CODE_FILE_PATH as it's no longer used as a default

// --- Interfaces ---

/**
 * Represents the parsed command-line arguments.
 */
interface ParsedArgs {
	/** The type of enhancement action to perform. */
	action: EnhancementType;
	/** The target file or directory path. This is now required. */
	targetPath: string;
	/** An optional filename prefix filter for directory processing. */
	prefix?: string;
}

/**
 * Represents the outcome of processing a single file in parallel.
 */
interface FileProcessingResult {
	/** The relative path of the file for logging. */
	filePath: string;
	/** The status indicating the outcome of the processing. */
	status: 'updated' | 'unchanged' | 'error';
	/** An optional message, typically used for error details. */
	message?: string;
}

// --- Function Definitions ---

/**
 * Parses command line arguments.
 * Expects: <ActionType> <TargetPath> [Prefix]
 * TargetPath is now mandatory.
 * @returns A ParsedArgs object containing the validated arguments. Exits if validation fails.
 */
function parseArguments(): ParsedArgs {
	const args = process.argv.slice(2);
	const actionString = args[0];
	const targetPath = args[1]; // Required
	const prefix = args[2];     // Optional

	// Validate Action Type
	if (!actionString) {
		console.error("\n❌ Error: Action type is required as the first argument.");
		console.log("\nUsage: npm start <ActionType> <TargetPath> [FilePrefix]");
		console.log("\nExample (Add comments): npm start AddComments src/app.ts");
		console.log("Example (Analyze dir): npm start Analyze ./src");
		console.log("Example (Add comments to dir): npm start AddComments ./src/gemini");
		console.log("Example (Consolidate & Analyze prefix): npm start ConsolidateAndAnalyze ./src api");
		console.log("\nAvailable Action Types:", Object.values(EnhancementType).join(', '));
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
		console.log("\nUsage: npm start <ActionType> <TargetPath> [FilePrefix]");
		// Show usage examples again or be more specific
		process.exit(1);
	}
	try {
		// Basic check if the path exists and is accessible
		fs.accessSync(targetPath);
	} catch (e) {
		console.error(`\n❌ Error: Cannot access target path: ${targetPath}. Please ensure it exists.`);
		process.exit(1);
	}

	return { action, targetPath, prefix };
}

/**
 * Reads the content of a single code file synchronously.
 * @param filePath The absolute path to the code file.
 * @returns The code content as a string.
 * @throws An error if the file cannot be read or is not a file.
 */
function readSingleCodeFile(filePath: string): string {
	console.log(`[App] Reading file: ${path.relative(process.cwd(), filePath)}`);
	try {
		const stats = fs.statSync(filePath);
		if (!stats.isFile()) {
			throw new Error(`Target path is not a file: ${filePath}`);
		}
		const code = fs.readFileSync(filePath, 'utf8');
		// Avoid logging huge content lengths here in parallel processing
		// console.log(`[App] Successfully read ${code.length} characters.`);
		return code;
	} catch (readError) {
		console.error(`[App] ❌ Error reading file ${path.relative(process.cwd(), filePath)}: ${readError instanceof Error ? readError.message : readError}`);
		throw readError; // Re-throw to be caught by the caller (processSingleFile or main)
	}
}

/**
 * Updates the content of a code file synchronously. Provides a warning before overwriting.
 * @param filePath The absolute path to the code file.
 * @param newCode The new code content to write to the file.
 * @returns True if the file was updated successfully, false otherwise.
 */
function updateCodeFile(filePath: string, newCode: string): boolean {
	const relativeFilePath = path.relative(process.cwd(), filePath);
	console.warn(`[App] ⚠️ Attempting to overwrite ${relativeFilePath}...`);
	try {
		fs.writeFileSync(filePath, newCode, 'utf8');
		console.log(`[App] ✅ Successfully updated ${relativeFilePath}.`);
		// Future: Consider adding git staging command here conditionally
		return true;
	} catch (writeError) {
		console.error(`[App] ❌ Error writing file ${relativeFilePath}: ${writeError instanceof Error ? writeError.message : writeError}`);
		return false;
	}
}

// --- Main Execution Logic ---
async function main() {
	const { action, targetPath, prefix } = parseArguments();
	console.log(`\nSelected action: ${action} on target: ${targetPath}${prefix ? ` with prefix: ${prefix}` : ''}`);

	// --- Determine if the action intends to modify files ---
	// Define actions that result in file modifications
	const isModificationAction = [
		EnhancementType.AddComments,
		// Add other future modifying types here (e.g., RefactorCode)
	].includes(action);

	try {
		const stats = fs.statSync(targetPath);
		let targetFiles: string[] = []; // List of absolute file paths to process

		// --- Identify target files ---
		if (stats.isDirectory()) {
			console.log(`[App] Target is a directory. Finding relevant files...`);
			// Use the inspector service to get files based on config and optional prefix
			targetFiles = await getTargetFiles(targetPath, prefix);
			if (targetFiles.length === 0) {
				console.log("\n[App] No relevant files found in the target directory matching criteria. Exiting.");
				return; // Exit gracefully if no files match
			}
			console.log(`[App] Found ${targetFiles.length} files to process.`);
		} else if (stats.isFile()) {
			console.log(`[App] Target is a single file.`);
			// Ensure it's an absolute path for consistency
			targetFiles.push(path.resolve(targetPath));
		} else {
			// This case should ideally be caught by accessSync earlier, but safety check
			console.error(`\n❌ Error: Target path ${targetPath} is neither a file nor a directory.`);
			process.exit(1);
		}


		// --- Process based on action type ---
		if (isModificationAction) {
			// --- MODIFICATION FLOW (Parallel Processing) ---

			// Configure concurrency limit for parallel API calls
			const concurrencyLimit = 5; // Adjust based on testing and API rate limits
			const limit = pLimit(concurrencyLimit);
			console.log(`\n[App] Starting PARALLEL modification action '${action}' on ${targetFiles.length} file(s) with concurrency ${concurrencyLimit}...`);

			/**
			 * Async function to process a single file: read, enhance via Gemini, update if changed.
			 * Designed to be used with p-limit.
			 * @param absoluteFilePath The absolute path to the file.
			 * @returns A promise resolving to a FileProcessingResult object.
			 */
			async function processSingleFile(absoluteFilePath: string): Promise<FileProcessingResult> {
				const relativeFilePath = path.relative(process.cwd(), absoluteFilePath);
				// Short log indicating start, more details come after processing
				console.log(` -> Processing: ${relativeFilePath}`);

				try {
					const originalCode = readSingleCodeFile(absoluteFilePath);
					const result: GeminiEnhancementResult = await enhanceCodeWithGemini(action, originalCode);

					// Process Gemini's result for this file
					if (result.type === 'code' && result.content) {
						console.log(`--- Extracted Code Preview for ${relativeFilePath} ---`);
						console.log(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : '')); // Log first 500 chars
						console.log(`--- End Preview (${result.content.length} chars) ---`);

						if (originalCode.trim() !== result.content.trim()) {
							console.log(`    ✨ Changes detected for ${relativeFilePath}.`);
							const updated = updateCodeFile(absoluteFilePath, result.content);
							return { filePath: relativeFilePath, status: updated ? 'updated' : 'error', message: updated ? undefined : 'File write failed' };
						} else {
							console.log(`    ✅ No changes needed for ${relativeFilePath}.`);
							return { filePath: relativeFilePath, status: 'unchanged' };
						}
					} else if (result.type === 'error') {
						console.error(`    ❌ Gemini failed for ${relativeFilePath}: ${result.content}`);
						return { filePath: relativeFilePath, status: 'error', message: `Gemini Error: ${result.content}` };
					} else {
						// Gemini returned text when code was expected
						console.warn(`    ⚠️ Received unexpected result type '${result.type}' (expected 'code') for ${relativeFilePath}.`);
						return { filePath: relativeFilePath, status: 'error', message: `Unexpected result type: ${result.type}` };
					}
				} catch (fileProcessingError) {
					// Catch errors from readSingleCodeFile or other sync issues within this file's process
					console.error(`    ❌ Error during processing for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
					return { filePath: relativeFilePath, status: 'error', message: `File Processing Error: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}` };
				}
			} // end processSingleFile

			// Create an array of promises, each wrapped by the concurrency limiter
			const tasks = targetFiles.map(filePath => limit(() => processSingleFile(filePath)));

			// Wait for all the limited promises to settle (complete or reject)
			const results: FileProcessingResult[] = await Promise.all(tasks);

			// Aggregate results for a final summary
			let successCount = 0;
			let unchangedCount = 0;
			let errorCount = 0;
			results.forEach(res => {
				switch (res.status) {
					case 'updated': successCount++; break;
					case 'unchanged': unchangedCount++; break;
					case 'error':
						errorCount++;
						// Optionally log the error message again in summary
						// console.error(`   - Error on ${res.filePath}: ${res.message}`);
						break;
				}
			});

			// Print Final Summary
			console.log("\n--- Parallel Modification Summary ---");
			console.log(`  Total Files Processed: ${targetFiles.length}`);
			console.log(`  Successfully Updated:  ${successCount}`);
			console.log(`  No Changes Needed:   ${unchangedCount}`);
			console.log(`  Errors Encountered:    ${errorCount}`);
			console.log("---------------------------------");
			// Optionally exit with non-zero code if errors occurred
			if (errorCount > 0) process.exitCode = 1;


		} else {
			// --- NON-MODIFICATION FLOW (Analyze/Explain etc.) ---
			let codeToProcess: string;
			let geminiRequestType = action;

			// Determine source: consolidate directory or read single file
			if (stats.isDirectory() || action === EnhancementType.ConsolidateAndAnalyze) {
				console.log(`\n[App] Consolidating ${targetFiles.length} file(s) for non-modification action '${action}'...`);
				// Need the original directory path for getConsolidatedSources' relative path generation
				const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetFiles[0]);
				codeToProcess = await getConsolidatedSources(consolidationRoot, prefix);

				// Adjust Gemini task type if consolidating specifically for analysis
				if (action === EnhancementType.ConsolidateAndAnalyze) {
					geminiRequestType = EnhancementType.Analyze;
				}
			} else {
				// Action is Analyze/Explain on a single file that was identified
				codeToProcess = readSingleCodeFile(targetFiles[0]);
			}

			// Call Gemini service with potentially consolidated code
			console.log(`\n[App] Invoking Gemini service for action: ${geminiRequestType}...`);
			const result: GeminiEnhancementResult = await enhanceCodeWithGemini(geminiRequestType, codeToProcess);

			// Process and display the textual or error result
			if (result.type === 'text') {
				console.log(`\n--- Gemini ${geminiRequestType} Result ---`);
				console.log(result.content ?? 'Gemini returned empty text content.'); // Handle null/empty content
				console.log(`--- End ${geminiRequestType} Result ---\n`);
			} else if (result.type === 'error') {
				console.error(`\n[App] ❌ Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
			} else {
				// Should not happen if requesting Analyze/Explain, but handle defensively
				console.warn(`[App] ⚠️ Received unexpected result type '${result.type}' (expected 'text') for ${geminiRequestType} action.`);
				if (result.content) { // If code was unexpectedly returned, show a snippet
					console.log("--- Unexpected Code Snippet (first 20 lines) ---");
					console.log(result.content.split('\n').slice(0, 20).join('\n') + (result.content.split('\n').length > 20 ? '\n...' : ''));
					console.log("----------------------------------------------");
				}
			}
		} // end else (non-modification flow)

	} catch (error) { // Catch errors from initial statSync or getTargetFiles etc.
		console.error("\n❌ Error during initial setup or file identification phase:", error instanceof Error ? error.message : error);
		process.exit(1);
	}

	console.log("\nScript execution finished.");
} // end main


// --- Global Error Catching & Script Execution ---
main().catch(error => {
	console.error("\n🚨 An unexpected critical error occurred during execution:");
	if (error instanceof Error) {
		console.error(`   Message: ${error.message}`);
		// console.error(error.stack); // Optional: log stack trace for detailed debugging
	} else {
		console.error("   An unknown error object was thrown:", error);
	}
	process.exit(1); // Exit with failure code on unhandled errors
});