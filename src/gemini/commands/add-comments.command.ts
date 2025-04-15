// src/gemini/commands/add-comments.command.ts
import path from 'path';
import fs from 'fs'; // Needed for statSync if re-validating path
import pLimit from 'p-limit';
import { CliArguments, FileProcessingResult } from '../../shared/types/app.type.js';
import { getTargetFiles } from '../../shared/utils/filesystem.utils.js';
import { readSingleFile, updateFileContent } from '../../shared/utils/file-io.utils.js';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../gemini.service.js'; // Updated path
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[AddComments]";

/**
 * Executes the add comments command.  This function orchestrates the process of finding target files,
 * enhancing them with comments using the Gemini service, and updating the files with the enhanced code.
 *
 * @param args - The command line arguments, including the target path, prefix, and command type.
 * @returns A promise that resolves when the command has completed.
 * @throws An error if the command type is incorrect, the target path is inaccessible, or if errors occur during file processing.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Specific command validation/logic could go here if needed
    if (args.command !== EnhancementType.AddComments) {
        throw new Error("Handler mismatch: Expected AddComments command.");
    }
    const { targetPath, prefix } = args;

    console.log(`\n${logPrefix} Finding files in: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    // Optional: Re-validate targetPath exists and is accessible if needed
    try {
        fs.statSync(targetPath);
    } catch (e) {
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    const targetFiles = await getTargetFiles(targetPath, prefix);

    if (targetFiles.length === 0) {
        console.log(`\n${logPrefix} No relevant files found matching criteria. Exiting.`);
        return;
    }
    console.log(`${logPrefix} Found ${targetFiles.length} files to process.`);

    // --- PARALLEL MODIFICATION FLOW ---
    const concurrencyLimit = 5;
    const limit = pLimit(concurrencyLimit);
    console.log(`\n${logPrefix} Starting PARALLEL modification action on ${targetFiles.length} file(s)...`);

    /**
     * Processes a single file, enhancing it with comments from the Gemini service.
     *
     * @param absoluteFilePath - The absolute path to the file to process.
     * @returns A promise that resolves with a FileProcessingResult indicating the outcome of the processing.
     */
    const fileProcessor = async (absoluteFilePath: string): Promise<FileProcessingResult> => {
        const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
        try {
            const originalCode = readSingleFile(absoluteFilePath);
            const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.AddComments, originalCode);

            if (result.type === 'code' && result.content !== null) {
                if (originalCode.trim() !== result.content.trim()) {
                    const updated = updateFileContent(absoluteFilePath, result.content);
                    return { filePath: relativeFilePath, status: updated ? 'updated' : 'error', message: updated ? undefined : 'File write failed' };
                } else {
                    console.log(`    ${logPrefix} No changes needed for ${relativeFilePath}.`);
                    return { filePath: relativeFilePath, status: 'unchanged' };
                }
            } else if (result.type === 'error') {
                console.error(`    ${logPrefix} ❌ Gemini failed for ${relativeFilePath}: ${result.content}`);
                // Return error status, let the summary decide on overall failure
                return { filePath: relativeFilePath, status: 'error', message: `Gemini Error: ${result.content}` };
            } else {
                console.warn(`    ${logPrefix} ⚠️ Unexpected result type/content for ${relativeFilePath}.`);
                return { filePath: relativeFilePath, status: 'error', message: `Unexpected result type/content: ${result.type}` };
            }
        } catch (fileProcessingError) {
            console.error(`    ${logPrefix} ❌ Error during processing for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
            return { filePath: relativeFilePath, status: 'error', message: `File/API Processing Error: ${fileProcessingError instanceof Error ? fileProcessingError.message : "Unknown error"}` };
        }
    };

    const tasks = targetFiles.map(filePath => limit(() => fileProcessor(filePath)));
    const results: FileProcessingResult[] = await Promise.all(tasks);

    // --- Summarize Parallel Results ---
    let successCount = 0, unchangedCount = 0, errorCount = 0;
    results.forEach(res => {
        switch (res.status) {
            case 'updated': successCount++; break;
            case 'unchanged': unchangedCount++; break;
            case 'error': errorCount++; break;
        }
    });
    console.log("\n--- Parallel Modification Summary ---");
    console.log(`  Action: ${args.command}, Files: ${targetFiles.length}, Updated: ${successCount}, Unchanged: ${unchangedCount}, Errors: ${errorCount}`);
    console.log("-----------------------------------");

    if (errorCount > 0) {
        // Throw an error to indicate overall failure to the dispatcher
        throw new Error(`${errorCount} error(s) occurred during ${args.command}.`);
    }
}