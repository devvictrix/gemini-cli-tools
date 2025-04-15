// File: src/gemini/commands/analyze-architecture.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '@shared/types/app.type';
import { getConsolidatedSources } from '@shared/utils/filesystem.utils';
import { writeOutputFile } from '@shared/utils/file-io.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';

/**
 * @constant logPrefix - A constant string used as a prefix for all console logs within this module.
 *  This helps in easily identifying log messages originating from this specific command.
 */
const logPrefix = "[AnalyzeArchitecture]";

/**
 * @constant DEFAULT_OUTPUT_FILENAME - The default filename to use when the user does not provide one.
 *  This provides a sensible default for the output file. Updated to provide a better description.
 */
const DEFAULT_OUTPUT_FILENAME = 'AI_Architecture_Analyzed.md';

/**
 * Executes the AnalyzeArchitecture command. Consolidates code from the target directory,
 * sends it to Gemini for architectural analysis, and saves the result to a Markdown file.
 *
 * @param args - The command line arguments containing the target path, prefix, and output filename.
 *               The `targetPath` specifies the directory to analyze.
 *               The `prefix` (optional) specifies a filename prefix to filter files to analyze.
 *               The `output` (optional) specifies the output filename. If not provided, a default name will be used.
 * @returns A promise that resolves when the analysis and file writing are complete.
 * @throws Error if the command is not AnalyzeArchitecture, the target path is invalid,
 *         consolidation fails, Gemini service fails, or writing the output file fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    // --- Validate Command ---
    // Ensure the command is of the expected type to prevent unexpected behavior.
    if (args.command !== EnhancementType.AnalyzeArchitecture) {
        throw new Error("Handler mismatch: Expected AnalyzeArchitecture command.");
    }

    const { targetPath, prefix } = args;
    // Use provided output or the updated default, ensuring it's treated as a string
    const outputFileName = typeof args.output === 'string' && args.output.trim() !== ''
        ? args.output
        : DEFAULT_OUTPUT_FILENAME;

    console.log(`\n${logPrefix} Analyzing architecture for: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);
    console.log(`  Outputting analysis to: ${outputFileName}`);

    // --- Validate Target Path ---
    // Verify that the target path exists and is a directory before proceeding.
    // This prevents errors later in the process.
    let stats: fs.Stats;
    let absTargetPath: string;
    try {
        absTargetPath = path.resolve(targetPath);
        stats = fs.statSync(absTargetPath);
        if (!stats.isDirectory()) {
            // Specific error for this command's requirement
            throw new Error(`Target path for '${EnhancementType.AnalyzeArchitecture}' must be a directory.`);
        }
    } catch (e) {
        // Catch stat errors (like non-existence) or the explicit directory check error
        throw new Error(`Cannot access target path: '${targetPath}'. Please ensure it exists and is a directory. ${e instanceof Error ? e.message : ''}`);
    }

    // --- Consolidate Code ---
    // Gather all relevant source code files into a single string for analysis.
    // This simplifies the analysis process by providing all code in one place.
    console.log(`\n${logPrefix} Consolidating code from ${absTargetPath}...`);
    const consolidatedCode = await getConsolidatedSources(absTargetPath, prefix);

    // Check if consolidation yielded any meaningful content beyond the header
    // Adjust the line count check based on the actual header lines in getConsolidatedSources
    // The header created by getConsolidatedSources has 7 lines.
    if (consolidatedCode.trim().split('\n').length <= 7) {
        console.warn(`${logPrefix} No relevant source files found in '${targetPath}'${prefix ? ` matching prefix '${prefix}'` : ''}. Architecture analysis cannot proceed.`);
        // Optionally, write an empty/placeholder file or just exit
        // writeOutputFile(path.resolve(process.cwd(), outputFileName), `# Architecture Analysis\n\nNo relevant source files found to analyze in ${targetPath}.`);
        return; // Exit gracefully
    }

    // Additional check for empty code after trimming, as a safety net.
    if (consolidatedCode.trim() === '') { // Should be caught above, but double-check
        console.warn(`${logPrefix} Warning: Consolidated code is empty. Skipping API call.`);
        return;
    }


    // --- Invoke Gemini Service ---
    // Call the Gemini service to analyze the consolidated code and generate an architectural analysis.
    // This is where the AI-powered analysis takes place.
    console.log(`\n${logPrefix} Invoking Gemini service for architectural analysis...`);
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.AnalyzeArchitecture, consolidatedCode);


    // --- Handle Result ---
    // Process the result from the Gemini service, writing it to a file or handling errors.
    // This ensures that the analysis is saved and any issues are reported.
    if (result.type === 'text' && result.content !== null) {
        const outputFilePath = path.resolve(process.cwd(), outputFileName); // Resolve output path relative to CWD
        console.log(`\n${logPrefix} Writing generated architecture analysis to ${outputFileName}...`);
        const success = writeOutputFile(outputFilePath, result.content);
        if (!success) {
            // Throw an error to be caught by the central handler
            throw new Error(`Failed to write architecture analysis file to ${outputFileName}.`);
        } else {
            console.log(`\n${logPrefix} ✅ Successfully generated architecture analysis: ${outputFileName}`);
        }
    } else if (result.type === 'error') {
        // Throw an error to be caught by the central handler
        throw new Error(`Gemini service failed during architecture analysis: ${result.content ?? 'No specific error message provided.'}`);
    } else {
        // Handle unexpected results
        console.warn(`${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text').`);
        if (result.content) {
            console.log("--- Unexpected Content ---");
            console.log(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''));
            console.log("-------------------------");
        }
        throw new Error(`Received unexpected result type '${result.type}' from Gemini during architecture analysis.`);
    }
}