// File: src/gemini/commands/suggest-improvements.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '../../shared/types/app.type';
import { getConsolidatedSources, getTargetFiles } from '../../shared/utils/filesystem.utils';
import { readSingleFile } from '../../shared/utils/file-io.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../gemini.service';
import { EnhancementType } from '../types/enhancement.type';

const logPrefix = "[SuggestImprovements]";

/**
 * Executes the suggest improvements command, leveraging the Gemini service to provide code improvement suggestions.
 *
 * @param {CliArguments} args - Command line arguments containing target path, prefix, and command type.
 * @returns {Promise<void>} - A promise that resolves when the command is complete.
 * @throws {Error} - Throws an error if there's a mismatch in command type, if the target path is inaccessible,
 *                   if the target path is neither a file nor a directory, or if the Gemini service fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Verify that the correct command handler is being executed.
    if (args.command !== EnhancementType.SuggestImprovements) {
        throw new Error("Handler mismatch: Expected SuggestImprovements command.");
    }
    const { targetPath, prefix } = args;
    console.log(`\n${logPrefix} Suggesting improvements for code in: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    // Check if the target path exists and retrieve its file system stats.
    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath);
    } catch (e) {
        // If the target path is inaccessible, throw an error.
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    // Declare variables to store the code to process and the list of target files.
    let codeToProcess: string;
    let targetFiles: string[] = [];

    // Handle the case where the target path is a directory.
    if (stats.isDirectory()) {
        // Get the list of target files based on the target path and prefix.
        targetFiles = await getTargetFiles(targetPath, prefix);
        // If no relevant files are found, exit the command.
        if (targetFiles.length === 0) {
            console.log(`\n${logPrefix} No relevant files found. Exiting.`);
            return;
        }
        console.log(`\n${logPrefix} Consolidating ${targetFiles.length} file(s)...`);
        // Consolidate the sources of the target files into a single string.
        codeToProcess = await getConsolidatedSources(targetPath, prefix);
    } else if (stats.isFile()) {
        // Handle the case where the target path is a single file.
        targetFiles.push(path.resolve(targetPath));
        codeToProcess = readSingleFile(targetFiles[0]);
    } else {
        // If the target path is neither a file nor a directory, throw an error.
        throw new Error(`Target path ${targetPath} is neither a file nor a directory.`);
    }

    // Check if the code to process is empty.
    if (codeToProcess.trim() === '') {
        console.warn(`${logPrefix} Warning: Content for suggestions is empty. Skipping API call.`);
        return;
    }

    // Invoke the Gemini service to suggest improvements for the code.
    console.log(`\n${logPrefix} Invoking Gemini service...`);
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.SuggestImprovements, codeToProcess);

    // Process the result from the Gemini service.
    if (result.type === 'text' && result.content !== null) {
        // If the result is text-based and contains content, print the result to the console.
        console.log(`\n--- Gemini ${args.command} Result ---`);
        console.log(result.content);
        console.log(`--- End ${args.command} Result ---\n`);
    } else if (result.type === 'error') {
        // If the result is an error, throw an error with the error message from the Gemini service.
        throw new Error(`Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
    } else {
        // If the result is of an unexpected type or contains null content, log a warning and throw an error.
        console.warn(`${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text').`);
        if (result.content) { /* Log unexpected content */ } //Consider logging the content for debugging purposes
        throw new Error(`Received unexpected result type '${result.type}' from Gemini.`);
    }
}