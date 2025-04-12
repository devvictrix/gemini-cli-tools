// src/app.ts
import * as fs from 'fs';
import * as path from 'path';
import { CODE_FILE_PATH } from './config'; // Default target file if none specified
import { enhanceCodeWithGemini, GeminiEnhancementResult } from './gemini/gemini.service';
import { EnhancementType, isValidEnhancementType } from './shared/types/enhancement.type';
import { getConsolidatedSources } from './inspector/inspector.service';

// --- Argument Parsing Interface ---
interface ParsedArgs {
	action: EnhancementType;
	targetPath?: string; // Optional target file or directory path
	prefix?: string;     // Optional filename prefix for consolidation
}

/**
 * Parses command line arguments.
 * Expects: <ActionType> [TargetPath] [Prefix]
 * @returns A ParsedArgs object. Exits if validation fails.
 */
function parseArguments(): ParsedArgs {
	const args = process.argv.slice(2);
	const actionString = args[0];
	const targetPath = args[1]; // Can be undefined
	const prefix = args[2];     // Can be undefined

	// Validate Action Type
	if (!actionString) {
		console.error("\n❌ Error: Please provide an action type as the first argument.");
		console.log("\nUsage: npm start <ActionType> [TargetPath] [FilePrefix]");
		console.log("\nExample 1 (Add comments to default file): npm start AddComments");
		console.log("Example 2 (Analyze a specific file): npm start Analyze src/app.ts");
		console.log("Example 3 (Consolidate & Analyze 'src' dir): npm start ConsolidateAndAnalyze src");
		console.log("Example 4 (Consolidate & Analyze 'src' dir, files starting with 'gemini'): npm start ConsolidateAndAnalyze src gemini");
		console.log("\nAvailable Action Types:", Object.values(EnhancementType).join(', '));
		process.exit(1);
	}
	if (!isValidEnhancementType(actionString)) {
		console.error(`\n❌ Error: Invalid action type "${actionString}".`);
		console.log("Available Action Types:", Object.values(EnhancementType).join(', '));
		process.exit(1);
	}
	const action = actionString as EnhancementType;

	// Basic validation for ConsolidateAndAnalyze if target path looks like a file
	if (action === EnhancementType.ConsolidateAndAnalyze && targetPath && path.extname(targetPath) !== '') {
		console.warn(`\n⚠️ Warning: Action 'ConsolidateAndAnalyze' typically expects a directory, but got a file path: ${targetPath}. Will attempt to consolidate containing directory.`);
		// Could refine this - maybe treat it as analyzing just that one file? For now, proceed as if dir was intended.
	}

	return { action, targetPath, prefix };
}


/**
 * Reads the content of a single code file.
 * @param filePath The path to the code file.
 * @returns The code content as a string. Throws an error if the file cannot be read.
 */
function readSingleCodeFile(filePath: string): string {
	console.log(`[App] Reading single file: ${filePath}`);
	try {
		const stats = fs.statSync(filePath);
		if (!stats.isFile()) {
			throw new Error(`Target path is not a file: ${filePath}`);
		}
		const code = fs.readFileSync(filePath, 'utf8');
		console.log(`[App] Successfully read ${code.length} characters from single file.`);
		return code;
	} catch (readError) {
		console.error(`❌ Error reading file ${filePath}:`);
		if (readError instanceof Error) {
			console.error(readError.message);
		} else {
			console.error("An unknown error occurred during file read.");
		}
		throw readError; // Re-throw to be caught by main
	}
}

/**
 * Updates the content of a code file. Provides a warning before overwriting.
 * Only call this if modification is intended and allowed.
 * @param filePath The path to the code file.
 * @param newCode The new code content to write to the file.
 * @returns True if the file was updated successfully, false otherwise.
 */
