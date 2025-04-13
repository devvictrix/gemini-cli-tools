// File: src/app.ts

import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit'; // Import p-limit for concurrency control
import { enhanceCodeWithGemini, GeminiEnhancementResult } from './gemini/gemini.service.js';
import { EnhancementType, isValidEnhancementType } from './shared/types/enhancement.type.js';
import { getConsolidatedSources, getTargetFiles } from './filesystem/filesystem.service.js';
import { EXCLUDE_FILENAMES } from './filesystem/filesystem.config.js';
// Import the new local inference service
import { inferTypesFromData } from './inference/local-type-inference.service.js';

// --- Interfaces --- (Keep existing interfaces: ParsedArgs, FileProcessingResult)
interface ParsedArgs {
	action: EnhancementType;
	targetPath: string;
	prefix?: string;
	// Optional: Add interface name for InferFromData
	interfaceName?: string;
}
interface FileProcessingResult {
	filePath: string;
	status: 'updated' | 'unchanged' | 'error' | 'processed'; // Add 'processed' for non-modification
	message?: string;
}


// --- Function Definitions ---

/**
 * Parses command line arguments.
 * Expects: <ActionType> <TargetPath> [PrefixOrOption] [OptionValue]
 * Example for InferFromData: InferFromData data.json MyInterface
 * @returns A ParsedArgs object containing the validated arguments. Exits if validation fails.
 */
function parseArguments(): ParsedArgs {
	const args = process.argv.slice(2);
	const actionString = args[0];
	const targetPath = args[1];
	let prefix: string | undefined = undefined;
	let interfaceName: string | undefined = undefined;

	// Basic validation
	if (!actionString) {
		console.error("\n❌ Error: Action type is required.");
		printUsage();
		process.exit(1);
	}
	if (!isValidEnhancementType(actionString)) {
		console.error(`\n❌ Error: Invalid action type "${actionString}".`);
		console.log("Available Action Types:", Object.values(EnhancementType).join(', '));
		process.exit(1);
	}
	const action = actionString as EnhancementType;

	if (!targetPath) {
		console.error("\n❌ Error: Target path (file or directory) is required.");
		printUsage();
		process.exit(1);
	}

	// Handle optional arguments differently based on action
	if (action === EnhancementType.InferFromData) {
		// InferFromData expects <Action> <TargetPath> <InterfaceName>
		interfaceName = args[2];
		if (!interfaceName) {
			console.error(`\n❌ Error: Interface name is required for the '${EnhancementType.InferFromData}' action.`);
			printUsage();
			process.exit(1);
		}
		// Validate interface name (basic)
		if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(interfaceName)) {
			console.error(`\n❌ Error: Invalid interface name "${interfaceName}". Must be a valid JavaScript/TypeScript identifier.`);
			process.exit(1);
		}

	} else {
		// Other actions expect <Action> <TargetPath> [Prefix]
		prefix = args[2]; // Can be undefined, which is fine
	}


	// Validate Target Path Access
	try {
		fs.accessSync(targetPath);
	} catch (e) {
		console.error(`\n❌ Error: Cannot access target path: ${targetPath}. Please ensure it exists.`);
		process.exit(1);
	}

	// Validate InferFromData target is a file
	if (action === EnhancementType.InferFromData) {
		try {
			const stats = fs.statSync(targetPath);
			if (!stats.isFile()) {
				console.error(`\n❌ Error: Target path for '${EnhancementType.InferFromData}' must be a file (e.g., JSON).`);
				process.exit(1);
			}
		} catch (e) {
			// accessSync already checked existence, this covers stat errors
			console.error(`\n❌ Error: Could not get file stats for target path: ${targetPath}.`);
			process.exit(1);
		}
	}


	return { action, targetPath, prefix, interfaceName };
}

/** Prints usage instructions */
function printUsage() {
	console.log("\nUsage:");
	console.log("  npm start <ActionType> <TargetPath> [Options...]");
	console.log("\nExamples:");
	console.log("  npm start AddComments src/myFile.ts");
	console.log("  npm start Analyze ./src");
	console.log("  npm start SuggestImprovements ./src/utils");
	console.log("  npm start GenerateDocs ./src/services/userService.ts");
	console.log("  npm start AddPathComment ./src");
	console.log("  npm start Consolidate ./dist"); // Example only, be careful with dist
	console.log("  npm start InferFromData ./data/users.json UserProfile"); // New Example
	console.log("\nAvailable Action Types:", Object.values(EnhancementType).join(', '));
}

/**
 * Reads the content of a single code file synchronously.
 * @param filePath The absolute path to the code file.
 * @returns The code content as a string.
 * @throws An error if the file cannot be read or is not a file.
 */
