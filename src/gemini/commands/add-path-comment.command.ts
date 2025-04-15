// File: src/gemini/commands/add-path-comment.command.ts

import path from 'path';
import fs from 'fs';
import { CliArguments } from '@shared/types/app.type';
import { getTargetFiles } from '@shared/utils/filesystem.utils';
import { readSingleFile, updateFileContent } from '@shared/utils/file-io.utils';
import { EnhancementType } from '@/gemini/types/enhancement.type';

/**
 * @const {string} logPrefix - A constant string used as a prefix for all log messages from this module.
 * This helps in identifying the source of the log messages.
 */
const logPrefix = "[AddPathComment]";

/**
 * Executes the AddPathComment command, adding a comment to the beginning of each target file
 * indicating its relative path. The comment is added only if it's not already present.
 *
 * @param {CliArguments} args - The command line arguments, including the target path and optional prefix.
 *   The `targetPath` specifies the directory to process, and the `prefix` is an optional file prefix filter.
 * @returns {Promise<void>} A promise that resolves when all files have been processed.
 * @throws {Error} Throws an error if the command is not AddPathComment, the target path is inaccessible,
 *   or errors occur during file processing.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Validate that the correct command is being executed.
    if (args.command !== EnhancementType.AddPathComment) {
        throw new Error("Handler mismatch: Expected AddPathComment command.");
    }
    const { targetPath, prefix } = args;

    console.log(`\n${logPrefix} Finding files in: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    // Optional: Re-validate targetPath exists and is accessible. This provides early failure if the path is invalid.
    try {
        fs.statSync(targetPath);
    } catch (e) {
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    // Get the list of target files based on the provided path and prefix.
    const targetFiles = await getTargetFiles(targetPath, prefix);

    // Exit early if no files are found. Prevents unnecessary processing.
    if (targetFiles.length === 0) {
        console.log(`\n${logPrefix} No relevant files found matching criteria. Exiting.`);
        return;
    }

    console.log(`\n${logPrefix} Starting SEQUENTIAL action '${args.command}' on ${targetFiles.length} file(s)...`);
    let updatedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    /**
     * @const {Set<string>} nonCommentableExtensions - A Set containing file extensions that should not be commented.
     * Files with these extensions will be skipped during processing.
     * This is done to avoid adding comments to file types that typically don't have them (e.g., JSON, environment files).
     */
    const nonCommentableExtensions = new Set(['.json', '.env']);
    /**
     * @const {RegExp} anyCommentRegex - A regular expression to detect existing comments in JS/TS/Shell style.
     * Used to identify lines that are already commented out, preventing the addition of redundant comments.
     */
    const anyCommentRegex = /^\s*(\/\/.*|#.*)/; // Simple regex for JS/TS/Shell comments

    // Iterate through each target file. Using a standard 'for...of' loop for sequential processing.
    for (const absoluteFilePath of targetFiles) {
        // Get the relative file path for use in the comment.
        // Makes the comment more user-friendly, showing the path relative to the project root.
        const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
        // Extract the file extension to determine if it should be skipped.
        const fileExtension = path.extname(absoluteFilePath).toLowerCase();

        // Skip files with non-commentable extensions.
        if (nonCommentableExtensions.has(fileExtension)) {
            console.log(`    ${logPrefix} ⏩ Skipping non-commentable file type: ${relativeFilePath}`);
            skippedCount++;
            continue;
        }

        try {
            // Construct the comment string containing the relative file path.
            const pathComment = `// File: ${relativeFilePath}`;
            // Read the original content of the file.
            const originalCode = readSingleFile(absoluteFilePath);
            // Split the content into lines for easier manipulation.
            const lines = originalCode.split(/\r?\n/);

            // Check if file is already correctly formatted (i.e. the comment exists on the first line).
            // This avoids adding duplicate comments if the file has already been processed.
            let firstNonBlankLineIndex = lines.findIndex(line => line.trim() !== '');
            if (firstNonBlankLineIndex === -1) firstNonBlankLineIndex = 0; // Handle empty file
            const firstNonBlankLine = lines[firstNonBlankLineIndex]?.trim() ?? ''; // Use nullish coalescing operator

            let alreadyCorrect = false;
            // Check if the first non-blank line is the correct comment and if it is followed by a blank line (or is the only line).
            // We check for the exact comment and ensure there is a blank line after the comment.
            if (firstNonBlankLineIndex === 0 && firstNonBlankLine === pathComment && (lines.length === 1 || (lines.length > 1 && lines[1].trim() === ''))) {
                alreadyCorrect = true;
            }

            // If the file is already correctly formatted, skip it.
            if (alreadyCorrect) {
                console.log(`    ${logPrefix} ✅ No update needed for ${relativeFilePath} (Correct header found)`);
                unchangedCount++;
                continue;
            }

            // File needs changes - add the comment.
            console.log(`    ${logPrefix} 🔄 Updating header for ${relativeFilePath}...`);

            // Find the index of the first line of actual code (skipping empty lines and existing comments).
            // We iterate through the lines to find the first line that is not empty or a comment.
            let firstCodeLineIndex = 0;
            while (firstCodeLineIndex < lines.length && (lines[firstCodeLineIndex].trim() === '' || anyCommentRegex.test(lines[firstCodeLineIndex].trim()))) {
                firstCodeLineIndex++;
            }

            // Extract the code content (everything after the existing comments and blank lines).
            const codeContentLines = lines.slice(firstCodeLineIndex);
            const codeContent = codeContentLines.length > 0 ? codeContentLines.join('\n') : '';
            // Construct the new code with the path comment at the beginning.
            const newCode = `${pathComment}\n\n${codeContent}`;

            // Update the file content.
            const updated = updateFileContent(absoluteFilePath, newCode);
            if (updated) updatedCount++; else errorCount++;

        } catch (fileProcessingError) {
            // Log any errors that occur during file processing.
            console.error(`    ${logPrefix} ❌ Error during processing for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
            errorCount++;
        }
    } // End for loop (Iterate over targetFiles)

    // --- Summarize Sequential Results ---
    console.log("\n--- Sequential Action Summary ---");
    console.log(`  Action:              ${args.command}`);
    console.log(`  Total Files Targeted:  ${targetFiles.length}`);
    console.log(`  Successfully Updated:  ${updatedCount}`);
    console.log(`  No Changes Needed:   ${unchangedCount}`);
    console.log(`  Skipped (Non-Comment): ${skippedCount}`);
    console.log(`  Errors Encountered:    ${errorCount}`);
    console.log("---------------------------------");

    // If errors occurred during processing, throw an error.
    if (errorCount > 0) {
        throw new Error(`${errorCount} error(s) occurred during ${args.command}.`);
    }
}