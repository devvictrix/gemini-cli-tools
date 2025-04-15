// File: src/gemini/commands/consolidate.command.ts

import path from 'path';
import fs from 'fs';
import { CliArguments } from '../../shared/types/app.type.js';
import { getConsolidatedSources } from '../../shared/utils/filesystem.utils.js';
import { writeOutputFile } from '../../shared/utils/file-io.utils.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[Consolidate]";

/**
 * Executes the consolidation command.  This command consolidates files from a specified target path,
 * optionally filtering by a prefix, and writes the consolidated content to a file.
 * @param args The command line arguments, including the target path and optional prefix.
 * @throws Error if the command is not 'Consolidate', if the target path is inaccessible, or if writing the output file fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Validate that the command matches the expected type.
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
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    // Determine the consolidation root directory. If the targetPath is a file, the root is its parent directory; otherwise, it's the targetPath itself.
    const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetPath);
    console.log(`${logPrefix} Consolidating from root: ${consolidationRoot}...`);

    // Get the consolidated sources based on the root directory and optional prefix.  This is where the main logic of file processing occurs.
    const consolidatedContent = await getConsolidatedSources(consolidationRoot, prefix);

    // Check if any files were found to consolidate.  The magic number '7' probably corresponds to the number of lines in the header `getConsolidatedSources` adds by default, so this is a check to see if any content was added *after* the header. Consider making this more robust.
    if (consolidatedContent.trim().split('\n').length <= 7) { // Check if only header exists
        console.warn(`${logPrefix} No files found to consolidate matching criteria in ${consolidationRoot}. Output file not written.`);
        return;
    }

    // Define the output file name and path.
    const outputFileName = 'consolidated_output.txt';
    const outputFilePath = path.resolve(process.cwd(), outputFileName); // Resolves the output file path relative to the current working directory.

    // Write the consolidated content to the output file.
    const success = writeOutputFile(outputFilePath, consolidatedContent);

    // Handle potential errors during file writing.
    if (!success) {
        throw new Error(`Failed to write consolidated output to ${outputFileName}`);
    } else {
        console.log(`\n${logPrefix} ✅ Consolidated content saved to: ${outputFileName}`);
    }
}