function readSingleCodeFile(filePath: string): string {
	const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
	// console.log(`[App] Reading file: ${relativeFilePath}`); // Reduce noise maybe?
	try {
		const stats = fs.statSync(filePath);
		if (!stats.isFile()) {
			throw new Error(`Target path is not a file: ${filePath}`);
		}
		const code = fs.readFileSync(filePath, 'utf8');
		return code;
	} catch (readError) {
		console.error(`[App] ❌ Error reading file ${relativeFilePath}: ${readError instanceof Error ? readError.message : readError}`);
		throw readError; // Re-throw to be caught by the calling function
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

/**
 * Writes content to a specified output file.
 * @param outputFilePath The absolute path for the output file.
 * @param content The content string to write.
 * @returns True if writing was successful, false otherwise.
 */
function writeOutputFile(outputFilePath: string, content: string): boolean {
	const relativeOutputPath = path.relative(process.cwd(), outputFilePath).split(path.sep).join('/');
	console.log(`[App] Writing output to ${relativeOutputPath}...`);
	try {
		// Ensure directory exists (optional, but good practice)
		const outputDir = path.dirname(outputFilePath);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
			console.log(`[App] Created directory: ${path.relative(process.cwd(), outputDir)}`);
		}
		fs.writeFileSync(outputFilePath, content, 'utf8');
		console.log(`[App] ✅ Successfully wrote ${content.length} characters to ${relativeOutputPath}.`);
		return true;
	} catch (writeError) {
		console.error(`[App] ❌ Error writing output file ${relativeOutputPath}: ${writeError instanceof Error ? writeError.message : writeError}`);
		return false;
	}
}


// --- Main Execution Logic ---
async function main() {
	const { action, targetPath, prefix, interfaceName } = parseArguments(); // Get interfaceName
	console.log(`\nSelected action: ${action} on target: ${targetPath}${prefix ? ` with prefix: ${prefix}` : ''}${interfaceName ? ` (Interface: ${interfaceName})` : ''}`);

	const isModificationAction = [
		EnhancementType.AddComments,
		EnhancementType.AddPathComment,
		// Add future modification actions (Refactor, GenerateTests) here
	].includes(action);

	const usesGeminiApi = [
		EnhancementType.AddComments, // Note: Also a modification action
		EnhancementType.Analyze,
		EnhancementType.Explain,
		EnhancementType.SuggestImprovements, // New
		EnhancementType.GenerateDocs,      // New
	].includes(action);

	// Actions that perform local processing without Gemini or typical source modification
	const isLocalProcessingAction = [
		EnhancementType.Consolidate,
		EnhancementType.InferFromData, // New
		EnhancementType.AddPathComment, // Note: Also a modification action
	].includes(action);


	try {
		const stats = fs.statSync(targetPath);
		let targetFiles: string[] = [];

		// --- Identify target files (adjust for InferFromData) ---
		if (action === EnhancementType.InferFromData) {
			// Already validated that targetPath is a file in parseArguments
			targetFiles.push(path.resolve(targetPath));
			console.log(`[App] Target for '${action}' is the single file: ${targetPath}`);
		} else if (stats.isDirectory()) {
			console.log(`[App] Target is a directory. Finding relevant files...`);
			targetFiles = await getTargetFiles(targetPath, prefix); // Use filesystem service
			if (targetFiles.length === 0) {
				console.log("\n[App] No relevant files found matching criteria or remaining after exclusions. Exiting.");
				return;
			}
			console.log(`[App] Found ${targetFiles.length} files to process for action '${action}'.`);
		} else if (stats.isFile()) {
			const filename = path.basename(targetPath);
			if (EXCLUDE_FILENAMES.has(filename)) {
				console.log(`[App] Target file ${filename} is excluded by configuration.`);
				return;
			}
			console.log(`[App] Target is a single file for action '${action}'.`);
			targetFiles.push(path.resolve(targetPath));
		} else {
			// Should not happen due to parseArguments check, but good safety net
			console.error(`\n❌ Error: Target path ${targetPath} is neither a file nor a directory.`);
			process.exit(1);
		}

		// --- Process based on action type ---

		if (isModificationAction && action !== EnhancementType.AddPathComment) {
			// --- PARALLEL MODIFICATION FLOW (AddComments) ---
			// NOTE: AddPathComment is handled separately below due to simpler logic
			const concurrencyLimit = 5; // Reduce concurrency slightly for API calls
			const limit = pLimit(concurrencyLimit);
			console.log(`\n[App] Starting PARALLEL modification action '${action}' on ${targetFiles.length} file(s) with concurrency ${concurrencyLimit}...`);

			let fileProcessor: (absoluteFilePath: string) => Promise<FileProcessingResult>;

			// --- Processor for AddComments (Uses Gemini) ---
			if (action === EnhancementType.AddComments) {
				fileProcessor = async (absoluteFilePath): Promise<FileProcessingResult> => {
					const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
					// console.log(` -> Processing (Gemini AddComments): ${relativeFilePath}`);
					try {
						const originalCode = readSingleCodeFile(absoluteFilePath);
						const result: GeminiEnhancementResult = await enhanceCodeWithGemini(action, originalCode);

						if (result.type === 'code' && result.content !== null) { // Check content not null
							if (originalCode.trim() !== result.content.trim()) {
								// console.log(`    ✨ Changes detected for ${relativeFilePath}.`);
								const updated = updateCodeFile(absoluteFilePath, result.content);
								return { filePath: relativeFilePath, status: updated ? 'updated' : 'error', message: updated ? undefined : 'File write failed' };
							} else {
								// console.log(`    ✅ No changes needed for ${relativeFilePath}.`);
								return { filePath: relativeFilePath, status: 'unchanged' };
							}
						} else if (result.type === 'error') {
							console.error(`    ❌ Gemini failed for ${relativeFilePath}: ${result.content}`);
							return { filePath: relativeFilePath, status: 'error', message: `Gemini Error: ${result.content}` };
						} else {
							// This case should ideally not happen if Gemini service returns code or error correctly
							console.warn(`    ⚠️ Received unexpected result type '${result.type}' or null content (expected 'code') for ${relativeFilePath}.`);
							return { filePath: relativeFilePath, status: 'error', message: `Unexpected result type/content: ${result.type}` };
						}
					} catch (fileProcessingError) {
						console.error(`    ❌ Error during Gemini processing for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
						return { filePath: relativeFilePath, status: 'error', message: `File/API Processing Error: ${fileProcessingError instanceof Error ? fileProcessingError.message : "Unknown error"}` };
					}
				};
			} else {
				// Placeholder for future parallel modification actions (e.g., Refactor)
				console.error(`[App] Internal Error: Unhandled parallel modification action type "${action}" in processor selection.`);
				fileProcessor = async (absoluteFilePath) => ({
					filePath: path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/'),
					status: 'error',
					message: `Unhandled parallel modification action: ${action}`
				});
			}

			// --- Run Parallel Tasks ---
			const tasks = targetFiles.map(filePath => limit(() => fileProcessor(filePath)));
			const results: FileProcessingResult[] = await Promise.all(tasks);

			// --- Aggregate and Print Summary ---
			let successCount = 0;
			let unchangedCount = 0;
			let errorCount = 0;
			results.forEach(res => {
				switch (res.status) {
					case 'updated': successCount++; break;
					case 'unchanged': unchangedCount++; break;
					case 'error': errorCount++; break; // Don't log message here, already logged by processor
				}
			});
			console.log("\n--- Parallel Modification Summary ---");
			console.log(`  Action:              ${action}`);
			console.log(`  Total Files Target:  ${targetFiles.length}`);
			console.log(`  Successfully Updated:  ${successCount}`);
			console.log(`  No Changes Needed:   ${unchangedCount}`);
			console.log(`  Errors Encountered:    ${errorCount}`);
			console.log("---------------------------------");
			if (errorCount > 0) process.exitCode = 1;


		} else if (usesGeminiApi && !isModificationAction) {
			// --- NON-MODIFICATION FLOW using GEMINI (Analyze, Explain, SuggestImprovements, GenerateDocs) ---
			let codeToProcess: string;
			const geminiRequestType = action;

			// Consolidate if directory, read single if file
			if (targetFiles.length > 1 || (targetFiles.length === 1 && fs.statSync(targetPath).isDirectory())) {
				console.log(`\n[App] Consolidating ${targetFiles.length} file(s) for Gemini action '${action}'...`);
				const consolidationRoot = targetPath; // Root is the initially provided directory path
				codeToProcess = await getConsolidatedSources(consolidationRoot, prefix);
			} else if (targetFiles.length === 1) { // Single file case
				console.log(`\n[App] Reading single file for Gemini action '${action}'...`);
				codeToProcess = readSingleCodeFile(targetFiles[0]);
			} else {
				console.error(`[App] Internal Error: No target files identified for Gemini action '${action}'.`);
				process.exit(1);
			}

			if (codeToProcess.trim() === '') {
				console.warn(`[App] Warning: Content to send to Gemini for action '${action}' is empty. Skipping API call.`);
				return; // Exit gracefully if nothing to process
			}


			// Call Gemini service
			console.log(`\n[App] Invoking Gemini service for action: ${geminiRequestType}...`);
			const result: GeminiEnhancementResult = await enhanceCodeWithGemini(geminiRequestType, codeToProcess);

			// Process and display the textual result
			if (result.type === 'text' && result.content !== null) {
				console.log(`\n--- Gemini ${geminiRequestType} Result ---`);
				console.log(result.content); // Print the text content directly
				console.log(`--- End ${geminiRequestType} Result ---\n`);
			} else if (result.type === 'error') {
				console.error(`\n[App] ❌ Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
				process.exitCode = 1;
			} else {
				// This might happen if Gemini returns code unexpectedly for an analysis action
				console.warn(`[App] ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text') for ${geminiRequestType} action.`);
				if (result.content) {
					console.log("--- Unexpected Content Received ---");
					console.log(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''));
					console.log("----------------------------------");
				}
				process.exitCode = 1; // Treat as error
			}

		} else if (isLocalProcessingAction) {
			// --- LOCAL PROCESSING FLOW (Consolidate, InferFromData, AddPathComment) ---
			console.log(`\n[App] Starting local action '${action}'...`);

			if (action === EnhancementType.Consolidate) {
				// --- CONSOLIDATE ---
				console.log(`[App] Consolidating ${targetFiles.length} file(s)...`);
				const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetPath);
				console.log(`[App] Consolidating from root: ${consolidationRoot} ${prefix ? `with prefix '${prefix}'` : ''}...`);
				const consolidatedContent = await getConsolidatedSources(consolidationRoot, prefix);
				const outputFileName = 'consolidated_output.txt'; // Consider making configurable
				const outputFilePath = path.resolve(process.cwd(), outputFileName);
				const success = writeOutputFile(outputFilePath, consolidatedContent);
				if (!success) process.exitCode = 1;
				else console.log(`\n➡️ You can now copy the content from: ${outputFileName}`);

			} else if (action === EnhancementType.InferFromData) {
				// --- INFER FROM DATA ---
				if (targetFiles.length !== 1 || !interfaceName) {
					console.error("[App] Internal Error: Incorrect state for InferFromData (expected 1 file and interfaceName).");
					process.exit(1);
				}
				const dataFilePath = targetFiles[0];
				const relativeDataFilePath = path.relative(process.cwd(), dataFilePath);
				console.log(`[App] Inferring types from data file: ${relativeDataFilePath}`);
				try {
					const fileContent = readSingleCodeFile(dataFilePath);
					let data: any;
					try {
						data = JSON.parse(fileContent); // Assume JSON for now
					} catch (parseError) {
						console.error(`[App] ❌ Error parsing JSON data from ${relativeDataFilePath}: ${parseError instanceof Error ? parseError.message : parseError}`);
						process.exit(1);
					}

					// Perform inference
					const inferredInterface = inferTypesFromData(interfaceName, data);

					// Output the result
					console.log(`\n--- Inferred Interface: ${interfaceName} ---`);
					console.log(inferredInterface);
					console.log(`--- End Interface ---`);

					// Optional: Write to a .d.ts file?
					// const outputInterfaceFileName = `${interfaceName}.d.ts`;
					// const outputInterfacePath = path.resolve(path.dirname(dataFilePath), outputInterfaceFileName);
					// writeOutputFile(outputInterfacePath, inferredInterface);

				} catch (inferenceError) {
					console.error(`[App] ❌ Error during type inference for ${relativeDataFilePath}: ${inferenceError instanceof Error ? inferenceError.message : inferenceError}`);
					process.exit(1);
				}
			} else if (action === EnhancementType.AddPathComment) {
				// --- ADD PATH COMMENT (Now handled here sequentially for simplicity) ---
				console.log(`\n[App] Starting SEQUENTIAL action '${action}' on ${targetFiles.length} file(s)...`);
				let updatedCount = 0;
				let unchangedCount = 0;
				let errorCount = 0;

				for (const absoluteFilePath of targetFiles) {
					const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
					// console.log(` -> Processing (AddPath): ${relativeFilePath}`); // Can be noisy
					try {
						const pathComment = `// File: ${relativeFilePath}`;
						const originalCode = readSingleCodeFile(absoluteFilePath);
						const lines = originalCode.split(/\r?\n/);

						const pathCommentRegex = /^\s*\/\/\s*File:\s*[\w\-\/\\.]+\.(ts|js|json|env)\s*$/; // Updated regex
						let existingCommentIndex = -1;
						let firstCodeLineIndex = -1;
						let foundOurComment = false;
						let foundDifferentComment = false;

						// Find first line with code/non-path comment and check for existing path comments
						for (let i = 0; i < lines.length; i++) {
							const lineTrimmed = lines[i].trim();
							if (lineTrimmed === '') continue; // Skip blank lines

							const isPathComment = pathCommentRegex.test(lineTrimmed);

							if (isPathComment) {
								if (lineTrimmed === pathComment) {
									foundOurComment = true;
									existingCommentIndex = i; // Record index if it's our exact comment
								} else {
									foundDifferentComment = true;
								}
								// Continue checking in case our comment is later
							} else {
								// This is the first line that isn't blank or *any* path comment
								if (firstCodeLineIndex === -1) {
									firstCodeLineIndex = i;
								}
								// If we found our comment *before* this line, break early? No, might be multiple comments.
								// Let's just record the first code line.
							}
						}
						if (firstCodeLineIndex === -1) firstCodeLineIndex = lines.length; // Handle files with only comments/blanks


						// Determine if update is needed
						let needsUpdate = true;
						if (foundOurComment && existingCommentIndex === 0) {
							// Our comment is the very first line
							// Check if the next line is blank (or end of file)
							if (lines.length === 1 || (lines.length > 1 && lines[1].trim() === '')) {
								// console.log(`    ✅ Path comment exists correctly at line 0 in ${relativeFilePath}.`);
								needsUpdate = false;
							} else {
								// console.log(`    ⚠️ Path comment at line 0, but no blank line after in ${relativeFilePath}. Will reformat.`);
							}
						} else if (foundOurComment) {
							// console.log(`    ⚠️ Path comment exists but not at line 0 in ${relativeFilePath}. Will move and reformat.`);
						} else if (foundDifferentComment) {
							// console.log(`    ⚠️ Different path comment found in ${relativeFilePath}. Will replace/add ours.`);
						} else {
							// console.log(`    ➕ Path comment missing in ${relativeFilePath}. Will add.`);
						}


						if (!needsUpdate) {
							unchangedCount++;
						} else {
							// --- Modification logic: Remove all top path comments/blanks, add new ---
							let tempLines = originalCode.split(/\r?\n/);
							let firstRealCodeIdx = 0;
							while (firstRealCodeIdx < tempLines.length) {
								const lineTrim = tempLines[firstRealCodeIdx].trim();
								if (lineTrim === '' || pathCommentRegex.test(lineTrim)) {
									firstRealCodeIdx++;
								} else {
									break;
								}
							}

							const codeWithoutHeader = tempLines.slice(firstRealCodeIdx).join('\n');
							const newCode = `${pathComment}\n\n${codeWithoutHeader}`; // Ensure blank line

							// console.log(`    🔧 Adding/Updating path comment for ${relativeFilePath}.`);
							const updated = updateCodeFile(absoluteFilePath, newCode);
							if (updated) updatedCount++; else errorCount++;
						}

					} catch (fileProcessingError) {
						console.error(`    ❌ Error during AddPathComment for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
						errorCount++;
					}
				} // End loop over files

				// --- AddPathComment Summary ---
				console.log("\n--- Sequential Action Summary ---");
				console.log(`  Action:              ${action}`);
				console.log(`  Total Files Target:  ${targetFiles.length}`);
				console.log(`  Successfully Updated:  ${updatedCount}`);
				console.log(`  No Changes Needed:   ${unchangedCount}`);
				console.log(`  Errors Encountered:    ${errorCount}`);
				console.log("---------------------------------");
				if (errorCount > 0) process.exitCode = 1;
			}

		} else {
			// Catch-all for unhandled actions
			console.error(`[App] Internal Error: Action "${action}" was not handled by any processing flow.`);
			process.exit(1);
		}

	} catch (error) { // Catch errors from initial setup, file access, etc.
		console.error("\n❌ An error occurred during script execution:");
		if (error instanceof Error) {
			console.error(`   Message: ${error.message}`);
			// console.error(error.stack); // Uncomment for stack trace
		} else {
			console.error("   Unknown error object:", error);
		}
		process.exit(1);
	}

	console.log("\nScript execution finished.");
} // end main

// --- Global Error Catching & Script Execution ---
main().catch(error => {
	console.error("\n🚨 An unexpected critical error occurred outside the main try/catch block:");
	if (error instanceof Error) {
		console.error(`   Message: ${error.message}`);
		console.error(error.stack); // Log stack for critical failures
	} else {
		console.error("   An unknown error object was thrown:", error);
	}
	process.exit(1);
});