// File: src/gemini/commands/analyze.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '../../shared/types/app.type.js';
import { getConsolidatedSources, getTargetFiles } from '../../shared/utils/filesystem.utils.js';
import { readSingleFile } from '../../shared/utils/file-io.utils.js';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../gemini.service.js';
import { EnhancementType } from '../types/enhancement.type.js';

const logPrefix = "[Analyze]";

/**
 * Executes the analyze command, leveraging the Gemini service to analyze code.
 *
 * @param args - The command-line arguments, including the target path and any prefix.
 * @throws Error if the command is not 'Analyze', if the target path is inaccessible, or if the Gemini service fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Validate that the correct command handler is being invoked.  This acts as a double-check.
    if (args.command !== EnhancementType.Analyze) {
        throw new Error("Handler mismatch: Expected Analyze command.");
    }
    const { targetPath, prefix } = args;
    console.log(`\n${logPrefix} Analyzing code in: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    // Check if the target path exists and is accessible.
    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath);
    } catch (e) {
        // If the target path is not accessible, throw an error to stop execution.
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    let codeToProcess: string;
    let targetFiles: string[] = [];

    // Handle different target path types (directory or file).
    if (stats.isDirectory()) {
        // If it's a directory, get all target files within that directory.
        targetFiles = await getTargetFiles(targetPath, prefix);
        if (targetFiles.length === 0) {
            // If no relevant files are found, log a message and exit.
            console.log(`\n${logPrefix} No relevant files found. Exiting.`);
            return;
        }
        console.log(`\n${logPrefix} Consolidating ${targetFiles.length} file(s)...`);
        // Consolidate the contents of all target files into a single string.
        codeToProcess = await getConsolidatedSources(targetPath, prefix);
    } else if (stats.isFile()) {
        // If it's a single file, add it to the target files array.
        targetFiles.push(path.resolve(targetPath));
        // Should check exclusion here again ideally, or trust initial handler check
        // Read the content of the single file.
        codeToProcess = readSingleFile(targetFiles[0]);
    } else {
        // If the target path is neither a file nor a directory, throw an error.
        throw new Error(`Target path ${targetPath} is neither a file nor a directory.`);
    }


    // Check if the code to process is empty.
    if (codeToProcess.trim() === '') {
        console.warn(`${logPrefix} Warning: Content to analyze is empty. Skipping API call.`);
        return;
    }

    console.log(`\n${logPrefix} Invoking Gemini service...`);
    // Invoke the Gemini service to analyze the code.
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.Analyze, codeToProcess);

    // Handle the result from the Gemini service.
    if (result.type === 'text' && result.content !== null) {
        // If the result is text and the content is not null, log the result to the console.
        console.log(`\n--- Gemini ${args.command} Result ---`);
        console.log(result.content);
        console.log(`--- End ${args.command} Result ---\n`);
    } else if (result.type === 'error') {
        // If the result is an error, throw an error to be caught by the dispatcher.
        throw new Error(`Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
    } else {
        // If the result is unexpected, log a warning and throw an error.
        console.warn(`${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text').`);
        if (result.content) {
            console.log("--- Unexpected Content ---");
            console.log(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''));
            console.log("-------------------------");
        }
        throw new Error(`Received unexpected result type '${result.type}' from Gemini.`);
    }
}