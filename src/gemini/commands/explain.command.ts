// File: src/gemini/commands/explain.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '@shared/types/app.type';
import { getConsolidatedSources, getTargetFiles } from '@shared/utils/filesystem.utils';
import { readSingleFile } from '@shared/utils/file-io.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../gemini.service';
import { EnhancementType } from '../types/enhancement.type';

const logPrefix = "[Explain]";

/**
 * Executes the 'explain' command, using the Gemini service to explain the code in the specified target path.
 *
 * @param args - The command line arguments, including the target path and any prefix to filter files.
 * @returns A promise that resolves when the explanation process is complete.
 * @throws Error if the command is not 'Explain', if the target path is inaccessible, or if the Gemini service fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Validate that the command is indeed 'Explain'.  This acts as a safeguard.
    if (args.command !== EnhancementType.Explain) {
        throw new Error("Handler mismatch: Expected Explain command.");
    }

    const { targetPath, prefix } = args;
    console.log(`\n${logPrefix} Explaining code in: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    let stats: fs.Stats;
    try {
        // Use fs.statSync to determine if the target path is a file or directory.  Synchronous call is ok at CLI entrypoint.
        stats = fs.statSync(targetPath);
    } catch (e) {
        // If the target path does not exist, throw an error to inform the user.
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    let codeToProcess: string;
    let targetFiles: string[] = [];

    if (stats.isDirectory()) {
        // If the target path is a directory, get all relevant files based on the specified prefix.
        targetFiles = await getTargetFiles(targetPath, prefix);
        if (targetFiles.length === 0) {
            // If no relevant files are found, log a message and exit.
            console.log(`\n${logPrefix} No relevant files found. Exiting.`);
            return;
        }
        console.log(`\n${logPrefix} Consolidating ${targetFiles.length} file(s)...`);
        // Consolidate the contents of all target files into a single string for processing.
        codeToProcess = await getConsolidatedSources(targetPath, prefix);
    } else if (stats.isFile()) {
        // If the target path is a file, read its contents directly.
        targetFiles.push(path.resolve(targetPath)); // Ensure full path
        codeToProcess = readSingleFile(targetFiles[0]);
    } else {
        // If the target path is neither a file nor a directory, throw an error.
        throw new Error(`Target path ${targetPath} is neither a file nor a directory.`);
    }

    // If the code to process is empty, skip the API call to Gemini.
    if (codeToProcess.trim() === '') {
        console.warn(`${logPrefix} Warning: Content to explain is empty. Skipping API call.`);
        return;
    }

    console.log(`\n${logPrefix} Invoking Gemini service...`);
    // Call the Gemini service to explain the code.
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.Explain, codeToProcess);

    // Handle the result from the Gemini service.
    if (result.type === 'text' && result.content !== null) {
        // If the result is text-based, log the explanation.
        console.log(`\n--- Gemini ${args.command} Result ---`);
        console.log(result.content);
        console.log(`--- End ${args.command} Result ---\n`);
    } else if (result.type === 'error') {
        // If the Gemini service returned an error, throw an error.
        throw new Error(`Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
    } else {
        // If the result is unexpected, log a warning and throw an error.
        console.warn(`${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text').`);
        if (result.content) { /* Log unexpected content */ } //TODO: Add logging here. Consider logging at "debug" level.
        throw new Error(`Received unexpected result type '${result.type}' from Gemini.`);
    }
}