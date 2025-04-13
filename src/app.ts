// File: src/app.ts
// Description: Main application entry point for the Gemini POC tool. Handles command-line arguments,
// orchestrates file processing, interacts with the Gemini service, and manages local operations.

import * as fs from 'fs'; // Keep fs for statSync and potentially other direct uses if needed
import * as path from 'path';
import pLimit from 'p-limit'; // Library for limiting concurrency in parallel operations
import yargs, { Argv } from 'yargs'; // Command-line argument parser
import { hideBin } from 'yargs/helpers'; // Helper for parsing arguments correctly
import { enhanceCodeWithGemini, GeminiEnhancementResult } from './gemini/gemini.service.js'; // Gemini interaction service
import { EnhancementType } from './shared/types/enhancement.type.js'; // Enum defining possible actions
// Import shared utilities and constants from their new locations
import { getConsolidatedSources, getTargetFiles } from './shared/utils/filesystem.utils.js'; // High-level file finding/consolidation
import { EXCLUDE_FILENAMES } from './shared/constants/filesystem.constants.js'; // Filesystem exclusion constants
import { inferTypesFromData } from './shared/helpers/type-inference.helper.js'; // Local type inference logic
import { readSingleFile, updateFileContent, writeOutputFile } from './shared/helpers/file-io.helper.js';

// --- Interfaces ---

/**
 * Defines the expected structure of parsed command-line arguments.
 */
interface AppArguments {
	command: EnhancementType; // The specific action requested by the user
	targetPath: string;      // The file or directory to operate on
	prefix?: string;         // Optional filename prefix filter for directory processing
	interfaceName?: string;  // Optional name for the interface when using InferFromData
	[key: string]: unknown;  // Allows for other properties from yargs
	_: (string | number)[];  // Positional arguments not mapped to specific options
	$0: string;              // The script name or path
}

/**
 * Defines the structure for reporting the result of processing a single file,
 * especially in parallel or sequential operations.
 */
interface FileProcessingResult {
	filePath: string;                                     // Relative path of the processed file
	status: 'updated' | 'unchanged' | 'error' | 'processed'; // Outcome of the processing
	message?: string;                                     // Optional message, typically used for errors
}


// --- Utility Functions ---
// NOTE: readSingleFile, updateFileContent, writeOutputFile were moved to src/shared/utils/file-io.utils.ts
// and are now imported.


// --- Main Execution Logic ---

/**
 * The core application logic. Parses arguments, identifies target files,
 * and executes the requested action (local or via Gemini API).
 * @param argv The parsed arguments object from yargs.
 */
