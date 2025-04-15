// File: src/gemini/commands/analyze.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '@shared/types/app.type';
import { getConsolidatedSources, getTargetFiles } from '@shared/utils/filesystem.utils';
import { readSingleFile } from '@shared/utils/file-io.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';

const logPrefix = "[Analyze]";

/**
 * Executes the analyze command, leveraging the Gemini service to analyze code.
 * This function orchestrates the process of reading code from a specified target path,
 * sending it to the Gemini service for analysis, and then displaying the results.
 *
 * @param args - The command-line arguments, including the target path and any prefix.
 *                  The `targetPath` specifies the file or directory to analyze.
 *                  The `prefix` is an optional file extension filter.
 * @throws Error if the command is not 'Analyze', if the target path is inaccessible, or if the Gemini service fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Validate that the correct command handler is being invoked.  This acts as a double-check
    // against potential routing errors in the command dispatcher.
    if (args.command !== EnhancementType.Analyze) {
        throw new Error("Handler mismatch: Expected Analyze command.");
    }

    const { targetPath, prefix } = args;
    console.log(`\n${logPrefix} Analyzing code in: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    // Check if the target path exists and is accessible to prevent file system errors later on.
    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath);
    } catch (e) {
        // If the target path is not accessible (e.g., doesn't exist, no permissions),
        // throw an error to stop execution and inform the user.
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    let codeToProcess: string;
    let targetFiles: string[] = [];

    // Handle different target path types (directory or file).
    // The logic here branches based on whether the target path refers to a directory or a single file.
    if (stats.isDirectory()) {
        // If it's a directory, get all target files within that directory.
        targetFiles = await getTargetFiles(targetPath, prefix);
        if (targetFiles.length === 0) {
            // If no relevant files are found based on the specified prefix (if any),
            // log a message and exit gracefully.  This avoids unnecessary processing.
            console.log(`\n${logPrefix} No relevant files found. Exiting.`);
            return;
        }
        console.log(`\n${logPrefix} Consolidating ${targetFiles.length} file(s)...`);
        // Consolidate the contents of all target files into a single string.
        // This is done to provide the Gemini service with a unified view of the code for analysis.
        codeToProcess = await getConsolidatedSources(targetPath, prefix);
    } else if (stats.isFile()) {
        // If it's a single file, add it to the target files array.
        targetFiles.push(path.resolve(targetPath));
        // Should check exclusion here again ideally, or trust initial handler check
        // Read the content of the single file.
        // This extracts the source code that will be sent to the Gemini service for analysis.
        codeToProcess = readSingleFile(targetFiles[0]);
    } else {
        // If the target path is neither a file nor a directory, throw an error.
        // This is an unexpected state and indicates a problem with the provided target path.
        throw new Error(`Target path ${targetPath} is neither a file nor a directory.`);
    }

    // Check if the code to process is empty after consolidation or reading.
    // This prevents unnecessary API calls to the Gemini service when there's no code to analyze.
    if (codeToProcess.trim() === '') {
        console.warn(`${logPrefix} Warning: Content to analyze is empty. Skipping API call.`);
        return;
    }

    console.log(`\n${logPrefix} Invoking Gemini service...`);
    // Invoke the Gemini service to analyze the code.
    // The `enhanceCodeWithGemini` function handles the communication with the Gemini service.
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.Analyze, codeToProcess);

    // Handle the result from the Gemini service.
    // The logic here branches based on the `type` property of the `GeminiEnhancementResult`.
    if (result.type === 'text' && result.content !== null) {
        // If the result is text and the content is not null, log the result to the console.
        // This displays the analysis provided by the Gemini service to the user.
        console.log(`\n--- Gemini ${args.command} Result ---`);
        console.log(result.content);
        console.log(`--- End ${args.command} Result ---\n`);
    } else if (result.type === 'error') {
        // If the result is an error, throw an error to be caught by the dispatcher.
        // This ensures that errors from the Gemini service are properly handled and reported.
        throw new Error(`Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
    } else {
        // If the result is unexpected, log a warning and throw an error.
        // This helps identify and debug potential issues with the Gemini service or the result processing.
        console.warn(`${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text').`);
        if (result.content) {
            console.log("--- Unexpected Content ---");
            console.log(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''));
            console.log("-------------------------");
        }
        throw new Error(`Received unexpected result type '${result.type}' from Gemini.`);
    }
}