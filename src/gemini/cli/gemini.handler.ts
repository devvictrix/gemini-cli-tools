// src/gemini/cli/gemini.handler.ts
// Contains the core logic for executing the requested CLI command.

import * as fs from 'fs'; // Keep fs for statSync
import * as path from 'path';
import pLimit from 'p-limit'; // Used for AddComments parallelism
import { EXCLUDE_PATTERNS, EXCLUDE_FILENAMES } from '../../shared/constants/filesystem.constants.js';
import { inferTypesFromData } from '../../shared/helpers/type-inference.helper.js';
import { CliArguments, FileProcessingResult, GenerateStructureDocCliArguments, EnhancementCliArguments } from '../../shared/types/app.type.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';
import { getConsolidatedSources, getTargetFiles } from '../../shared/utils/filesystem.utils.js';
import { readSingleFile, updateFileContent, writeOutputFile } from '../../shared/utils/file-io.utils.js';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../gemini.service.js';

const logPrefix = "[GeminiHandler]";

// --- Standard Directory Descriptions (for GenerateStructureDoc) ---
const standardDescriptions: ReadonlyMap<string, string> = new Map([
    ['cli', '# CLI specific logic (commands, handlers)'],
    ['clients', '# Clients for external APIs/services'],
    ['config', '# Configuration loading and access'],
    ['constants', '# Shared constant values (magic strings, keys)'],
    ['controllers', '# Handles incoming requests (HTTP/RPC)'],
    ['database', '# Database connection, migrations, seeding orchestration'],
    ['decorators', '# Custom TypeScript decorators'],
    ['dtos', '# Data Transfer Objects (input/output shapes)'],
    ['entities', '# Domain models or DB schema definitions'],
    ['enums', '# Shared enumerations'],
    ['events', '# Event definitions'],
    ['exceptions', '# Custom error/exception classes'],
    ['fakes', '# Mock/stub implementations for testing'],
    ['guards', '# Authorization/authentication guards'],
    ['handlers', '# Event/message handlers/listeners'],
    ['helpers', '# General-purpose utility functions'],
    ['jobs', '# Background job definitions'],
    ['lib', '# Shared libraries or complex utilities'],
    ['middleware', '# Request/response middleware'],
    ['migrations', '# Database schema migration files'],
    ['policies', '# Complex authorization policies'],
    ['prompts', '# AI prompt templates'],
    ['repositories', '# Data access layer abstraction'],
    ['routes', '# API endpoint definitions'],
    ['schemas', '# Data validation schemas (Zod, Joi, etc.)'],
    ['seeders', '# Database seeding scripts'],
    ['serializers', '# Data transformation utilities'],
    ['services', '# Core business logic'],
    ['shared', '# Shared utilities, types, constants (top-level)'],
    ['shared-modules', '# Shared cross-cutting modules (logging, auth)'],
    ['tests', '# Unit, integration, e2e tests'],
    ['types', '# Shared TypeScript interfaces/types'],
    ['utils', '# Shared utility functions (often more specific than helpers)'],
    ['validators', '# Custom validation logic/rules'],
]);

// --- Recursive Tree Generation Function (for GenerateStructureDoc) ---
/**
 * Recursively scans a directory and generates formatted tree lines.
 */
