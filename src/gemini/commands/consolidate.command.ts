// File: src/gemini/commands/consolidate.command.ts

import path from 'path';
import fs from 'fs';
import { CliArguments } from '@shared/types/app.type';
import { getConsolidatedSources } from '@shared/utils/filesystem.utils';
import { writeOutputFile } from '@shared/utils/file-io.utils';
import { EnhancementType } from '@/gemini/types/enhancement.type';

const logPrefix = "[Consolidate]";

/**
 * Executes the consolidation command. Reads files from a specified target path,
 * applying an optional pattern or prefix filter, and writes the combined content
 * to a single output file. The pattern filter takes precedence over the prefix filter.
 *
 * @param {CliArguments} args The command line arguments, including targetPath and optional pattern/prefix.
 * @returns {Promise<void>} A promise that resolves when consolidation is complete.
 * @throws {Error} If validation fails or file system/write errors occur.
 */
export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.Consolidate) {
        throw new Error("Handler mismatch: Expected Consolidate command.");
    }
    // Get targetPath, prefix, and the new pattern
    const { targetPath, prefix, pattern } = args;

    // Determine active filter for logging
    let filterLog = "";
    if (pattern) {
        filterLog = ` with pattern '${pattern}'`;
    } else if (prefix) {
        filterLog = ` with prefix '${prefix}'`;
    }

    console.log(`\n${logPrefix} Consolidating files from: ${targetPath}${filterLog}...`);

    // Validate targetPath exists
    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath);
    } catch (e) {
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetPath);
    console.log(`${logPrefix} Consolidating from root: ${consolidationRoot}...`);

    // <<< MODIFIED HERE: Pass pattern AND prefix to getConsolidatedSources >>>
    // The utility function will prioritize the pattern if it exists.
    const consolidatedContent = await getConsolidatedSources(consolidationRoot, prefix, pattern);

    // Check if any files were found (same check as before)
    const consolidatedContentLines = consolidatedContent.trim().split('\n');
    const headerLineCount = 7; // Assuming the header is still 7 lines
    if (consolidatedContentLines.length <= headerLineCount) {
        console.warn(`${logPrefix} No files found to consolidate matching criteria in ${consolidationRoot}. Output file not written.`);
        return;
    }

    // Define the output file name and path (same as before)
    const outputFileName = 'consolidated_output.txt';
    const outputFilePath = path.resolve(process.cwd(), outputFileName);

    // Write the output file (same as before)
    const success = writeOutputFile(outputFilePath, consolidatedContent);

    if (!success) {
        throw new Error(`Failed to write consolidated output to ${outputFileName}`);
    } else {
        console.log(`\n${logPrefix} ✅ Consolidated content saved to: ${outputFileName}`);
    }
}