// File: src/gemini/commands/generate-module-readme.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '@shared/types/app.type';
import { getConsolidatedSources } from '@shared/utils/filesystem.utils';
import { writeOutputFile } from '@shared/utils/file-io.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';

const logPrefix = "[GenerateModuleReadme]";
const OUTPUT_FILENAME = 'README.md'; // Fixed output filename

/**
 * Executes the GenerateModuleReadme command. Consolidates code from the target module directory,
 * sends it to Gemini for README generation, and saves the result to README.md
 * within that directory.
 *
 * The primary goal is to automatically generate a descriptive README file for a given module,
 * leveraging a large language model (Gemini) to understand the code and create human-readable documentation.
 *
 * @param args - The command line arguments, expecting targetPath to be a directory and prefix to filter files within the directory.
 *                 - `targetPath`: The path to the module directory.
 *                 - `prefix`: (Optional) A prefix used to filter files within the module directory (e.g., a specific file extension).
 * @returns A promise that resolves when the README generation and writing are complete.
 * @throws Error if the command is incorrect, target path is invalid/not a directory,
 *         consolidation fails, Gemini service fails, or writing the README file fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.GenerateModuleReadme) {
        throw new Error("Handler mismatch: Expected GenerateModuleReadme command.");
    }

    const { targetPath, prefix } = args;

    console.log(`\n${logPrefix} Generating README for module directory: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    // --- Validate Target Path ---
    let stats: fs.Stats;
    let absTargetPath: string; // Will store the absolute path to the target module directory
    try {
        // Convert the potentially relative path to an absolute path.  This ensures
        // consistent file access regardless of the current working directory.
        absTargetPath = path.resolve(targetPath);
        stats = fs.statSync(absTargetPath);
        // Check if the target path exists and is a directory.  This is essential to
        // prevent errors when attempting to read files from a non-directory or non-existent path.
        if (!stats.isDirectory()) {
            throw new Error(`Target path for '${EnhancementType.GenerateModuleReadme}' must be a directory.`);
        }
    } catch (e) {
        // Catch any errors related to accessing the target path. This includes cases where
        // the path doesn't exist or the user doesn't have permissions to access it.
        throw new Error(`Cannot access target path: '${targetPath}'. Please ensure it exists and is a directory. ${e instanceof Error ? e.message : ''}`);
    }

    // --- Consolidate Code (Scoped to Module Directory) ---
    console.log(`\n${logPrefix} Consolidating code from module directory ${absTargetPath}...`);
    const consolidatedCode = await getConsolidatedSources(absTargetPath, prefix); // Scoped consolidation

    // Check if consolidation yielded any meaningful content
    if (consolidatedCode.trim().split('\n').length <= 7) { // Adjust based on actual header lines
        console.warn(`${logPrefix} No relevant source files found in module directory '${targetPath}'${prefix ? ` matching prefix '${prefix}'` : ''}. Cannot generate README.`);
        return;
    }

    // --- Invoke Gemini Service ---
    console.log(`\n${logPrefix} Invoking Gemini service to generate module README...`);
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.GenerateModuleReadme, consolidatedCode);

    // --- Handle Result & Write README.md ---
    if (result.type === 'text' && result.content !== null) {
        // --- CORRECTED OUTPUT PATH CALCULATION ---
        // Output path is resolved *inside* the target module directory
        const outputFilePath = path.resolve(absTargetPath, OUTPUT_FILENAME);
        // --- End Correction ---

        // Get the relative path for logging purposes
        const relativeOutput = path.relative(process.cwd(), outputFilePath).split(path.sep).join('/');

        console.log(`\n${logPrefix} Writing generated README to ${relativeOutput}...`);
        // Add a warning if overwriting
        if (fs.existsSync(outputFilePath)) {
            console.warn(`${logPrefix} ⚠️ File already exists at ${relativeOutput} and will be overwritten.`);
        }

        const success = writeOutputFile(outputFilePath, result.content);
        if (!success) {
            throw new Error(`Failed to write module README file to ${relativeOutput}.`);
        } else {
            console.log(`\n${logPrefix} ✅ Successfully generated module README: ${relativeOutput}`);
        }
    } else if (result.type === 'error') {
        // If the Gemini service returns an error, throw an error to stop the execution.
        // This ensures that the user is informed about the failure and can investigate.
        throw new Error(`Gemini service failed during module README generation: ${result.content ?? 'No specific error message provided.'}`);
    } else {
        // Handle unexpected results. This provides a mechanism to handle unexpected data from Gemini,
        // logging the event and throwing an error. This assists in debugging any data inconsistencies.
        console.warn(`${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text').`);
        if (result.content) {
            console.log("--- Unexpected Content ---");
            console.log(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''));
            console.log("-------------------------");
        }
        throw new Error(`Received unexpected result type '${result.type}' from Gemini during module README generation.`);
    }
}