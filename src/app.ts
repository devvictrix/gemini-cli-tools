// src/app.ts

import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit'; // Import p-limit for concurrency control
import { enhanceCodeWithGemini, GeminiEnhancementResult } from './gemini/gemini.service.js';
import { EnhancementType, isValidEnhancementType } from './shared/types/enhancement.type.js';
// Assuming you've done the refactor to filesystem:
import { getConsolidatedSources, getTargetFiles } from './filesystem/filesystem.service.js';
import { EXCLUDE_FILENAMES } from './filesystem/filesystem.config.js';

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
		console.log("\nExamples:");
		console.log("  npm start AddComments src/app.ts");
		console.log("  npm start Analyze ./src");
		console.log("  npm start AddPathComment ./src"); // Example for new command
		console.log("  npm start AddPathComment ./src/shared types"); // Example with prefix
		console.log("  npm start ConsolidateAndAnalyze ./src api");
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
	const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
	console.log(`[App] Reading file: ${relativeFilePath}`);
	try {
		const stats = fs.statSync(filePath);
		if (!stats.isFile()) {
			throw new Error(`Target path is not a file: ${filePath}`);
		}
		const code = fs.readFileSync(filePath, 'utf8');
		return code;
	} catch (readError) {
		console.error(`[App] ❌ Error reading file ${relativeFilePath}: ${readError instanceof Error ? readError.message : readError}`);
		throw readError;
	}
}

/**
 * Updates the content of a code file synchronously. Provides a warning before overwriting.
 * @param filePath The absolute path to the code file.
 * @param newCode The new code content to write to the file.
 * @returns True if the file was updated successfully, false otherwise.
 */
