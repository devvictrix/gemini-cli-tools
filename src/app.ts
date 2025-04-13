// File: src/app.ts
// Corrected yargs import and wrap call

import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit';
import yargs, { Argv } from 'yargs'; // Import Argv type directly
import { hideBin } from 'yargs/helpers';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from './gemini/gemini.service.js';
import { EnhancementType, isValidEnhancementType } from './shared/types/enhancement.type.js';
import { getConsolidatedSources, getTargetFiles } from './filesystem/filesystem.service.js';
import { EXCLUDE_FILENAMES } from './filesystem/filesystem.config.js';
import { inferTypesFromData } from './inference/local-type-inference.service.js';

// --- Interfaces ---
// Interface for yargs arguments
interface AppArguments {
	command: EnhancementType;
	targetPath: string;
	prefix?: string;
	interfaceName?: string;
	[key: string]: unknown;
	_: (string | number)[];
	$0: string;
}

// Interface for parallel processing results
interface FileProcessingResult {
	filePath: string;
	status: 'updated' | 'unchanged' | 'error' | 'processed';
	message?: string;
}


// --- Utility Functions ---

/**
 * Reads the content of a single code file synchronously.
 * @param filePath The absolute path to the code file.
 * @returns The code content as a string.
 * @throws An error if the file cannot be read or is not a file.
 */
