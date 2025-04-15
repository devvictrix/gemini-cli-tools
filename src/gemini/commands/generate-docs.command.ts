// File: src/gemini/commands/generate-docs.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '@shared/types/app.type';
import { getConsolidatedSources, getTargetFiles } from '@shared/utils/filesystem.utils';
import { readSingleFile, writeOutputFile } from '@shared/utils/file-io.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';

const logPrefix = "[GenerateDocs]"; // Define a constant for logging prefix, making logs easier to trace.

/**
 * Executes the GenerateDocs command, using Gemini to generate documentation for the code at the target path and writes it to README.md.
 *
 * This command takes a target path (file or directory) and an optional prefix to filter files.
 * It reads the code from the target, sends it to the Gemini service, and writes the generated
 * documentation to a README.md file in the current working directory.
 *
 * @param args The command line arguments, containing the target path, prefix, and the command type.
 *   - `targetPath`: The path to the file or directory to document.
 *   - `prefix`:  Optional prefix to filter files within a directory.
 * @returns A Promise that resolves when the documentation generation is complete.  Rejects if an error occurs.
 * @throws {Error} If the target path is inaccessible, no relevant files are found, the Gemini service fails,
 *   or writing the output file fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Validate that this handler is indeed intended to handle the GenerateDocs command.
    // This ensures that the correct handler is being used, preventing unexpected behavior.
    if (args.command !== EnhancementType.GenerateDocs) {
        throw new Error("Handler mismatch: Expected GenerateDocs command.");
    }
    const { targetPath, prefix } = args; // Extract relevant arguments using destructuring for cleaner code.
    console.log(`\n${logPrefix} Generating documentation for: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    // Check if the target path exists and is accessible.
    // This is a crucial step to prevent the application from crashing due to invalid paths.
    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath);
    } catch (e) {
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    let codeToProcess: string; // Variable to store the code that will be sent to Gemini.
    let targetFiles: string[] = []; // Array to store the list of target files.

    // Handle the case where the target path is a directory.
    if (stats.isDirectory()) {
        // Get all relevant files in the directory.
        // The `getTargetFiles` function filters files based on the provided prefix.
        targetFiles = await getTargetFiles(targetPath, prefix);
        if (targetFiles.length === 0) {
            console.log(`\n${logPrefix} No relevant files found. Exiting.`);
            return; // Exit gracefully if no files match the specified criteria to avoid unnecessary processing.
        }
        console.log(`\n${logPrefix} Consolidating ${targetFiles.length} file(s)...`);
        // Read and concatenate all files into a single string.
        // This allows Gemini to process the entire codebase at once for better context.
        codeToProcess = await getConsolidatedSources(targetPath, prefix);
    } else if (stats.isFile()) {
        // Handle the case where the target path is a single file.
        targetFiles.push(path.resolve(targetPath)); // Add the resolved path of the single file to the targetFiles array.
        codeToProcess = readSingleFile(targetFiles[0]); // Read the content of the single file.
    } else {
        // Handle the case where the target path is neither a file nor a directory (e.g., a broken symlink).
        // This ensures that the application handles unexpected file system entities gracefully.
        throw new Error(`Target path ${targetPath} is neither a file nor a directory.`);
    }

    // Check if the code to process is empty.
    // This avoids unnecessary API calls to Gemini, which can save resources and time.
    if (codeToProcess.trim() === '') {
        console.warn(`${logPrefix} Warning: Content for documentation is empty. Skipping API call.`);
        return;
    }

    console.log(`\n${logPrefix} Invoking Gemini service...`);
    // Invoke the Gemini service to generate the documentation.
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.GenerateDocs, codeToProcess);

    // Handle the result from the Gemini service.
    if (result.type === 'text' && result.content !== null) {
        // If the result is text-based documentation, write it to a file.
        const outputFileName = 'README.md'; // Standard output file
        const outputFilePath = path.resolve(process.cwd(), outputFileName); // Construct the full path to the output file.
        console.log(`\n${logPrefix} Attempting to write generated documentation to ${outputFileName}...`);
        const success = writeOutputFile(outputFilePath, result.content); // Use shared utility to write the file.
        if (!success) {
            throw new Error(`Failed to write documentation file to ${outputFileName}.`);
        } else {
            console.log(`\n${logPrefix} ✅ Generated documentation saved to: ${outputFileName}`);
        }
    } else if (result.type === 'error') {
        // Handle the case where the Gemini service returned an error.
        // Provide a more informative error message to the user.
        throw new Error(`Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
    } else {
        // Handle unexpected result types from the Gemini service.
        console.warn(`${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text').`);
        if (result.content) { /* Log unexpected content - potentially add logging here for debugging purposes */ } // Consider logging the content for debugging purposes.
        throw new Error(`Received unexpected result type '${result.type}' from Gemini.`);
    }
}