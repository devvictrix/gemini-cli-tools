// File: src/gemini/commands/explain.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '@shared/types/app.type';
import { getConsolidatedSources, getTargetFiles } from '@shared/utils/filesystem.utils';
import { readSingleFile } from '@shared/utils/file-io.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';

const logPrefix = "[Explain]";

/**
 * Executes the 'explain' command, using the Gemini service to explain the code in the specified target path.
 * This command analyzes the provided code (either a single file or a directory of files) and uses the Gemini
 * AI model to generate a human-readable explanation of the code's functionality.
 *
 * @param args - The command line arguments, including the target path (file or directory) and an optional prefix to filter files within a directory.
 *               The `command` property of `args` must be `EnhancementType.Explain`.
 * @returns A promise that resolves when the explanation process is complete. The promise does not return any value.
 * @throws {Error} If the command is not 'Explain', if the target path is inaccessible, if the Gemini service fails, or if unexpected data is received from the Gemini service.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Validate that the command is indeed 'Explain'. This check ensures that the correct handler is being executed.
    if (args.command !== EnhancementType.Explain) {
        throw new Error("Handler mismatch: Expected Explain command.");
    }

    const { targetPath, prefix } = args;
    console.log(`\n${logPrefix} Explaining code in: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    let stats: fs.Stats;
    try {
        // Use fs.statSync to determine if the target path is a file or directory.
        // This is a synchronous operation, but acceptable here as it's part of the command's initial setup.
        stats = fs.statSync(targetPath);
    } catch (e) {
        // If the target path does not exist or is inaccessible, throw an error to inform the user.
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    let codeToProcess: string;
    let targetFiles: string[] = [];

    if (stats.isDirectory()) {
        // If the target path is a directory, get all relevant files based on the specified prefix.
        targetFiles = await getTargetFiles(targetPath, prefix);
        if (targetFiles.length === 0) {
            // If no relevant files are found, log a message and exit. This avoids unnecessary calls to the Gemini service.
            console.log(`\n${logPrefix} No relevant files found. Exiting.`);
            return;
        }
        console.log(`\n${logPrefix} Consolidating ${targetFiles.length} file(s)...`);
        // Consolidate the contents of all target files into a single string for processing.
        // This allows the Gemini service to analyze the code as a whole, providing a more comprehensive explanation.
        codeToProcess = await getConsolidatedSources(targetPath, prefix);
    } else if (stats.isFile()) {
        // If the target path is a file, read its contents directly.
        targetFiles.push(path.resolve(targetPath)); // Ensure full path.  Important for consistent file referencing.
        codeToProcess = readSingleFile(targetFiles[0]);
    } else {
        // If the target path is neither a file nor a directory, throw an error.
        // This prevents unexpected behavior and ensures that the command handles only valid target types.
        throw new Error(`Target path ${targetPath} is neither a file nor a directory.`);
    }

    // If the code to process is empty, skip the API call to Gemini.
    if (codeToProcess.trim() === '') {
        console.warn(`${logPrefix} Warning: Content to explain is empty. Skipping API call.`);
        return;
    }

    console.log(`\n${logPrefix} Invoking Gemini service...`);
    // Call the Gemini service to explain the code.
    // The `enhanceCodeWithGemini` function encapsulates the interaction with the Gemini API.
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.Explain, codeToProcess);

    // Handle the result from the Gemini service.
    if (result.type === 'text' && result.content !== null) {
        // If the result is text-based, log the explanation.
        console.log(`\n--- Gemini ${args.command} Result ---`);
        console.log(result.content);
        console.log(`--- End ${args.command} Result ---\n`);
    } else if (result.type === 'error') {
        // If the Gemini service returned an error, throw an error.
        // This ensures that errors from the Gemini service are properly propagated to the user.
        throw new Error(`Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
    } else {
        // If the result is unexpected, log a warning and throw an error.
        // This helps to identify and handle unexpected responses from the Gemini service.
        console.warn(`${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text').`);
        if (result.content) { /* Log unexpected content */ } //TODO: Add logging here. Consider logging at "debug" level.
        throw new Error(`Received unexpected result type '${result.type}' from Gemini.`);
    }
}