async function generateTreeLines(
    currentPath: string,
    options: {
        depth: number;
        maxDepth?: number;
        prefix: string;
        useDescriptions: boolean;
        exclusions: Set<string>;
        isLast: boolean;
    }
): Promise<string[]> {
    const { depth, maxDepth, prefix, useDescriptions, exclusions } = options;
    let outputLines: string[] = [];

    if (maxDepth !== undefined && depth > maxDepth) {
        return []; // Stop recursion if max depth is reached
    }

    let entries: string[];
    try {
        entries = await fs.promises.readdir(currentPath);
    } catch (error) {
        console.warn(`${logPrefix} ⚠️ Could not read directory ${currentPath}: ${error instanceof Error ? error.message : error}`);
        return [`${prefix}└── Error reading directory!`];
    }

    // Filter and sort entries
    const filteredEntries = entries
        .filter(entry => !exclusions.has(entry))
        .sort((a, b) => {
            try {
                const statA = fs.statSync(path.join(currentPath, a));
                const statB = fs.statSync(path.join(currentPath, b));
                if (statA.isDirectory() && !statB.isDirectory()) return -1;
                if (!statA.isDirectory() && statB.isDirectory()) return 1;
            } catch { /* Ignore stat errors during sort */ }
            return a.localeCompare(b);
        });

    for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i];
        const entryPath = path.join(currentPath, entry);
        const isLastEntry = i === filteredEntries.length - 1;
        const connector = isLastEntry ? '└── ' : '├── ';
        const linePrefix = prefix + connector;

        let line = linePrefix + entry;
        let isDirectory = false;

        try {
            const stats = await fs.promises.stat(entryPath);
            isDirectory = stats.isDirectory();
            if (isDirectory) {
                line += '/';
                if (useDescriptions && standardDescriptions.has(entry)) {
                    line += ` ${standardDescriptions.get(entry)}`;
                }
            }
            outputLines.push(line);

            if (isDirectory && (maxDepth === undefined || depth < maxDepth)) {
                const nextPrefix = prefix + (isLastEntry ? '    ' : '│   ');
                const childLines = await generateTreeLines(entryPath, {
                    ...options,
                    depth: depth + 1,
                    prefix: nextPrefix,
                    isLast: isLastEntry,
                });
                outputLines = outputLines.concat(childLines);
            }
        } catch (statError) {
            outputLines.push(`${linePrefix}${entry} (Error: ${statError instanceof Error ? statError.message : 'Cannot stat'})`);
            console.warn(`${logPrefix} ⚠️ Could not stat ${entryPath}: ${statError instanceof Error ? statError.message : statError}`);
        }
    }
    return outputLines;
}


// --- Main Command Handler ---
/**
 * The core application logic. Dispatches to appropriate handlers based on the command.
 * @param {CliArguments} argv The parsed arguments object from yargs.
 * @returns {Promise<void>} A promise that resolves when the command logic is complete.
 */
