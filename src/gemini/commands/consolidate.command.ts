// src/gemini/commands/consolidate.command.ts
import path from 'path';
import fs from 'fs';
import { CliArguments } from '../../shared/types/app.type.js';
import { getConsolidatedSources } from '../../shared/utils/filesystem.utils.js';
import { writeOutputFile } from '../../shared/utils/file-io.utils.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[Consolidate]";

export async function execute(args: CliArguments): Promise<void> {
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

    const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetPath);
    console.log(`${logPrefix} Consolidating from root: ${consolidationRoot}...`);

    const consolidatedContent = await getConsolidatedSources(consolidationRoot, prefix);

    if (consolidatedContent.trim().split('\n').length <= 7) { // Check if only header exists
        console.warn(`${logPrefix} No files found to consolidate matching criteria in ${consolidationRoot}. Output file not written.`);
        return;
    }

    const outputFileName = 'consolidated_output.txt';
    const outputFilePath = path.resolve(process.cwd(), outputFileName);
    const success = writeOutputFile(outputFilePath, consolidatedContent);

    if (!success) {
        throw new Error(`Failed to write consolidated output to ${outputFileName}`);
    } else {
        console.log(`\n${logPrefix} ✅ Consolidated content saved to: ${outputFileName}`);
    }
}