function updateCodeFile(filePath: string, newCode: string): boolean {
	console.warn(`\n⚠️ WARNING: Attempting to automatically overwrite ${path.basename(filePath)}...`);
	try {
		fs.writeFileSync(filePath, newCode, 'utf8');
		console.log(`✅ Successfully updated ${filePath}.`);
		// Git add command could go here
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
 * The main function that orchestrates the code enhancement process.
 */
async function main() {
	const { action, targetPath, prefix } = parseArguments();
	console.log(`\nSelected action: ${action}${targetPath ? ` on target: ${targetPath}` : ''}${prefix ? ` with prefix: ${prefix}` : ''}`);

	let codeToProcess: string;
	let actualTargetPathForModification: string | undefined; // Track the *specific* file to potentially modify
	let geminiRequestType = action; // Default: the requested action is the AI task

	try {
		if (action === EnhancementType.ConsolidateAndAnalyze) {
			const consolidationRoot = targetPath || process.cwd(); // Use target or CWD
			console.log(`\nAction requires consolidation from: ${consolidationRoot}...`);
			codeToProcess = await getConsolidatedSources(consolidationRoot, prefix);
			actualTargetPathForModification = undefined; // Can't modify after consolidation
			geminiRequestType = EnhancementType.Analyze; // Always analyze consolidated code
			console.log("Consolidation complete. Proceeding to analysis...");

		} else if (targetPath) {
			// Action requires processing a specific target file or directory (that's not ConsolidateAndAnalyze)
			const stats = fs.statSync(targetPath);
			if (stats.isDirectory()) {
				console.log(`\nAction targets directory: ${targetPath}. Consolidating content...`);
				// If a directory is specified for actions like AddComments, consolidate it first.
				codeToProcess = await getConsolidatedSources(targetPath, prefix);
				actualTargetPathForModification = undefined; // Can't modify multiple files yet
				// Decide what Gemini action makes sense - maybe Analyze? Or keep the original action?
				// Let's keep original action for now, e.g., 'AddComments' on consolidated code.
				console.log("Directory consolidation complete.");
			} else { // It's a file
				console.log(`\nAction targets specific file: ${targetPath}...`);
				codeToProcess = readSingleCodeFile(targetPath);
				actualTargetPathForModification = targetPath; // This is the file we might modify
				// Keep original geminiRequestType
			}
		} else {
			// No target specified, and not ConsolidateAndAnalyze - default to CODE_FILE_PATH
			console.log(`\nAction targets default file: ${CODE_FILE_PATH}...`);
			codeToProcess = readSingleCodeFile(CODE_FILE_PATH);
			actualTargetPathForModification = CODE_FILE_PATH;
			// Keep original geminiRequestType
		}

	} catch (error) {
		console.error("\n❌ Error during input processing phase:", error instanceof Error ? error.message : error);
		process.exit(1);
	}

	// Determine if modification is allowed based *only* on the original action type
	const isModificationIntent = (action === EnhancementType.AddComments); // Add other modifying actions here

	// --- Call the Gemini service ---
	console.log(`\nInvoking Gemini service for action: ${geminiRequestType}...`);
	const result: GeminiEnhancementResult = await enhanceCodeWithGemini(geminiRequestType, codeToProcess);

	// --- Process the result from the service ---
	console.log("\nProcessing Gemini service result...");
	switch (result.type) {
		case 'code':
			if (result.content) {
				// Check if modification was intended AND we have a specific file target
				if (isModificationIntent && actualTargetPathForModification) {
					// Compare with the ORIGINAL code read from the target file
					const originalCodeForComparison = readSingleCodeFile(actualTargetPathForModification); // Re-read needed

					if (originalCodeForComparison.trim() !== result.content.trim()) {
						console.log(`\n✨ Proposed code changes detected for ${path.basename(actualTargetPathForModification)}!`);
						console.log(`--- Proposed Code Snippet (first 20 lines) ---`);
						console.log(result.content.split('\n').slice(0, 20).join('\n'));
						if (result.content.split('\n').length > 20) console.log('...');
						console.log("---------------------------------------------");
						updateCodeFile(actualTargetPathForModification, result.content); // Overwrite the specific target file
					} else {
						console.log(`\n✅ Gemini response code seems identical to original code in ${path.basename(actualTargetPathForModification)}. No file update needed.`);
					}
				} else {
					// Modification wasn't intended OR we processed a directory (no single target to write to)
					console.log("\nℹ️ Gemini returned code. Displaying snippet (no file modification performed):");
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
			console.log(`\n--- Gemini ${geminiRequestType} Result ---`);
			console.log(result.content ?? 'Gemini returned empty text content.');
			console.log(`--- End ${geminiRequestType} Result ---\n`);
			break;

		case 'error':
			console.error(`\n❌ Enhancement process failed: ${result.content ?? 'No specific error message provided.'}`);
			break;

		default:
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
	process.exit(1);
});