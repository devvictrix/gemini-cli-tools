import path from 'path';
import fs from 'fs'; // Needed for statSync if re-validating path
import { CliArguments, FileProcessingResult } from '@shared/types/app.type';
import { getTargetFiles } from '@shared/utils/filesystem.utils';
import { readSingleFile, updateFileContent } from '@shared/utils/file-io.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';

const logPrefix = "[AddComments]";

/**
 * Executes the add comments command. This function orchestrates the process of finding target files,
 * enhancing them with comments using the Gemini service, and updating the files with the enhanced code.
 * Files are processed sequentially to avoid overwhelming the Gemini API and to maintain a predictable state.
 *
 * @param args - The command line arguments, including the target path, prefix, and command type.
 * @returns A promise that resolves when the command has completed.  The promise does not return any value,
 *          but it rejects if a significant error occurs during the process, such as an invalid command or unrecoverable file access issues.
 * @throws An error if the command type is incorrect, the target path is inaccessible, or if errors occur during file processing that prevent the command from completing successfully.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Specific command validation/logic could go here if needed
    if (args.command !== EnhancementType.AddComments) {
        throw new Error("Handler mismatch: Expected AddComments command.");
    }
    const { targetPath, prefix } = args;

    console.log(`\n${logPrefix} Finding files in: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    // Optional: Re-validate targetPath exists and is accessible if needed
    // This is an extra safety check to ensure that the target path is still valid and accessible
    // before proceeding with file processing.  It helps prevent errors due to deleted or inaccessible directories.
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

    // --- SEQUENTIAL MODIFICATION FLOW ---
    console.log(`\n${logPrefix} Starting SEQUENTIAL modification action on ${targetFiles.length} file(s)...`);
    const results: FileProcessingResult[] = []; // Initialize results array to track the outcome of each file processing operation.

    /**
     * Processes a single file, enhancing it with comments from the Gemini service.
     * This function reads the file content, sends it to Gemini for comment enhancement,
     * and then updates the file with the enhanced code if changes are made.
     *
     * @param absoluteFilePath - The absolute path to the file to process.
     * @returns A promise that resolves with a FileProcessingResult indicating the outcome of the processing.
     *          The FileProcessingResult includes the file path, the status of the operation (updated, unchanged, or error),
     *          and an optional error message.
     */
    const fileProcessor = async (absoluteFilePath: string): Promise<FileProcessingResult> => {
        const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
        console.log(`    ${logPrefix} Processing: ${relativeFilePath}`); // Add log for which file is being processed
        try {
            const originalCode = readSingleFile(absoluteFilePath);
            const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.AddComments, originalCode);

            if (result.type === 'code' && result.content !== null) {
                // Gemini returned code, proceed with comparison and update
                if (originalCode.trim() !== result.content.trim()) {
                    // The enhanced code is different from the original code, update the file
                    const updated = updateFileContent(absoluteFilePath, result.content);
                    return { filePath: relativeFilePath, status: updated ? 'updated' : 'error', message: updated ? undefined : 'File write failed' };
                } else {
                    // The enhanced code is the same as the original code, no changes needed
                    console.log(`    ${logPrefix} No changes needed for ${relativeFilePath}.`);
                    return { filePath: relativeFilePath, status: 'unchanged' };
                }
            } else if (result.type === 'error') {
                // Gemini returned an error, log the error and return an error result
                console.error(`    ${logPrefix} ❌ Gemini failed for ${relativeFilePath}: ${result.content}`);
                return { filePath: relativeFilePath, status: 'error', message: `Gemini Error: ${result.content}` };
            } else {
                // Gemini returned an unexpected result, log a warning and return an error result
                console.warn(`    ${logPrefix} ⚠️ Unexpected result type/content for ${relativeFilePath}.`);
                return { filePath: relativeFilePath, status: 'error', message: `Unexpected result type/content: ${result.type}` };
            }
        } catch (fileProcessingError) {
            // An error occurred during file processing, log the error and return an error result
            console.error(`    ${logPrefix} ❌ Error during processing for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
            return { filePath: relativeFilePath, status: 'error', message: `File/API Processing Error: ${fileProcessingError instanceof Error ? fileProcessingError.message : "Unknown error"}` };
        }
    };

    // Process files one by one
    // Iterating sequentially ensures that we don't overload the Gemini API and allows for easier debugging.
    for (const filePath of targetFiles) {
        try {
            const result = await fileProcessor(filePath); // Await the processor directly
            results.push(result);
        } catch (loopError) {
            // Catch errors during the processing of a single file if fileProcessor doesn't handle everything
            const relativePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
            console.error(`    ${logPrefix} ❌ Uncaught error processing ${relativePath} in loop: ${loopError instanceof Error ? loopError.message : loopError}`);
            results.push({
                filePath: relativePath,
                status: 'error',
                message: `Loop Error: ${loopError instanceof Error ? loopError.message : "Unknown error"}`
            });
        }
    }

    // --- Summarize Sequential Results ---
    let successCount = 0, unchangedCount = 0, errorCount = 0;
    results.forEach(res => {
        switch (res.status) {
            case 'updated': successCount++; break;
            case 'unchanged': unchangedCount++; break;
            case 'error': errorCount++; break;
        }
    });
    console.log("\n--- Sequential Modification Summary ---");
    console.log(`  Action: ${args.command}, Files: ${targetFiles.length}, Updated: ${successCount}, Unchanged: ${unchangedCount}, Errors: ${errorCount}`);
    console.log("-----------------------------------");

    if (errorCount > 0) {
        // Throw an error to indicate overall failure to the dispatcher
        // This allows the calling process to know that the command did not complete successfully
        // and take appropriate action, such as retrying the command or notifying the user.
        throw new Error(`${errorCount} error(s) occurred during ${args.command}.`);
    }
}