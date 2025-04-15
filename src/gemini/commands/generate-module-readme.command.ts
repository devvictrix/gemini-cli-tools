// File: src/gemini/commands/generate-module-readme.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '../../shared/types/app.type.js';
import { getConsolidatedSources } from '../../shared/utils/filesystem.utils.js';
import { writeOutputFile } from '../../shared/utils/file-io.utils.js';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../gemini.service.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[GenerateModuleReadme]";
const OUTPUT_FILENAME = 'README.md'; // Fixed output filename

/**
 * Executes the GenerateModuleReadme command. Consolidates code from the target module directory,
 * sends it to Gemini for README generation, and saves the result to README.md
 * within that directory.
 *
 * @param args - The command line arguments, expecting targetPath to be a directory.
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
        absTargetPath = path.resolve(targetPath);
        stats = fs.statSync(absTargetPath);
        if (!stats.isDirectory()) {
            throw new Error(`Target path for '${EnhancementType.GenerateModuleReadme}' must be a directory.`);
        }
    } catch (e) {
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
        throw new Error(`Gemini service failed during module README generation: ${result.content ?? 'No specific error message provided.'}`);
    } else {
        // Handle unexpected results
        console.warn(`${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text').`);
        if (result.content) {
            console.log("--- Unexpected Content ---");
            console.log(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''));
            console.log("-------------------------");
        }
        throw new Error(`Received unexpected result type '${result.type}' from Gemini during module README generation.`);
    }
}