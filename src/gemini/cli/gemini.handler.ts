// src/gemini/cli/gemini.handler.ts

import * as fs from 'fs'; // Keep fs for statSync
import * as path from 'path';
import pLimit from 'p-limit';
import { EXCLUDE_FILENAMES } from '../../shared/constants/filesystem.constants.js'; // Updated path
import { inferTypesFromData } from '../../shared/helpers/type-inference.helper.js'; // Updated path
import { CliArguments, FileProcessingResult } from '../../shared/types/app.type.js'; // Updated path
import { EnhancementType } from '../../shared/enums/enhancement.type.js';
import { getConsolidatedSources, getTargetFiles } from '../../shared/utils/filesystem.utils.js';
import { readSingleFile, updateFileContent, writeOutputFile } from '../../shared/utils/file-io.utils.js';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../gemini.service.js';

const logPrefix = "[GeminiHandler]";

/**
 * The core application logic. Parses arguments, identifies target files,
 * and executes the requested action (local or via Gemini API).
 * @param {CliArguments} argv The parsed arguments object from yargs.
 * @returns {Promise<void>} A promise that resolves when the command logic is complete.
 */
export async function runCommandLogic(argv: CliArguments): Promise<void> {
    const { command: action, targetPath, prefix, interfaceName } = argv;
    const actionDetails = `${prefix ? ` with prefix: ${prefix}` : ''}${interfaceName ? ` (Interface: ${interfaceName})` : ''}`;
    console.log(`\n${logPrefix} Executing action: ${action} on target: ${targetPath}${actionDetails}`);

    // --- Validate Target Path ---
    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath); // Check if the target path exists and get its stats
    } catch (e) {
        console.error(`\n${logPrefix} ❌ Error: Cannot access target path: ${targetPath}. Please ensure it exists.`);
        process.exit(1); // Exit if target path is inaccessible
    }
    // Specific check for InferFromData action, which requires a file
    if (action === EnhancementType.InferFromData && !stats.isFile()) {
        console.error(`\n${logPrefix} ❌ Error: Target path for '${EnhancementType.InferFromData}' must be a file (e.g., JSON).`);
        process.exit(1);
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

    try {
        let targetFiles: string[] = []; // Array to hold absolute paths of files to process

        // --- Identify Target Files ---
        if (action === EnhancementType.InferFromData) {
            targetFiles.push(path.resolve(targetPath));
            console.log(`${logPrefix} Target for '${action}' is the single file: ${targetPath}`);
        } else if (stats.isDirectory()) {
            console.log(`${logPrefix} Target is a directory. Finding relevant files...`);
            targetFiles = await getTargetFiles(targetPath, prefix); // Use utility from shared/utils
            if (targetFiles.length === 0) {
                console.log(`\n${logPrefix} No relevant files found matching criteria. Exiting.`);
                return;
            }
            console.log(`${logPrefix} Found ${targetFiles.length} files to process for action '${action}'.`);
        } else if (stats.isFile()) {
            const filename = path.basename(targetPath);
            if (EXCLUDE_FILENAMES.has(filename)) { // Use constant from shared/constants
                console.log(`${logPrefix} Target file ${filename} is excluded by configuration.`);
                return;
            }
            console.log(`${logPrefix} Target is a single file for action '${action}'.`);
            targetFiles.push(path.resolve(targetPath));
        }

        // --- Process Based on Action Type ---

        // A) Actions that modify files and might use Gemini (currently only AddComments)
        if (isModificationAction && action === EnhancementType.AddComments) {
            // --- PARALLEL MODIFICATION FLOW (AddComments) ---
            const concurrencyLimit = 5;
            const limit = pLimit(concurrencyLimit);
            console.log(`\n${logPrefix} Starting PARALLEL modification action '${action}' on ${targetFiles.length} file(s) with concurrency ${concurrencyLimit}...`);

            /**
             * Processes a single file by reading its content, enhancing it with Gemini, and updating the file.
             * @param {string} absoluteFilePath The absolute path to the file.
             * @returns {Promise<FileProcessingResult>} A promise that resolves with the file processing result.
             */
            const fileProcessor = async (absoluteFilePath: string): Promise<FileProcessingResult> => {
                const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
                try {
                    const originalCode = readSingleFile(absoluteFilePath);
                    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(action, originalCode);

                    if (result.type === 'code' && result.content !== null) {
                        if (originalCode.trim() !== result.content.trim()) {
                            const updated = updateFileContent(absoluteFilePath, result.content); // Update the file content
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

            const tasks = targetFiles.map(filePath => limit(() => fileProcessor(filePath))); // Create tasks with concurrency limit
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
            const geminiRequestType = action;

            if (stats.isDirectory() || targetFiles.length > 1) {
                console.log(`\n${logPrefix} Consolidating ${targetFiles.length} file(s) for Gemini action '${action}'...`);
                const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetFiles[0]);
                codeToProcess = await getConsolidatedSources(consolidationRoot, prefix);
            } else if (targetFiles.length === 1) {
                console.log(`\n${logPrefix} Reading single file for Gemini action '${action}'...`);
                codeToProcess = readSingleFile(targetFiles[0]);
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
            const result: GeminiEnhancementResult = await enhanceCodeWithGemini(geminiRequestType, codeToProcess);

            // --- Handle Gemini Result ---
            if (result.type === 'text' && result.content !== null) {
                if (geminiRequestType === EnhancementType.GenerateDocs) {
                    const outputFileName = 'README.md';
                    const outputFilePath = path.resolve(process.cwd(), outputFileName);
                    console.log(`\n${logPrefix} Attempting to write generated documentation to ${outputFileName}...`);
                    const success = writeOutputFile(outputFilePath, result.content);
                    if (!success) {
                        console.error(`${logPrefix} ❌ Failed to write documentation file.`);
                        process.exitCode = 1;
                    } else {
                        console.log(`\n${logPrefix} ✅ Generated documentation saved to: ${outputFileName}`);
                    }
                } else {
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
                const consolidatedContent = await getConsolidatedSources(consolidationRoot, prefix);
                const outputFileName = 'consolidated_output.txt';
                const outputFilePath = path.resolve(process.cwd(), outputFileName);
                const success = writeOutputFile(outputFilePath, consolidatedContent);
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
                    const fileContent = readSingleFile(dataFilePath);
                    let data: any;
                    try {
                        data = JSON.parse(fileContent); // Parse JSON content
                    } catch (parseError) {
                        console.error(`${logPrefix} ❌ Error parsing JSON data from ${relativeDataFilePath}: ${parseError instanceof Error ? parseError.message : parseError}`);
                        process.exit(1);
                    }
                    const inferredInterface = inferTypesFromData(interfaceName, data);
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
                const anyCommentRegex = /^\s*(\/\/.*|#.*)/;

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
                        const originalCode = readSingleFile(absoluteFilePath);
                        const lines = originalCode.split(/\r?\n/);

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

                        console.log(`    ${logPrefix} 🔄 Updating header for ${relativeFilePath}...`);

                        let firstCodeLineIndex = 0;
                        while (firstCodeLineIndex < lines.length) {
                            const lineTrim = lines[firstCodeLineIndex].trim();
                            if (lineTrim === '' || anyCommentRegex.test(lineTrim)) {
                                firstCodeLineIndex++;
                            } else {
                                break;
                            }
                        }

                        const codeContentLines = lines.slice(firstCodeLineIndex);
                        const codeContent = codeContentLines.length > 0 ? codeContentLines.join('\n') : '';
                        const newCode = `${pathComment}\n\n${codeContent}`;

                        const updated = updateFileContent(absoluteFilePath, newCode); // Update the file content
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
            console.error(`${logPrefix} Internal Error: Action "${action}" was not handled by any processing flow.`);
            process.exit(1);
        }

    } catch (error) {
        console.error(`\n${logPrefix} ❌ An unexpected error occurred during script execution:`);
        if (error instanceof Error) {
            console.error(`   Message: ${error.message}`);
            // console.error(error.stack); // Uncomment for debugging
        } else {
            console.error("   Unknown error object:", error);
        }
        process.exit(1);
    }

    console.log(`\n${logPrefix} Execution finished for action: ${action}.`);
} // End runCommandLogic