function updateCodeFile(filePath: string, newCode: string): boolean {
	const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
	console.warn(`[App] ⚠️ Attempting to overwrite ${relativeFilePath}...`);
	try {
		fs.writeFileSync(filePath, newCode, 'utf8');
		console.log(`[App] ✅ Successfully updated ${relativeFilePath}.`);
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

	// Define which actions modify files
	const isModificationAction = [
		EnhancementType.AddComments,
		EnhancementType.AddPathComment, // Added new action
	].includes(action);

	// Define actions that use Gemini
	const usesGeminiApi = [
		EnhancementType.AddComments,
		EnhancementType.Analyze,
		EnhancementType.Explain,
		EnhancementType.ConsolidateAndAnalyze,
	].includes(action); // AddPathComment does NOT use Gemini

	try {
		const stats = fs.statSync(targetPath);
		let targetFiles: string[] = [];

		// --- Identify target files ---
		if (stats.isDirectory()) {
			console.log(`[App] Target is a directory. Finding relevant files...`);
			targetFiles = await getTargetFiles(targetPath, prefix); // Use filesystem service
			if (targetFiles.length === 0) {
				console.log("\n[App] No relevant files found matching criteria or remaining after exclusions. Exiting.");
				return;
			}
			console.log(`[App] Found ${targetFiles.length} files to process.`);
		} else if (stats.isFile()) {
			// Check if the single file should be excluded based on filename config
			const filename = path.basename(targetPath);
			// A more complete solution might load EXCLUDE_FILENAMES from config here
			// For now, we assume it passed if it got here (basic check)
			if (EXCLUDE_FILENAMES.has(filename)) { // Example if config was loaded
			    console.log(`[App] Target file ${filename} is excluded by configuration.`);
			    return;
			}
			console.log(`[App] Target is a single file.`);
			targetFiles.push(path.resolve(targetPath));
		} else {
			console.error(`\n❌ Error: Target path ${targetPath} is neither a file nor a directory.`);
			process.exit(1);
		}

		// --- Process based on action type ---

		if (isModificationAction) {
			// --- MODIFICATION FLOW (Parallel Processing) ---
			const concurrencyLimit = 10; // Higher concurrency for local I/O
			const limit = pLimit(concurrencyLimit);
			console.log(`\n[App] Starting PARALLEL modification action '${action}' on ${targetFiles.length} file(s) with concurrency ${concurrencyLimit}...`);

			let fileProcessor: (absoluteFilePath: string) => Promise<FileProcessingResult>;

			// --- Select Processor for AddComments ---
			if (action === EnhancementType.AddComments) {
				fileProcessor = async (absoluteFilePath): Promise<FileProcessingResult> => {
					const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
					console.log(` -> Processing (Gemini): ${relativeFilePath}`);
					try {
						const originalCode = readSingleCodeFile(absoluteFilePath);
						const result: GeminiEnhancementResult = await enhanceCodeWithGemini(action, originalCode); // Call Gemini

						if (result.type === 'code' && result.content) {
							// Optional preview log
							console.log(`--- Extracted Code Preview for ${relativeFilePath} ---`);
							console.log(result.content.substring(0, 300) + (result.content.length > 300 ? '...' : ''));
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
							console.warn(`    ⚠️ Received unexpected result type '${result.type}' (expected 'code') for ${relativeFilePath}.`);
							return { filePath: relativeFilePath, status: 'error', message: `Unexpected result type: ${result.type}` };
						}
					} catch (fileProcessingError) {
						console.error(`    ❌ Error during Gemini processing for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
						return { filePath: relativeFilePath, status: 'error', message: `File Processing Error: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}` };
					}
				};
				// --- Select Processor for AddPathComment ---
			} else if (action === EnhancementType.AddPathComment) {
				fileProcessor = async (absoluteFilePath): Promise<FileProcessingResult> => {
					const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/'); // Use forward slashes
					console.log(` -> Processing (AddPath): ${relativeFilePath}`);
					try {
						const pathComment = `// ${relativeFilePath}`;
						const originalCode = readSingleCodeFile(absoluteFilePath);
						const lines = originalCode.split(/\r?\n/);

						const pathCommentRegex = /^\s*\/\/\s*[\w\-\/\\.]+\.(ts|js|json|env)\s*$/;
						let existingCommentIndex = -1;
						let firstNonEmptyLineIndex = -1;

						// Find first non-empty line and check if it's the target comment
						for (let i = 0; i < lines.length; i++) {
							const lineTrimmed = lines[i].trim();
							if (lineTrimmed !== '') {
								firstNonEmptyLineIndex = i;
								if (pathCommentRegex.test(lineTrimmed) && lineTrimmed === pathComment) {
									existingCommentIndex = i;
								}
								break;
							}
						}

						let needsUpdate = true;
						if (existingCommentIndex === firstNonEmptyLineIndex && existingCommentIndex !== -1) {
							// Check if the exact comment exists as the first non-empty line
							// AND is followed by a blank line (or is the only line)
							if (lines.length === existingCommentIndex + 1 || (lines.length > existingCommentIndex + 1 && lines[existingCommentIndex + 1].trim() === '')) {
								console.log(`    ✅ Path comment already exists correctly formatted in ${relativeFilePath}.`);
								needsUpdate = false;
							} else {
								console.log(`    ⚠️ Path comment exists but formatting differs (no blank line after) in ${relativeFilePath}. Will reformat.`);
							}
						} else if (firstNonEmptyLineIndex !== -1 && pathCommentRegex.test(lines[firstNonEmptyLineIndex].trim())) {
							// A *different* path comment exists at the start
							console.log(`    ⚠️ Different path comment exists at the start of ${relativeFilePath}. Will overwrite.`);
						} else if (existingCommentIndex !== -1) {
							// Our comment exists, but not as the first non-empty line
							console.log(`    ⚠️ Path comment exists but not at the start in ${relativeFilePath}. Will move and reformat.`);
						}

						if (!needsUpdate) {
							return { filePath: relativeFilePath, status: 'unchanged' };
						} else {
							// --- Modification logic: Remove old & add new ---
							let tempLines = originalCode.split(/\r?\n/);

							// Remove any existing path comment lines or blank lines from the very start
							let linesRemoved = false;
							while (tempLines.length > 0) {
								const firstLineTrimmed = tempLines[0].trim();
								if (pathCommentRegex.test(firstLineTrimmed) || firstLineTrimmed === '') {
									tempLines.shift(); // Remove the line
									linesRemoved = true;
								} else {
									break; // Stop when a non-comment/non-blank line is found
								}
							}
							const codeWithoutHeader = tempLines.join('\n');

							// Prepend the correct comment and ensure a blank line after
							const newCode = `${pathComment}\n\n${codeWithoutHeader}`;

							console.log(`    ➕ Adding/Updating path comment for ${relativeFilePath}.`);
							const updated = updateCodeFile(absoluteFilePath, newCode);
							return { filePath: relativeFilePath, status: updated ? 'updated' : 'error', message: updated ? undefined : 'File write failed' };
						}

					} catch (fileProcessingError) {
						console.error(`    ❌ Error during AddPathComment for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
						return { filePath: relativeFilePath, status: 'error', message: `AddPathComment Error: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}` };
					}
				};
			} else {
				// Fallback for unhandled modification actions
				console.error(`[App] Internal Error: Unhandled modification action type "${action}" in processor selection.`);
				// Assign a dummy processor to prevent runtime errors, it will return an error result
				fileProcessor = async (absoluteFilePath) => ({
					filePath: path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/'),
					status: 'error',
					message: `Unhandled modification action: ${action}`
				});
			}

			// --- Run tasks in parallel ---
			const tasks = targetFiles.map(filePath => limit(() => fileProcessor(filePath)));
			const results: FileProcessingResult[] = await Promise.all(tasks);

			// --- Aggregate and print summary ---
			let successCount = 0;
			let unchangedCount = 0;
			let errorCount = 0;
			results.forEach(res => {
				switch (res.status) {
					case 'updated': successCount++; break;
					case 'unchanged': unchangedCount++; break;
					case 'error':
						errorCount++;
						// Optional: Log specific file errors again in summary
						// console.error(`   - Error on ${res.filePath}: ${res.message}`);
						break;
				}
			});

			console.log("\n--- Parallel Modification Summary ---");
			console.log(`  Action:              ${action}`);
			console.log(`  Total Files Target:  ${targetFiles.length}`);
			console.log(`  Successfully Updated:  ${successCount}`);
			console.log(`  No Changes Needed:   ${unchangedCount}`);
			console.log(`  Errors Encountered:    ${errorCount}`);
			console.log("---------------------------------");
			if (errorCount > 0) process.exitCode = 1; // Set exit code on error

		} else if (usesGeminiApi) {
			// --- NON-MODIFICATION FLOW using GEMINI (Analyze/Explain/ConsolidateAndAnalyze) ---
			let codeToProcess: string;
			let geminiRequestType = action; // Usually same as action

			if (action === EnhancementType.ConsolidateAndAnalyze) {
				console.log(`\n[App] Consolidating ${targetFiles.length} file(s) for ${action}...`);
				const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetFiles[0]);
				codeToProcess = await getConsolidatedSources(consolidationRoot, prefix); // Use filesystem service
				geminiRequestType = EnhancementType.Analyze; // Override type for Gemini call
			} else if (stats.isDirectory()) {
				// Analyze/Explain on a directory implies consolidation first
				console.log(`\n[App] Consolidating ${targetFiles.length} file(s) for ${action}...`);
				const consolidationRoot = targetPath;
				codeToProcess = await getConsolidatedSources(consolidationRoot, prefix); // Use filesystem service
			} else {
				// Action is Analyze/Explain on a single file
				if (targetFiles.length !== 1) {
					// This check is mostly for internal consistency
					console.error(`[App] Internal Error: Expected 1 target file for ${action} on a file path, but found ${targetFiles.length}.`);
					process.exit(1);
				}
				codeToProcess = readSingleCodeFile(targetFiles[0]);
			}

			// Call Gemini service
			console.log(`\n[App] Invoking Gemini service for action: ${geminiRequestType}...`);
			const result: GeminiEnhancementResult = await enhanceCodeWithGemini(geminiRequestType, codeToProcess);

			// Process and display the textual or error result
			if (result.type === 'text') {
				console.log(`\n--- Gemini ${geminiRequestType} Result ---`);
				console.log(result.content ?? 'Gemini returned empty text content.');
				console.log(`--- End ${geminiRequestType} Result ---\n`);
			} else if (result.type === 'error') {
				console.error(`\n[App] ❌ Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
				process.exitCode = 1; // Set exit code on error
			} else {
				// Should not happen if requesting Analyze/Explain, but handle defensively
				console.warn(`[App] ⚠️ Received unexpected result type '${result.type}' (expected 'text') for ${geminiRequestType} action.`);
				process.exitCode = 1; // Treat unexpected type as error
				if (result.content) {
					console.log("--- Unexpected Code Snippet (first 20 lines) ---");
					console.log(result.content.split('\n').slice(0, 20).join('\n') + (result.content.split('\n').length > 20 ? '\n...' : ''));
					console.log("----------------------------------------------");
				}
			}

		} else {
			// Catch any action that isn't modification and doesn't use Gemini (shouldn't happen with current types)
			console.error(`[App] Internal Error: Action "${action}" was not handled by any processing flow.`);
			process.exit(1);
		}

	} catch (error) { // Catch errors from initial setup etc.
		console.error("\n❌ Error during main execution:", error instanceof Error ? error.message : error);
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