function readSingleCodeFile(filePath: string): string {
	const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
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

/**
 * The main application logic, now accepts parsed arguments from yargs.
 * @param argv The parsed arguments object from yargs.
 */
async function runMainLogic(argv: AppArguments) {
	const { command: action, targetPath, prefix, interfaceName } = argv;
	console.log(`\nSelected action: ${action} on target: ${targetPath}${prefix ? ` with prefix: ${prefix}` : ''}${interfaceName ? ` (Interface: ${interfaceName})` : ''}`);

	// --- Validate Target Path Access and Type ---
	let stats: fs.Stats;
	try {
		stats = fs.statSync(targetPath);
	} catch (e) {
		console.error(`\n❌ Error: Cannot access target path: ${targetPath}. Please ensure it exists.`);
		process.exit(1);
	}
	if (action === EnhancementType.InferFromData && !stats.isFile()) {
		console.error(`\n❌ Error: Target path for '${EnhancementType.InferFromData}' must be a file (e.g., JSON).`);
		process.exit(1);
	}

	// Determine action categories
	const isModificationAction = [
		EnhancementType.AddComments,
		EnhancementType.AddPathComment,
	].includes(action);

	const usesGeminiApi = [
		EnhancementType.AddComments,
		EnhancementType.Analyze,
		EnhancementType.Explain,
		EnhancementType.SuggestImprovements,
		EnhancementType.GenerateDocs,
	].includes(action);

	const isLocalProcessingAction = [
		EnhancementType.Consolidate,
		EnhancementType.InferFromData,
		EnhancementType.AddPathComment,
	].includes(action);


	try {
		let targetFiles: string[] = [];

		// --- Identify target files ---
		if (action === EnhancementType.InferFromData) {
			targetFiles.push(path.resolve(targetPath));
			console.log(`[App] Target for '${action}' is the single file: ${targetPath}`);
		} else if (stats.isDirectory()) {
			console.log(`[App] Target is a directory. Finding relevant files...`);
			targetFiles = await getTargetFiles(targetPath, prefix);
			if (targetFiles.length === 0) {
				console.log("\n[App] No relevant files found matching criteria. Exiting.");
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
		}

		// --- Process based on action type ---

		if (isModificationAction && action !== EnhancementType.AddPathComment) {
			// --- PARALLEL MODIFICATION FLOW (AddComments) ---
			const concurrencyLimit = 5;
			const limit = pLimit(concurrencyLimit);
			console.log(`\n[App] Starting PARALLEL modification action '${action}' on ${targetFiles.length} file(s) with concurrency ${concurrencyLimit}...`);

			let fileProcessor: (absoluteFilePath: string) => Promise<FileProcessingResult>;

			if (action === EnhancementType.AddComments) {
				fileProcessor = async (absoluteFilePath): Promise<FileProcessingResult> => {
					const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
					try {
						const originalCode = readSingleCodeFile(absoluteFilePath);
						const result: GeminiEnhancementResult = await enhanceCodeWithGemini(action, originalCode);

						if (result.type === 'code' && result.content !== null) {
							if (originalCode.trim() !== result.content.trim()) {
								const updated = updateCodeFile(absoluteFilePath, result.content);
								return { filePath: relativeFilePath, status: updated ? 'updated' : 'error', message: updated ? undefined : 'File write failed' };
							} else {
								return { filePath: relativeFilePath, status: 'unchanged' };
							}
						} else if (result.type === 'error') {
							console.error(`    ❌ Gemini failed for ${relativeFilePath}: ${result.content}`);
							return { filePath: relativeFilePath, status: 'error', message: `Gemini Error: ${result.content}` };
						} else {
							console.warn(`    ⚠️ Received unexpected result type '${result.type}' or null content (expected 'code') for ${relativeFilePath}.`);
							return { filePath: relativeFilePath, status: 'error', message: `Unexpected result type/content: ${result.type}` };
						}
					} catch (fileProcessingError) {
						console.error(`    ❌ Error during Gemini processing for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
						return { filePath: relativeFilePath, status: 'error', message: `File/API Processing Error: ${fileProcessingError instanceof Error ? fileProcessingError.message : "Unknown error"}` };
					}
				};
			} else {
				console.error(`[App] Internal Error: Unhandled parallel modification action type "${action}"`);
				fileProcessor = async (fp) => ({ filePath: path.relative(process.cwd(), fp).split(path.sep).join('/'), status: 'error', message: `Unhandled parallel mod action: ${action}` });
			}

			const tasks = targetFiles.map(filePath => limit(() => fileProcessor(filePath)));
			const results: FileProcessingResult[] = await Promise.all(tasks);

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
			console.log(`  Total Files Target:  ${targetFiles.length}`);
			console.log(`  Successfully Updated:  ${successCount}`);
			console.log(`  No Changes Needed:   ${unchangedCount}`);
			console.log(`  Errors Encountered:    ${errorCount}`);
			console.log("---------------------------------");
			if (errorCount > 0) process.exitCode = 1;


		} else if (usesGeminiApi && !isModificationAction) {
			// --- NON-MODIFICATION FLOW using GEMINI ---
			let codeToProcess: string;
			const geminiRequestType = action;

			if (stats.isDirectory() || targetFiles.length > 1) {
				console.log(`\n[App] Consolidating ${targetFiles.length} file(s) for Gemini action '${action}'...`);
				const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetFiles[0]);
				codeToProcess = await getConsolidatedSources(consolidationRoot, prefix);
			} else if (targetFiles.length === 1) {
				console.log(`\n[App] Reading single file for Gemini action '${action}'...`);
				codeToProcess = readSingleCodeFile(targetFiles[0]);
			} else {
				console.error(`[App] Internal Error: No target files identified for Gemini action '${action}'.`);
				process.exitCode = 1;
				return;
			}

			if (codeToProcess.trim() === '') {
				console.warn(`[App] Warning: Content to send to Gemini for action '${action}' is empty. Skipping API call.`);
				return;
			}

			console.log(`\n[App] Invoking Gemini service for action: ${geminiRequestType}...`);
			const result: GeminiEnhancementResult = await enhanceCodeWithGemini(geminiRequestType, codeToProcess);

			if (result.type === 'text' && result.content !== null) {
				console.log(`\n--- Gemini ${geminiRequestType} Result ---`);
				console.log(result.content);
				console.log(`--- End ${geminiRequestType} Result ---\n`);
			} else if (result.type === 'error') {
				console.error(`\n[App] ❌ Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
				process.exitCode = 1;
			} else {
				console.warn(`[App] ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text') for ${geminiRequestType} action.`);
				if (result.content) {
					console.log("--- Unexpected Content Received ---");
					console.log(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''));
					console.log("----------------------------------");
				}
				process.exitCode = 1;
			}

		} else if (isLocalProcessingAction) {
			// --- LOCAL PROCESSING FLOW ---
			console.log(`\n[App] Starting local action '${action}'...`);

			if (action === EnhancementType.Consolidate) {
				console.log(`[App] Consolidating ${targetFiles.length} file(s)...`);
				const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetPath);
				console.log(`[App] Consolidating from root: ${consolidationRoot} ${prefix ? `with prefix '${prefix}'` : ''}...`);
				const consolidatedContent = await getConsolidatedSources(consolidationRoot, prefix);
				const outputFileName = 'consolidated_output.txt';
				const outputFilePath = path.resolve(process.cwd(), outputFileName);
				const success = writeOutputFile(outputFilePath, consolidatedContent);
				if (!success) process.exitCode = 1;
				else console.log(`\n➡️ You can now find consolidated content in: ${outputFileName}`);

			} else if (action === EnhancementType.InferFromData) {
				if (!interfaceName) {
					console.error("[App] Internal Error: Interface name missing for InferFromData.");
					process.exit(1);
				}
				const dataFilePath = targetFiles[0];
				const relativeDataFilePath = path.relative(process.cwd(), dataFilePath);
				console.log(`[App] Inferring types from data file: ${relativeDataFilePath}`);
				try {
					const fileContent = readSingleCodeFile(dataFilePath);
					let data: any;
					try {
						data = JSON.parse(fileContent);
					} catch (parseError) {
						console.error(`[App] ❌ Error parsing JSON data from ${relativeDataFilePath}: ${parseError instanceof Error ? parseError.message : parseError}`);
						process.exit(1);
					}
					const inferredInterface = inferTypesFromData(interfaceName, data);
					console.log(`\n--- Inferred Interface: ${interfaceName} ---`);
					console.log(inferredInterface);
					console.log(`--- End Interface ---`);
				} catch (inferenceError) {
					console.error(`[App] ❌ Error during type inference for ${relativeDataFilePath}: ${inferenceError instanceof Error ? inferenceError.message : inferenceError}`);
					process.exit(1);
				}
			} else if (action === EnhancementType.AddPathComment) {
				console.log(`\n[App] Starting SEQUENTIAL action '${action}' on ${targetFiles.length} file(s)...`);
				let updatedCount = 0;
				let unchangedCount = 0;
				let errorCount = 0;

				const pathCommentRegex = /^\s*\/\/\s*File:\s*(.+?)\.(ts|js|json|env)\s*$/;

				for (const absoluteFilePath of targetFiles) {
					const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
					try {
						const pathComment = `// File: ${relativeFilePath}`;
						const originalCode = readSingleCodeFile(absoluteFilePath);
						const lines = originalCode.split(/\r?\n/);

						let existingCommentIndex = -1;
						let foundOurComment = false;
						let foundDifferentComment = false;

						for (let i = 0; i < lines.length; i++) {
							const lineTrimmed = lines[i].trim();
							if (lineTrimmed === '') continue;

							const isPathComment = pathCommentRegex.test(lineTrimmed);
							if (isPathComment) {
								if (lineTrimmed === pathComment) {
									foundOurComment = true;
									existingCommentIndex = i;
									if (i === 0) break;
								} else {
									foundDifferentComment = true;
									if (i === 0) break;
								}
							} else {
								break;
							}
						}

						let needsUpdate = true;
						if (foundOurComment && existingCommentIndex === 0) {
							if (lines.length === 1 || (lines.length > 1 && lines[1].trim() === '')) {
								needsUpdate = false;
							}
						}

						if (!needsUpdate) {
							unchangedCount++;
						} else {
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
							const newCode = `${pathComment}\n\n${codeWithoutHeader}`;

							const updated = updateCodeFile(absoluteFilePath, newCode);
							if (updated) updatedCount++; else errorCount++;
						}
					} catch (fileProcessingError) {
						console.error(`    ❌ Error during AddPathComment for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
						errorCount++;
					}
				}

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
			console.error(`[App] Internal Error: Action "${action}" was not handled.`);
			process.exit(1);
		}

	} catch (error) {
		console.error("\n❌ An error occurred during script execution:");
		if (error instanceof Error) {
			console.error(`   Message: ${error.message}`);
		} else {
			console.error("   Unknown error object:", error);
		}
		process.exit(1);
	}

	console.log("\nScript execution finished.");
}

// --- Argument Parsing and Execution ---

// Helper function to set up common options for most commands
// Use the imported Argv type here
const setupDefaultCommand = (yargsInstance: Argv<{}>): Argv<{ targetPath: string; prefix: string | undefined }> => {
	return yargsInstance
		.positional('targetPath', {
			describe: 'Target file or directory path',
			type: 'string',
			demandOption: true,
		})
		.option('prefix', {
			alias: 'p',
			type: 'string',
			description: 'Optional filename prefix filter for directory processing',
			demandOption: false,
		});
};

// Use yargs to parse arguments and run the main logic
yargs(hideBin(process.argv))
	.command(
		`${EnhancementType.AddComments} <targetPath>`,
		'Add AI-generated comments to files in target path.',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.AddComments } as AppArguments)
	)
	.command(
		`${EnhancementType.Analyze} <targetPath>`,
		'Analyze code structure and quality.',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.Analyze } as AppArguments)
	)
	.command(
		`${EnhancementType.Explain} <targetPath>`,
		'Explain what the code does.',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.Explain } as AppArguments)
	)
	.command(
		`${EnhancementType.AddPathComment} <targetPath>`,
		'Add // File: comment to top of files.',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.AddPathComment } as AppArguments)
	)
	.command(
		`${EnhancementType.Consolidate} <targetPath>`,
		'Consolidate code into a single output file.',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.Consolidate } as AppArguments)
	)
	.command(
		`${EnhancementType.SuggestImprovements} <targetPath>`,
		'Suggest improvements for the code.',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.SuggestImprovements } as AppArguments)
	)
	.command(
		`${EnhancementType.GenerateDocs} <targetPath>`,
		'Generate Markdown documentation for the code.',
		setupDefaultCommand,
		(argv) => runMainLogic({ ...argv, command: EnhancementType.GenerateDocs } as AppArguments)
	)
	.command(
		`${EnhancementType.InferFromData} <targetPath>`,
		'Infer TypeScript interface from data file (JSON).',
		(yargsInstance) => { // Explicit type for builder function instance
			return yargsInstance
				.positional('targetPath', {
					describe: 'Path to the data file (e.g., data.json)',
					type: 'string',
					demandOption: true,
				})
				.option('interfaceName', {
					alias: 'i',
					type: 'string',
					description: 'Name for the generated TypeScript interface',
					demandOption: true,
				});
		},
		(argv) => runMainLogic({ ...argv, command: EnhancementType.InferFromData } as AppArguments)
	)
	.demandCommand(1, 'Please specify a valid command (action).')
	.strict()
	.help()
	.alias('h', 'help')
	.wrap(null) // Let yargs determine terminal width automatically
	.fail((msg, err, yargs) => {
		if (err) {
			console.error("\n🚨 An unexpected error occurred during argument parsing:");
			console.error(err);
			process.exit(1);
		}
		console.error(`\n❌ Error: ${msg}\n`);
		yargs.showHelp();
		process.exit(1);
	})
	.parseAsync()
	.catch(error => {
		console.error("\n🚨 An unexpected critical error occurred during execution:");
		if (error instanceof Error) {
			console.error(`   Message: ${error.message}`);
			console.error(error.stack);
		} else {
			console.error("   An unknown error object was thrown:", error);
		}
		process.exit(1);
	});