// File: src/gemini/commands/consolidate.command.ts

import path from 'path';
import fs from 'fs';
import { CliArguments } from '@shared/types/app.type';
import { getConsolidatedSources } from '@shared/utils/filesystem.utils';
import { writeOutputFile } from '@shared/utils/file-io.utils';
import { EnhancementType } from '@/gemini/types/enhancement.type';

/**
 * @constant logPrefix - The prefix used for logging messages in this module.  Provides a consistent way to identify log messages originating from this file.
 */
const logPrefix = "[Consolidate]";

/**
 * Executes the consolidation command. This command reads files from a specified target path,
 * optionally filtering them by a prefix, and writes the combined content to a single output file.
 *
 * @param {CliArguments} args The command line arguments, including the target path and optional prefix.
 *                             The `targetPath` specifies the directory or file to consolidate from.
 *                             The `prefix` (optional) filters files based on their names.
 *                             The `command` argument must be `EnhancementType.Consolidate` for this function to execute correctly.
 * @returns {Promise<void>} A promise that resolves when the consolidation process is complete.
 * @throws {Error} If the command is not 'Consolidate', if the target path is inaccessible, or if writing the output file fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Validate that the command matches the expected type. This ensures that the correct handler is being used.
    if (args.command !== EnhancementType.Consolidate) {
        throw new Error("Handler mismatch: Expected Consolidate command.");
    }
    const { targetPath, prefix } = args;

    console.log(`\n${logPrefix} Consolidating files from: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}...`);

    // Validate targetPath exists (can be file or dir for consolidation root finding)
    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath);
    } catch (e) {
        // Throw an error if the target path is inaccessible, informing the user to check if it exists.
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    // Determine the consolidation root directory.
    // If the targetPath is a file, the root is its parent directory; otherwise, it's the targetPath itself.
    // This allows the user to specify a single file as the 'targetPath' and the tool will consolidate other files in that same directory based on the optional prefix
    const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetPath);
    console.log(`${logPrefix} Consolidating from root: ${consolidationRoot}...`);

    // Get the consolidated sources based on the root directory and optional prefix. This function handles the core logic of traversing the filesystem and reading file contents.
    const consolidatedContent = await getConsolidatedSources(consolidationRoot, prefix);

    // Check if any files were found to consolidate.  The magic number '7' probably corresponds to the number of lines in the header `getConsolidatedSources` adds by default, so this is a check to see if any content was added *after* the header. Consider making this more robust.
    // If the content only consists of the header, it indicates that no files matching the criteria were found.
    // The `getConsolidatedSources` function includes a header.
    const consolidatedContentLines = consolidatedContent.trim().split('\n');
    if (consolidatedContentLines.length <= 7) { // Check if only header exists
        console.warn(`${logPrefix} No files found to consolidate matching criteria in ${consolidationRoot}. Output file not written.`);
        return;
    }

    // Define the output file name and path.
    const outputFileName = 'consolidated_output.txt';
    // Resolves the output file path relative to the current working directory.  Ensures the output is placed in a predictable location.
    const outputFilePath = path.resolve(process.cwd(), outputFileName);

    // Write the consolidated content to the output file.
    const success = writeOutputFile(outputFilePath, consolidatedContent);

    // Handle potential errors during file writing.
    if (!success) {
        // Throw an error if writing to the output file fails, providing information about the failure.
        throw new Error(`Failed to write consolidated output to ${outputFileName}`);
    } else {
        console.log(`\n${logPrefix} ✅ Consolidated content saved to: ${outputFileName}`);
    }
}