export async function runCommandLogic(argv: CliArguments): Promise<void> {

    // --- Handle GenerateStructureDoc Command ---
    if (argv.command === 'GenerateStructureDoc') {
        const args = argv as GenerateStructureDocCliArguments; // Type assertion
        const { targetPath, output, descriptions, depth, exclude } = args;
        console.log(`\n${logPrefix} Executing action: ${args.command} on target: ${targetPath}`);
        console.log(`  Outputting to: ${output}`);
        if (descriptions) console.log(`  Including descriptions.`);
        if (depth !== undefined) console.log(`  Max depth: ${depth}`);
        if (exclude) console.log(`  Excluding: ${exclude}`);

        try {
            const absTargetPath = path.resolve(targetPath);
            const absOutputPath = path.resolve(output);

            // Validate target exists and is a directory
            if (!fs.existsSync(absTargetPath) || !fs.statSync(absTargetPath).isDirectory()) {
                console.error(`${logPrefix} ❌ Error: Target path '${targetPath}' does not exist or is not a directory.`);
                process.exit(1);
            }

            // Prepare exclusions: Combine standard, user-provided, and the output file itself
            const standardExclusions = new Set([...EXCLUDE_PATTERNS, ...EXCLUDE_FILENAMES]);
            const userExclusions = exclude ? exclude.split(',').map(s => s.trim()).filter(s => s) : [];
            userExclusions.forEach(ex => standardExclusions.add(ex));
            // Prevent infinite loop if output is inside target
            if (absOutputPath.startsWith(path.dirname(absTargetPath))) { // Check if output is potentially inside target
                standardExclusions.add(path.basename(absOutputPath));
            }

            console.log(`${logPrefix} Scanning directory structure...`);
            const treeLines = await generateTreeLines(absTargetPath, {
                depth: 0, // Start at depth 0
                maxDepth: depth, // Use provided depth limit
                prefix: '', // Initial prefix is empty
                useDescriptions: descriptions,
                exclusions: standardExclusions,
                isLast: true, // Root is always 'last' conceptually
            });

            // Format final markdown output
            const outputContent = `${path.basename(absTargetPath)}/\n` + treeLines.join('\n');

            const success = writeOutputFile(absOutputPath, outputContent); // Use shared utility

            if (success) {
                console.log(`\n${logPrefix} ✅ Successfully generated structure document: ${output}`);
            } else {
                console.error(`${logPrefix} ❌ Failed to write structure document.`);
                process.exitCode = 1;
            }

        } catch (error) {
            console.error(`\n${logPrefix} ❌ An unexpected error occurred during ${args.command}:`);
            if (error instanceof Error) {
                console.error(`   Message: ${error.message}`);
                console.error(error.stack); // Show stack for this command's errors
            } else {
                console.error("   Unknown error object:", error);
            }
            process.exit(1);
        }
        console.log(`\n${logPrefix} Execution finished for action: ${args.command}.`);
        return; // Important: Exit after handling this specific command
    }


    // --- Handle EnhancementType Commands ---
    // Check if the command is one of the EnhancementTypes
    else if (Object.values(EnhancementType).includes(argv.command as EnhancementType)) {
        const args = argv as EnhancementCliArguments; // Type assertion
        const { command: action, targetPath, prefix, interfaceName } = args; // Destructure specific args
        const actionDetails = `${prefix ? ` with prefix: ${prefix}` : ''}${interfaceName ? ` (Interface: ${interfaceName})` : ''}`;
        console.log(`\n${logPrefix} Executing enhancement: ${action} on target: ${targetPath}${actionDetails}`);

        // --- Validation specific to EnhancementType commands ---
        let stats: fs.Stats;
        try {
            stats = fs.statSync(targetPath); // Check if the target path exists and get its stats
            // Specific check for InferFromData action, which requires a file
            if (action === EnhancementType.InferFromData && !stats.isFile()) {
                console.error(`\n${logPrefix} ❌ Error: Target path for '${EnhancementType.InferFromData}' must be a file (e.g., JSON).`);
                process.exit(1);
            }
        } catch (e) {
            console.error(`\n${logPrefix} ❌ Error: Cannot access target path: ${targetPath}. Please ensure it exists.`);
            process.exit(1); // Exit if target path is inaccessible
        }

        // --- Classify Action Type ---
        const isModificationAction = [
            EnhancementType.AddComments,
            EnhancementType.AddPathComment,
        ].includes(action);

        const usesGeminiApi = [
            EnhancementType.AddComments,
            EnhancementType.Analyze,
            EnhancementType.Explain,
            EnhancementType.SuggestImprovements,
            EnhancementType.GenerateDocs,
        ].includes(action);

        const isLocalProcessingAction = [
            EnhancementType.Consolidate,
            EnhancementType.InferFromData,
            EnhancementType.AddPathComment,
        ].includes(action);

        // --- Main execution block for EnhancementType commands ---
        try {
            let targetFiles: string[] = []; // Array to hold absolute paths of files to process

            // --- Identify Target Files (Based on original logic) ---
            if (action === EnhancementType.InferFromData) {
                targetFiles.push(path.resolve(targetPath));
                console.log(`${logPrefix} Target for '${action}' is the single file: ${targetPath}`);
            } else if (stats.isDirectory()) {
                console.log(`${logPrefix} Target is a directory. Finding relevant files...`);
                targetFiles = await getTargetFiles(targetPath, prefix); // Use shared utility
                if (targetFiles.length === 0) {
                    console.log(`\n${logPrefix} No relevant files found matching criteria. Exiting.`);
                    return; // Nothing to do
                }
                console.log(`${logPrefix} Found ${targetFiles.length} files to process for action '${action}'.`);
            } else if (stats.isFile()) {
                const filename = path.basename(targetPath);
                if (EXCLUDE_FILENAMES.has(filename)) { // Use shared constant
                    console.log(`${logPrefix} Target file ${filename} is excluded by configuration.`);
                    return; // Skip excluded files
                }
                console.log(`${logPrefix} Target is a single file for action '${action}'.`);
                targetFiles.push(path.resolve(targetPath));
            }

            // --- Process Based on Action Type (Based on original logic) ---

            // A) Actions that modify files and might use Gemini (currently only AddComments)
            if (isModificationAction && action === EnhancementType.AddComments) {
                // --- PARALLEL MODIFICATION FLOW (AddComments) ---
                const concurrencyLimit = 5;
                const limit = pLimit(concurrencyLimit);
                console.log(`\n${logPrefix} Starting PARALLEL modification action '${action}' on ${targetFiles.length} file(s) with concurrency ${concurrencyLimit}...`);

                const fileProcessor = async (absoluteFilePath: string): Promise<FileProcessingResult> => {
                    const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
                    try {
                        const originalCode = readSingleFile(absoluteFilePath); // Use shared utility
                        const result: GeminiEnhancementResult = await enhanceCodeWithGemini(action, originalCode); // Call service

                        if (result.type === 'code' && result.content !== null) {
                            if (originalCode.trim() !== result.content.trim()) {
                                const updated = updateFileContent(absoluteFilePath, result.content); // Use shared utility
                                return { filePath: relativeFilePath, status: updated ? 'updated' : 'error', message: updated ? undefined : 'File write failed' };
                            } else {
                                console.log(`    ${logPrefix} No changes needed for ${relativeFilePath}.`);
                                return { filePath: relativeFilePath, status: 'unchanged' };
                            }
                        } else if (result.type === 'error') {
                            console.error(`    ${logPrefix} ❌ Gemini failed for ${relativeFilePath}: ${result.content}`);
                            return { filePath: relativeFilePath, status: 'error', message: `Gemini Error: ${result.content}` };
                        } else {
                            console.warn(`    ${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'code') for ${relativeFilePath}.`);
                            return { filePath: relativeFilePath, status: 'error', message: `Unexpected result type/content: ${result.type}` };
                        }
                    } catch (fileProcessingError) {
                        console.error(`    ${logPrefix} ❌ Error during Gemini processing for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
                        return { filePath: relativeFilePath, status: 'error', message: `File/API Processing Error: ${fileProcessingError instanceof Error ? fileProcessingError.message : "Unknown error"}` };
                    }
                };

                const tasks = targetFiles.map(filePath => limit(() => fileProcessor(filePath)));
                const results: FileProcessingResult[] = await Promise.all(tasks);

                // --- Summarize Parallel Results ---
                let successCount = 0;
                let unchangedCount = 0;
                let errorCount = 0;
                results.forEach(res => {
                    switch (res.status) {
                        case 'updated': successCount++; break;
                        case 'unchanged': unchangedCount++; break;
                        case 'error': errorCount++; break;
                    }
                });
                console.log("\n--- Parallel Modification Summary ---");
                console.log(`  Action:              ${action}`);
                console.log(`  Total Files Targeted:  ${targetFiles.length}`);
                console.log(`  Successfully Updated:  ${successCount}`);
                console.log(`  No Changes Needed:   ${unchangedCount}`);
                console.log(`  Errors Encountered:    ${errorCount}`);
                console.log("-----------------------------------");
                if (errorCount > 0) process.exitCode = 1;

                // B) Actions that use Gemini but DO NOT modify files (Analyze, Explain, Suggest, GenerateDocs)
            } else if (usesGeminiApi && !isModificationAction) {
                // --- NON-MODIFICATION FLOW using GEMINI ---
                let codeToProcess: string;
                const geminiRequestType = action; // Keep track of the original action requested

                // Consolidate code if multiple files are targeted or if the target is a directory
                if (stats.isDirectory() || targetFiles.length > 1) {
                    console.log(`\n${logPrefix} Consolidating ${targetFiles.length} file(s) for Gemini action '${action}'...`);
                    const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetFiles[0]);
                    codeToProcess = await getConsolidatedSources(consolidationRoot, prefix); // Use shared utility
                } else if (targetFiles.length === 1) {
                    // Read single file if only one target
                    console.log(`\n${logPrefix} Reading single file for Gemini action '${action}'...`);
                    codeToProcess = readSingleFile(targetFiles[0]); // Use shared utility
                } else {
                    console.error(`${logPrefix} Internal Error: No target files identified for Gemini action '${action}'.`);
                    process.exitCode = 1;
                    return;
                }

                if (codeToProcess.trim() === '') {
                    console.warn(`${logPrefix} Warning: Content to send to Gemini for action '${action}' is empty. Skipping API call.`);
                    return;
                }

                console.log(`\n${logPrefix} Invoking Gemini service for action: ${geminiRequestType}...`);
                const result: GeminiEnhancementResult = await enhanceCodeWithGemini(geminiRequestType, codeToProcess); // Call service

                // --- Handle Gemini Result ---
                if (result.type === 'text' && result.content !== null) {
                    if (geminiRequestType === EnhancementType.GenerateDocs) {
                        const outputFileName = 'README.md';
                        const outputFilePath = path.resolve(process.cwd(), outputFileName);
                        console.log(`\n${logPrefix} Attempting to write generated documentation to ${outputFileName}...`);
                        const success = writeOutputFile(outputFilePath, result.content); // Use shared utility
                        if (!success) {
                            console.error(`${logPrefix} ❌ Failed to write documentation file.`);
                            process.exitCode = 1;
                        } else {
                            console.log(`\n${logPrefix} ✅ Generated documentation saved to: ${outputFileName}`);
                        }
                    } else {
                        // For Analyze, Explain, Suggest, print to console
                        console.log(`\n--- Gemini ${geminiRequestType} Result ---`);
                        console.log(result.content);
                        console.log(`--- End ${geminiRequestType} Result ---\n`);
                    }
                } else if (result.type === 'error') {
                    console.error(`\n${logPrefix} ❌ Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
                    process.exitCode = 1;
                } else {
                    console.warn(`${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text') for ${geminiRequestType} action.`);
                    if (result.content) {
                        console.log("--- Unexpected Content Received ---");
                        console.log(result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''));
                        console.log("----------------------------------");
                    }
                    process.exitCode = 1;
                }

                // C) Actions processed locally WITHOUT Gemini (Consolidate, InferFromData, AddPathComment)
            } else if (isLocalProcessingAction) {
                // --- LOCAL PROCESSING FLOW ---
                console.log(`\n${logPrefix} Starting local action '${action}'...`);

                // C.1) Consolidate Files
                if (action === EnhancementType.Consolidate) {
                    console.log(`${logPrefix} Consolidating ${targetFiles.length} file(s)...`);
                    const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetPath);
                    console.log(`${logPrefix} Consolidating from root: ${consolidationRoot} ${prefix ? `with prefix '${prefix}'` : ''}...`);
                    const consolidatedContent = await getConsolidatedSources(consolidationRoot, prefix); // Use shared utility
                    const outputFileName = 'consolidated_output.txt';
                    const outputFilePath = path.resolve(process.cwd(), outputFileName);
                    const success = writeOutputFile(outputFilePath, consolidatedContent); // Use shared utility
                    if (!success) process.exitCode = 1;
                    else console.log(`\n${logPrefix} ✅ You can now find consolidated content in: ${outputFileName}`);

                    // C.2) Infer Types from Data File
                } else if (action === EnhancementType.InferFromData) {
                    if (!interfaceName) {
                        console.error("[App] Internal Error: Interface name missing for InferFromData.");
                        process.exit(1);
                    }
                    const dataFilePath = targetFiles[0];
                    const relativeDataFilePath = path.relative(process.cwd(), dataFilePath).split(path.sep).join('/');
                    console.log(`${logPrefix} Inferring types from data file: ${relativeDataFilePath}`);
                    try {
                        const fileContent = readSingleFile(dataFilePath); // Use shared utility
                        let data: any;
                        try {
                            data = JSON.parse(fileContent);
                        } catch (parseError) {
                            console.error(`${logPrefix} ❌ Error parsing JSON data from ${relativeDataFilePath}: ${parseError instanceof Error ? parseError.message : parseError}`);
                            process.exit(1);
                        }
                        const inferredInterface = inferTypesFromData(interfaceName, data); // Use shared helper
                        console.log(`\n--- Inferred Interface: ${interfaceName} ---`);
                        console.log(inferredInterface);
                        console.log(`--- End Interface ---`);
                    } catch (inferenceError) {
                        console.error(`${logPrefix} ❌ Error during type inference for ${relativeDataFilePath}: ${inferenceError instanceof Error ? inferenceError.message : inferenceError}`);
                        process.exit(1);
                    }

                    // C.3) Add Path Comment Header (Local Modification)
                } else if (action === EnhancementType.AddPathComment) {
                    console.log(`\n${logPrefix} Starting SEQUENTIAL action '${action}' on ${targetFiles.length} file(s)...`);
                    let updatedCount = 0;
                    let unchangedCount = 0;
                    let skippedCount = 0;
                    let errorCount = 0;

                    const nonCommentableExtensions = new Set(['.json', '.env']);
                    const anyCommentRegex = /^\s*(\/\/.*|#.*)/; // Simple regex for JS/TS/Shell comments

                    // Process files one by one
                    for (const absoluteFilePath of targetFiles) {
                        const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
                        const fileExtension = path.extname(absoluteFilePath).toLowerCase();

                        if (nonCommentableExtensions.has(fileExtension)) {
                            console.log(`    ${logPrefix} ⏩ Skipping non-commentable file type: ${relativeFilePath}`);
                            skippedCount++;
                            continue;
                        }

                        try {
                            const pathComment = `// File: ${relativeFilePath}`;
                            const originalCode = readSingleFile(absoluteFilePath); // Use shared utility
                            const lines = originalCode.split(/\r?\n/);

                            // Check if file is already correctly formatted
                            let firstNonBlankLineIndex = -1;
                            let firstNonBlankLine = '';
                            for (let i = 0; i < lines.length; i++) {
                                const trimmedLine = lines[i].trim();
                                if (trimmedLine !== '') {
                                    firstNonBlankLineIndex = i;
                                    firstNonBlankLine = trimmedLine;
                                    break;
                                }
                            }

                            let alreadyCorrect = false;
                            if (firstNonBlankLineIndex === 0 && firstNonBlankLine === pathComment) {
                                if (lines.length === 1 || (lines.length > 1 && lines[1].trim() === '')) {
                                    alreadyCorrect = true;
                                }
                            }

                            if (alreadyCorrect) {
                                console.log(`    ${logPrefix} ✅ No update needed for ${relativeFilePath} (Correct header found)`);
                                unchangedCount++;
                                continue;
                            }

                            // File needs changes
                            console.log(`    ${logPrefix} 🔄 Updating header for ${relativeFilePath}...`);

                            // Find the index of the first actual code line (skip blanks and comments)
                            let firstCodeLineIndex = 0;
                            while (firstCodeLineIndex < lines.length) {
                                const lineTrim = lines[firstCodeLineIndex].trim();
                                if (lineTrim === '' || anyCommentRegex.test(lineTrim)) {
                                    firstCodeLineIndex++;
                                } else {
                                    break; // Found the first non-blank, non-comment line
                                }
                            }

                            const codeContentLines = lines.slice(firstCodeLineIndex);
                            const codeContent = codeContentLines.length > 0 ? codeContentLines.join('\n') : '';
                            const newCode = `${pathComment}\n\n${codeContent}`;

                            const updated = updateFileContent(absoluteFilePath, newCode); // Use shared utility
                            if (updated) updatedCount++; else errorCount++;

                        } catch (fileProcessingError) {
                            console.error(`    ${logPrefix} ❌ Error during AddPathComment for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
                            errorCount++;
                        }
                    } // End for loop

                    // --- Summarize Sequential Results ---
                    console.log("\n--- Sequential Action Summary ---");
                    console.log(`  Action:              ${action}`);
                    console.log(`  Total Files Targeted:  ${targetFiles.length}`);
                    console.log(`  Successfully Updated:  ${updatedCount}`);
                    console.log(`  No Changes Needed:   ${unchangedCount}`);
                    console.log(`  Skipped (Non-Comment): ${skippedCount}`);
                    console.log(`  Errors Encountered:    ${errorCount}`);
                    console.log("---------------------------------");
                    if (errorCount > 0) process.exitCode = 1;
                }
            } else {
                // Fallback for unhandled action types
                console.error(`${logPrefix} Internal Error: Enhancement action "${action}" was not handled by any processing flow.`);
                process.exit(1);
            }

        } catch (error) {
            // Catch-all for unexpected errors during enhancement logic execution
            console.error(`\n${logPrefix} ❌ An unexpected error occurred during enhancement action ${action}:`);
            if (error instanceof Error) {
                console.error(`   Message: ${error.message}`);
                console.error(error.stack); // Show stack trace for these errors
            } else {
                console.error("   Unknown error object:", error);
            }
            process.exit(1); // Exit with failure code
        }
        console.log(`\n${logPrefix} Execution finished for action: ${action}.`);

    } else {
        // This case should ideally not be reached if yargs demands a command
        console.error(`${logPrefix} ❌ Internal Error: Unrecognized command type received: ${argv.command}`);
        process.exit(1);
    }

} // End runCommandLogic