async function runMainLogic(argv: AppArguments) {
	const { command: action, targetPath, prefix, interfaceName } = argv;
	const actionDetails = `${prefix ? ` with prefix: ${prefix}` : ''}${interfaceName ? ` (Interface: ${interfaceName})` : ''}`;
	console.log(`\n[App] Selected action: ${action} on target: ${targetPath}${actionDetails}`);

	// --- Validate Target Path ---
	let stats: fs.Stats;
	try {
		stats = fs.statSync(targetPath); // Check if the target path exists and get its stats
	} catch (e) {
		console.error(`\n[App] ❌ Error: Cannot access target path: ${targetPath}. Please ensure it exists.`);
		process.exit(1); // Exit if target path is inaccessible
	}
	// Specific check for InferFromData action, which requires a file
	if (action === EnhancementType.InferFromData && !stats.isFile()) {
		console.error(`\n[App] ❌ Error: Target path for '${EnhancementType.InferFromData}' must be a file (e.g., JSON).`);
		process.exit(1);
	}

	// --- Classify Action Type ---
	const isModificationAction = [
		EnhancementType.AddComments,    // Modifies files by adding comments
		EnhancementType.AddPathComment, // Modifies files by adding a path comment header
	].includes(action);

	const usesGeminiApi = [
		EnhancementType.AddComments,        // Uses Gemini to generate comments
		EnhancementType.Analyze,            // Uses Gemini for analysis
		EnhancementType.Explain,            // Uses Gemini for explanation
		EnhancementType.SuggestImprovements,// Uses Gemini for suggestions
		EnhancementType.GenerateDocs,       // Uses Gemini to generate documentation
	].includes(action);

	const isLocalProcessingAction = [
		EnhancementType.Consolidate,    // Local file consolidation
		EnhancementType.InferFromData,  // Local type inference from data
		EnhancementType.AddPathComment, // Local file modification (adding header)
	].includes(action);


	try {
		let targetFiles: string[] = []; // Array to hold absolute paths of files to process

		// --- Identify Target Files ---
		// Determine which files to process based on the target path (file/directory) and action
		if (action === EnhancementType.InferFromData) {
			// InferFromData always targets a single file
			targetFiles.push(path.resolve(targetPath));
			console.log(`[App] Target for '${action}' is the single file: ${targetPath}`);
		} else if (stats.isDirectory()) {
			// If target is a directory, find relevant files within it
			console.log(`[App] Target is a directory. Finding relevant files...`);
			targetFiles = await getTargetFiles(targetPath, prefix); // Use utility from shared/utils
			if (targetFiles.length === 0) {
				console.log("\n[App] No relevant files found matching criteria. Exiting.");
				return; // Nothing to do
			}
			console.log(`[App] Found ${targetFiles.length} files to process for action '${action}'.`);
		} else if (stats.isFile()) {
			// If target is a single file, check if it's excluded
			const filename = path.basename(targetPath);
			if (EXCLUDE_FILENAMES.has(filename)) { // Use constant from shared/constants
				console.log(`[App] Target file ${filename} is excluded by configuration.`);
				return; // Skip excluded files
			}
			console.log(`[App] Target is a single file for action '${action}'.`);
			targetFiles.push(path.resolve(targetPath));
		}

		// --- Process Based on Action Type ---

		// A) Actions that modify files and might use Gemini (currently only AddComments)
		if (isModificationAction && action === EnhancementType.AddComments) {
			// --- PARALLEL MODIFICATION FLOW (AddComments) ---
			const concurrencyLimit = 5; // Limit simultaneous API calls/file writes
			const limit = pLimit(concurrencyLimit);
			console.log(`\n[App] Starting PARALLEL modification action '${action}' on ${targetFiles.length} file(s) with concurrency ${concurrencyLimit}...`);

			const fileProcessor = async (absoluteFilePath: string): Promise<FileProcessingResult> => {
				const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
				try {
					const originalCode = readSingleFile(absoluteFilePath); // Use imported utility
					const result: GeminiEnhancementResult = await enhanceCodeWithGemini(action, originalCode);

					if (result.type === 'code' && result.content !== null) {
						if (originalCode.trim() !== result.content.trim()) {
							// Only write if content has changed
							const updated = updateFileContent(absoluteFilePath, result.content); // Use imported utility
							return { filePath: relativeFilePath, status: updated ? 'updated' : 'error', message: updated ? undefined : 'File write failed' };
						} else {
							console.log(`    [App] No changes needed for ${relativeFilePath}.`);
							return { filePath: relativeFilePath, status: 'unchanged' };
						}
					} else if (result.type === 'error') {
						console.error(`    [App] ❌ Gemini failed for ${relativeFilePath}: ${result.content}`);
						return { filePath: relativeFilePath, status: 'error', message: `Gemini Error: ${result.content}` };
					} else {
						console.warn(`    [App] ⚠️ Received unexpected result type '${result.type}' or null content (expected 'code') for ${relativeFilePath}.`);
						return { filePath: relativeFilePath, status: 'error', message: `Unexpected result type/content: ${result.type}` };
					}
				} catch (fileProcessingError) {
					console.error(`    [App] ❌ Error during Gemini processing for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
					return { filePath: relativeFilePath, status: 'error', message: `File/API Processing Error: ${fileProcessingError instanceof Error ? fileProcessingError.message : "Unknown error"}` };
				}
			};

			// Run processing tasks in parallel with the defined limit
			const tasks = targetFiles.map(filePath => limit(() => fileProcessor(filePath)));
			const results: FileProcessingResult[] = await Promise.all(tasks);

			// --- Summarize Parallel Results ---
			let successCount = 0;
			let unchangedCount = 0;
			let errorCount = 0;
			results.forEach(res => {
				switch (res.status) {
					case 'updated': successCount++; break;
					case 'unchanged': unchangedCount++; break;
					case 'error': errorCount++; break;
				}
			});
			console.log("\n--- Parallel Modification Summary ---");
			console.log(`  Action:              ${action}`);
			console.log(`  Total Files Targeted:  ${targetFiles.length}`);
			console.log(`  Successfully Updated:  ${successCount}`);
			console.log(`  No Changes Needed:   ${unchangedCount}`);
			console.log(`  Errors Encountered:    ${errorCount}`);
			console.log("-----------------------------------");
			if (errorCount > 0) process.exitCode = 1; // Indicate failure if errors occurred


			// B) Actions that use Gemini but DO NOT modify files (Analyze, Explain, Suggest, GenerateDocs)
		} else if (usesGeminiApi && !isModificationAction) {
			// --- NON-MODIFICATION FLOW using GEMINI ---
			let codeToProcess: string;
			const geminiRequestType = action; // Keep track of the original action requested

			// Consolidate code if multiple files are targeted or if the target is a directory
			if (stats.isDirectory() || targetFiles.length > 1) {
				console.log(`\n[App] Consolidating ${targetFiles.length} file(s) for Gemini action '${action}'...`);
				// Determine the root for consolidation (target path if directory, parent dir if single file target led to multiple matches)
				const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetFiles[0]);
				codeToProcess = await getConsolidatedSources(consolidationRoot, prefix); // Use imported utility
			} else if (targetFiles.length === 1) {
				// Read single file if only one target
				console.log(`\n[App] Reading single file for Gemini action '${action}'...`);
				codeToProcess = readSingleFile(targetFiles[0]); // Use imported utility
			} else {
				// Should not happen due to earlier checks, but provides a safeguard
				console.error(`[App] Internal Error: No target files identified for Gemini action '${action}'.`);
				process.exitCode = 1;
				return;
			}

			// Avoid sending empty content to the API
			if (codeToProcess.trim() === '') {
				console.warn(`[App] Warning: Content to send to Gemini for action '${action}' is empty. Skipping API call.`);
				return;
			}

			console.log(`\n[App] Invoking Gemini service for action: ${geminiRequestType}...`);
			const result: GeminiEnhancementResult = await enhanceCodeWithGemini(geminiRequestType, codeToProcess);

			// --- Handle Gemini Result ---
			if (result.type === 'text' && result.content !== null) {
				// Special handling for GenerateDocs: write to README.md
				if (geminiRequestType === EnhancementType.GenerateDocs) {
					const outputFileName = 'README.md'; // Define output file name
					const outputFilePath = path.resolve(process.cwd(), outputFileName); // Absolute path
					console.log(`\n[App] Attempting to write generated documentation to ${outputFileName}...`);
					const success = writeOutputFile(outputFilePath, result.content); // Use imported utility
					if (!success) {
						console.error(`[App] ❌ Failed to write documentation file.`);
						process.exitCode = 1; // Indicate failure
					} else {
						console.log(`\n[App] ✅ Generated documentation saved to: ${outputFileName}`);
					}
				} else {
					// For other text-based actions (Analyze, Explain, Suggest), print to console
					console.log(`\n--- Gemini ${geminiRequestType} Result ---`);
					console.log(result.content);
					console.log(`--- End ${geminiRequestType} Result ---\n`);
				}
			} else if (result.type === 'error') {
				// Handle errors reported by the Gemini service
				console.error(`\n[App] ❌ Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
				process.exitCode = 1;
			} else {
				// Handle unexpected results (e.g., got 'code' when 'text' was expected)
				console.warn(`[App] ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text') for ${geminiRequestType} action.`);
				if (result.content) {
					console.log("--- Unexpected Content Received ---");
					console.log(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : '')); // Log preview
					console.log("----------------------------------");
				}
				process.exitCode = 1; // Indicate potential issue
			}

			// C) Actions processed locally WITHOUT Gemini (Consolidate, InferFromData, AddPathComment)
		} else if (isLocalProcessingAction) {
			// --- LOCAL PROCESSING FLOW ---
			console.log(`\n[App] Starting local action '${action}'...`);

			// C.1) Consolidate Files
			if (action === EnhancementType.Consolidate) {
				console.log(`[App] Consolidating ${targetFiles.length} file(s)...`);
				// Determine the root for consolidation
				const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetPath); // Use original targetPath for root logic
				console.log(`[App] Consolidating from root: ${consolidationRoot} ${prefix ? `with prefix '${prefix}'` : ''}...`);
				const consolidatedContent = await getConsolidatedSources(consolidationRoot, prefix); // Use imported utility
				const outputFileName = 'consolidated_output.txt'; // Define output file name
				const outputFilePath = path.resolve(process.cwd(), outputFileName); // Absolute path
				const success = writeOutputFile(outputFilePath, consolidatedContent); // Use imported utility
				if (!success) process.exitCode = 1;
				else console.log(`\n[App] ✅ You can now find consolidated content in: ${outputFileName}`);

				// C.2) Infer Types from Data File
			} else if (action === EnhancementType.InferFromData) {
				if (!interfaceName) { // Should be caught by yargs demandOption, but good practice
					console.error("[App] Internal Error: Interface name missing for InferFromData.");
					process.exit(1);
				}
				const dataFilePath = targetFiles[0]; // InferFromData targets only one file
				const relativeDataFilePath = path.relative(process.cwd(), dataFilePath).split(path.sep).join('/');
				console.log(`[App] Inferring types from data file: ${relativeDataFilePath}`);
				try {
					const fileContent = readSingleFile(dataFilePath); // Use imported utility
					let data: any;
					try {
						data = JSON.parse(fileContent); // Parse the file content as JSON
					} catch (parseError) {
						console.error(`[App] ❌ Error parsing JSON data from ${relativeDataFilePath}: ${parseError instanceof Error ? parseError.message : parseError}`);
						process.exit(1);
					}
					const inferredInterface = inferTypesFromData(interfaceName, data); // Perform inference
					console.log(`\n--- Inferred Interface: ${interfaceName} ---`);
					console.log(inferredInterface); // Print the result
					console.log(`--- End Interface ---`);
				} catch (inferenceError) {
					console.error(`[App] ❌ Error during type inference for ${relativeDataFilePath}: ${inferenceError instanceof Error ? inferenceError.message : inferenceError}`);
					process.exit(1);
				}

				// C.3) Add Path Comment Header (Local Modification)
			} else if (action === EnhancementType.AddPathComment) {
				console.log(`\n[App] Starting SEQUENTIAL action '${action}' on ${targetFiles.length} file(s)...`);
				let updatedCount = 0;
				let unchangedCount = 0;
				let errorCount = 0;

				// Regex to detect existing "File: ..." comments, capturing path and extension
				const pathCommentRegex = /^\s*\/\/\s*File:\s*(.+?\.(?:ts|js|json|env))\s*$/;

				// Process files one by one sequentially
				for (const absoluteFilePath of targetFiles) {
					const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
					try {
						const pathComment = `// File: ${relativeFilePath}`; // The desired comment header
						const originalCode = readSingleFile(absoluteFilePath); // Use imported utility
						const lines = originalCode.split(/\r?\n/); // Split into lines

						let firstRealCodeIdx = 0;
						let foundOurCommentAtTop = false;

						// Find the index of the first line that isn't blank or a path comment
						while (firstRealCodeIdx < lines.length) {
							const lineTrim = lines[firstRealCodeIdx].trim();
							if (lineTrim === '') { // Skip blank lines
								firstRealCodeIdx++;
							} else if (pathCommentRegex.test(lineTrim)) { // Check if it's any path comment
								if (lineTrim === pathComment && firstRealCodeIdx === 0) {
									// Check if it's *our* comment and at the very top
									foundOurCommentAtTop = true;
								}
								firstRealCodeIdx++; // Skip any path comment line
							} else {
								break; // Found the first non-blank, non-path-comment line
							}
						}

						// Determine if an update is needed
						// Update if:
						// 1. Our comment wasn't found at the top.
						// 2. Our comment was found at the top, BUT there's no blank line immediately after it (and it's not the only line).
						let needsUpdate = !foundOurCommentAtTop ||
							(foundOurCommentAtTop && lines.length > 1 && lines[1].trim() !== '');


						if (!needsUpdate) {
							unchangedCount++;
							console.log(`    [App] ✅ No update needed for ${relativeFilePath}`);
						} else {
							console.log(`    [App] 🔄 Updating header for ${relativeFilePath}...`);
							// Reconstruct the code: Our comment, blank line, then code starting from firstRealCodeIdx
							const codeWithoutHeader = lines.slice(firstRealCodeIdx).join('\n');
							const newCode = `${pathComment}\n\n${codeWithoutHeader}`;

							const updated = updateFileContent(absoluteFilePath, newCode); // Use imported utility
							if (updated) updatedCount++; else errorCount++;
						}
					} catch (fileProcessingError) {
						console.error(`    [App] ❌ Error during AddPathComment for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
						errorCount++;
					}
				} // End for loop (sequential processing)

				// --- Summarize Sequential Results ---
				console.log("\n--- Sequential Action Summary ---");
				console.log(`  Action:              ${action}`);
				console.log(`  Total Files Targeted:  ${targetFiles.length}`);
				console.log(`  Successfully Updated:  ${updatedCount}`);
				console.log(`  No Changes Needed:   ${unchangedCount}`);
				console.log(`  Errors Encountered:    ${errorCount}`);
				console.log("---------------------------------");
				if (errorCount > 0) process.exitCode = 1; // Indicate failure if errors occurred
			}
		} else {
			// Fallback for unhandled action types (should not happen with current structure)
			console.error(`[App] Internal Error: Action "${action}" was not handled by any processing flow.`);
			process.exit(1);
		}

	} catch (error) {
		// Catch-all for unexpected errors during the main logic execution
		console.error("\n[App] ❌ An unexpected error occurred during script execution:");
		if (error instanceof Error) {
			console.error(`   Message: ${error.message}`);
			// console.error(error.stack); // Uncomment for full stack trace during debugging
		} else {
			console.error("   Unknown error object:", error);
		}
		process.exit(1); // Exit with failure code
	}

	console.log("\n[App] Script execution finished.");
} // End runMainLogic

// --- Argument Parsing and Execution Setup ---

/**
 * Sets up common options (targetPath, prefix) for yargs commands.
 * @param yargsInstance The yargs instance to configure.
 * @returns The configured yargs instance.
 */
const setupDefaultCommand = (yargsInstance: Argv<{}>): Argv<{ targetPath: string; prefix: string | undefined }> => {
	return yargsInstance
		.positional('targetPath', {
			describe: 'Target file or directory path',
			type: 'string',
			demandOption: true, // targetPath is always required
		})
		.option('prefix', {
			alias: 'p',
			type: 'string',
			description: 'Optional filename prefix filter for directory processing',
			demandOption: false, // prefix is optional
		});
};

// Configure yargs commands for each EnhancementType
yargs(hideBin(process.argv))
	.command( // AddComments
		`${EnhancementType.AddComments} <targetPath>`,
		'Add AI-generated comments to files.',
		setupDefaultCommand, // Use common options setup
		(argv) => runMainLogic({ ...argv, command: EnhancementType.AddComments } as AppArguments) // Run main logic with command type
	)
	.command( // Analyze
		`${EnhancementType.Analyze} <targetPath>`,
		'Analyze code structure and quality.',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.Analyze } as AppArguments)
	)
	.command( // Explain
		`${EnhancementType.Explain} <targetPath>`,
		'Explain what the code does.',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.Explain } as AppArguments)
	)
	.command( // AddPathComment
		`${EnhancementType.AddPathComment} <targetPath>`,
		'Add "// File: <relativePath>" comment header to files.',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.AddPathComment } as AppArguments)
	)
	.command( // Consolidate
		`${EnhancementType.Consolidate} <targetPath>`,
		'Consolidate code into a single output file (consolidated_output.txt).',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.Consolidate } as AppArguments)
	)
	.command( // SuggestImprovements
		`${EnhancementType.SuggestImprovements} <targetPath>`,
		'Suggest improvements for the code.',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.SuggestImprovements } as AppArguments)
	)
	.command( // GenerateDocs
		`${EnhancementType.GenerateDocs} <targetPath>`,
		'Generate Markdown documentation (saves to README.md).',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.GenerateDocs } as AppArguments)
	)
	.command( // InferFromData
		`${EnhancementType.InferFromData} <targetPath>`,
		'Infer TypeScript interface from a JSON data file.',
		(yargsInstance) => { // Custom setup for this command
			return yargsInstance
				.positional('targetPath', { // Requires a file path
					describe: 'Path to the JSON data file',
					type: 'string',
					demandOption: true,
				})
				.option('interfaceName', { // Requires an interface name
					alias: 'i',
					type: 'string',
					description: 'Name for the generated TypeScript interface',
					demandOption: true, // Interface name is required for this command
				});
		},
		(argv) => runMainLogic({ ...argv, command: EnhancementType.InferFromData } as AppArguments) // Run main logic
	)
	.demandCommand(1, 'Please specify a valid command (action).') // Require at least one command
	.strict() // Report errors for unknown options/commands
	.help() // Enable --help option
	.alias('h', 'help') // Alias -h for help
	.wrap(null) // Adjust terminal width automatically
	.fail((msg, err, yargs) => { // Custom failure handler
		if (err) {
			// Handle unexpected parsing errors
			console.error("\n[App] 🚨 An unexpected error occurred during argument parsing:");
			console.error(err);
			process.exit(1);
		}
		// Handle validation errors (missing command, wrong options, etc.)
		console.error(`\n[App] ❌ Error: ${msg}\n`);
		yargs.showHelp(); // Show help message on failure
		process.exit(1);
	})
	.parseAsync() // Parse arguments asynchronously
	.catch(error => { // Catch errors from the async parsing or command execution if not caught internally
		console.error("\n[App] 🚨 An unexpected critical error occurred during execution:");
		if (error instanceof Error) {
			console.error(`   Message: ${error.message}`);
			console.error(error.stack); // Log stack trace for critical errors
		} else {
			console.error("   An unknown error object was thrown:", error);
		}
		process.exit(1); // Exit with failure code
	});