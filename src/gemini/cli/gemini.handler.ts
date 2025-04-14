// src/gemini/cli/gemini.handler.ts
import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit';
import { EXCLUDE_PATTERNS, EXCLUDE_FILENAMES } from '../../shared/constants/filesystem.constants.js';
import { inferTypesFromData } from '../../shared/helpers/type-inference.helper.js';
import { CliArguments, FileProcessingResult } from '../../shared/types/app.type.js'; // Unified type
import { EnhancementType } from '../../shared/enums/enhancement.type.js'; // Enum
import { getConsolidatedSources, getTargetFiles } from '../../shared/utils/filesystem.utils.js';
import { readSingleFile, updateFileContent, writeOutputFile } from '../../shared/utils/file-io.utils.js';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../gemini.service.js';

const logPrefix = "[GeminiHandler]";

// --- Standard Directory Descriptions (Unchanged) ---
const standardDescriptions: ReadonlyMap<string, string> = new Map([
    /* ... descriptions ... */
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

// --- Define an interface for the options of generateTreeLines ---
interface GenerateTreeOptions {
    depth: number;
    maxDepth?: number;
    prefix: string;
    useDescriptions: boolean;
    exclusions: Set<string>;
}

// --- Recursive Tree Generation Function (Use the interface) ---
/**
 * Recursively scans a directory and generates formatted tree lines.
 */
async function generateTreeLines(
    currentPath: string,
    options: GenerateTreeOptions // <<< Use the named interface here
): Promise<string[]> {
    // Now destructuring works correctly because options has a clear type
    const { depth, maxDepth, prefix, useDescriptions, exclusions } = options;
    let outputLines: string[] = [];

    if (maxDepth !== undefined && depth > maxDepth) {
        return [];
    }

    let entries: string[];
    try {
        entries = await fs.promises.readdir(currentPath);
    } catch (error) {
        console.warn(`${logPrefix} ⚠️ Could not read directory ${currentPath}: ${error instanceof Error ? error.message : error}`);
        return [`${prefix}└── Error reading directory!`];
    }

    const filteredEntries = entries
        .filter(entry => !exclusions.has(entry))
        .sort((a, b) => { /* ... sorting logic ... */
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
                // Pass the options object matching the interface type for the recursive call
                const childLines = await generateTreeLines(entryPath, {
                    ...options, // Spread existing options
                    depth: depth + 1, // Override depth
                    prefix: nextPrefix, // Override prefix
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
    const { command, targetPath } = argv; // Common arguments

    switch (command) {
        case EnhancementType.GenerateStructureDoc: {
            const { output, descriptions, depth, exclude } = argv;
            console.log(`\n${logPrefix} Executing action: ${command} on target: ${targetPath}`);
            const outputOrDefault = output || 'Project Tree Structure.md';
            const descriptionsOrDefault = descriptions || false;
            const excludeOrDefault = exclude || '';

            console.log(`  Outputting to: ${outputOrDefault}`);
            if (descriptionsOrDefault) console.log(`  Including descriptions.`);
            if (depth !== undefined) console.log(`  Max depth: ${depth}`);
            if (excludeOrDefault) console.log(`  Excluding: ${excludeOrDefault}`);

            try {
                const absTargetPath = path.resolve(targetPath);
                const absOutputPath = path.resolve(outputOrDefault);

                if (!fs.existsSync(absTargetPath) || !fs.statSync(absTargetPath).isDirectory()) {
                    console.error(`${logPrefix} ❌ Error: Target path '${targetPath}' does not exist or is not a directory.`);
                    process.exit(1);
                }

                const standardExclusions = new Set([...EXCLUDE_PATTERNS, ...EXCLUDE_FILENAMES]);
                const userExclusions = excludeOrDefault ? excludeOrDefault.split(',').map(s => s.trim()).filter(s => s) : [];
                userExclusions.forEach(ex => standardExclusions.add(ex));
                if (absOutputPath.startsWith(path.dirname(absTargetPath))) {
                    standardExclusions.add(path.basename(absOutputPath));
                }

                console.log(`${logPrefix} Scanning directory structure...`);
                // Explicitly create the options object matching the interface
                const treeOptions: GenerateTreeOptions = {
                    depth: 0,
                    maxDepth: depth, // Pass optional depth directly
                    prefix: '',
                    useDescriptions: descriptionsOrDefault,
                    exclusions: standardExclusions,
                };
                const treeLines = await generateTreeLines(absTargetPath, treeOptions); // Pass typed options

                const outputContent = `${path.basename(absTargetPath)}/\n` + treeLines.join('\n');
                const success = writeOutputFile(absOutputPath, outputContent);

                if (success) {
                    console.log(`\n${logPrefix} ✅ Successfully generated structure document: ${outputOrDefault}`);
                } else {
                    console.error(`${logPrefix} ❌ Failed to write structure document.`);
                    process.exitCode = 1;
                }

            } catch (error) {
                console.error(`\n${logPrefix} ❌ An unexpected error occurred during ${command}:`);
                if (error instanceof Error) {
                    console.error(`   Message: ${error.message}`);
                    console.error(error.stack);
                } else {
                    console.error("   Unknown error object:", error);
                }
                process.exit(1);
            }
            break; // Exit the switch case
        }

        // --- Cases for other EnhancementType commands ---
        // (The rest of the switch cases for AddComments, Analyze, etc. remain unchanged)
        case EnhancementType.AddComments:
        case EnhancementType.Analyze:
        case EnhancementType.Explain:
        case EnhancementType.AddPathComment:
        case EnhancementType.Consolidate:
        case EnhancementType.SuggestImprovements:
        case EnhancementType.GenerateDocs:
        case EnhancementType.InferFromData: {
            /* ... existing logic for these cases ... */
            // Destructure arguments relevant to these commands
            const { prefix, interfaceName } = argv;
            const action = command; // Use command directly as action
            const actionDetails = `${prefix ? ` with prefix: ${prefix}` : ''}${interfaceName ? ` (Interface: ${interfaceName})` : ''}`;
            console.log(`\n${logPrefix} Executing enhancement: ${action} on target: ${targetPath}${actionDetails}`);

            // --- Validation ---
            let stats: fs.Stats;
            try {
                stats = fs.statSync(targetPath);
                if (action === EnhancementType.InferFromData && !stats.isFile()) {
                    console.error(`\n${logPrefix} ❌ Error: Target path for '${EnhancementType.InferFromData}' must be a file (e.g., JSON).`);
                    process.exit(1);
                }
            } catch (e) {
                console.error(`\n${logPrefix} ❌ Error: Cannot access target path: ${targetPath}. Please ensure it exists.`);
                process.exit(1);
            }

            // --- Classify Action Type ---
            const isModificationAction = [EnhancementType.AddComments, EnhancementType.AddPathComment].includes(action);
            const usesGeminiApi = [EnhancementType.AddComments, EnhancementType.Analyze, EnhancementType.Explain, EnhancementType.SuggestImprovements, EnhancementType.GenerateDocs].includes(action);
            const isLocalProcessingAction = [EnhancementType.Consolidate, EnhancementType.InferFromData, EnhancementType.AddPathComment].includes(action);

            // --- Main execution block ---
            try {
                let targetFiles: string[] = [];
                // --- Identify Target Files ---
                if (action === EnhancementType.InferFromData) {
                    targetFiles.push(path.resolve(targetPath));
                } else if (stats.isDirectory()) {
                    targetFiles = await getTargetFiles(targetPath, prefix);
                    if (targetFiles.length === 0) {
                        console.log(`\n${logPrefix} No relevant files found matching criteria. Exiting.`);
                        return;
                    }
                    console.log(`${logPrefix} Found ${targetFiles.length} files to process.`);
                } else if (stats.isFile()) {
                    const filename = path.basename(targetPath);
                    if (EXCLUDE_FILENAMES.has(filename)) {
                        console.log(`${logPrefix} Target file ${filename} is excluded.`);
                        return;
                    }
                    targetFiles.push(path.resolve(targetPath));
                }

                // --- Process Based on Action Type ---
                if (isModificationAction && action === EnhancementType.AddComments) {
                    // Parallel modification logic...
                    const concurrencyLimit = 5;
                    const limit = pLimit(concurrencyLimit);
                    console.log(`\n${logPrefix} Starting PARALLEL modification action '${action}' on ${targetFiles.length} file(s)...`);
                    const fileProcessor = async (absoluteFilePath: string): Promise<FileProcessingResult> => { /* ... existing processor logic ... */
                        const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
                        try {
                            const originalCode = readSingleFile(absoluteFilePath);
                            const result: GeminiEnhancementResult = await enhanceCodeWithGemini(action, originalCode);

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
                                return { filePath: relativeFilePath, status: 'error', message: `Gemini Error: ${result.content}` };
                            } else {
                                console.warn(`    ${logPrefix} ⚠️ Unexpected result type/content for ${relativeFilePath}.`);
                                return { filePath: relativeFilePath, status: 'error', message: `Unexpected result type/content: ${result.type}` };
                            }
                        } catch (fileProcessingError) {
                            console.error(`    ${logPrefix} ❌ Error during Gemini processing for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
                            return { filePath: relativeFilePath, status: 'error', message: `File/API Processing Error: ${fileProcessingError instanceof Error ? fileProcessingError.message : "Unknown error"}` };
                        }
                    };
                    const tasks = targetFiles.map(filePath => limit(() => fileProcessor(filePath)));
                    const results: FileProcessingResult[] = await Promise.all(tasks);
                    // Summarize results...
                    let successCount = 0, unchangedCount = 0, errorCount = 0;
                    results.forEach(res => { /* ... tally results ... */
                        switch (res.status) {
                            case 'updated': successCount++; break;
                            case 'unchanged': unchangedCount++; break;
                            case 'error': errorCount++; break;
                        }
                    });
                    console.log("\n--- Parallel Modification Summary ---");
                    console.log(`  Action: ${action}, Files: ${targetFiles.length}, Updated: ${successCount}, Unchanged: ${unchangedCount}, Errors: ${errorCount}`);
                    console.log("-----------------------------------");
                    if (errorCount > 0) process.exitCode = 1;

                } else if (usesGeminiApi && !isModificationAction) {
                    // Non-modification Gemini logic...
                    let codeToProcess: string; /* ... get codeToProcess ... */
                    if (stats.isDirectory() || targetFiles.length > 1) {
                        const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetFiles[0]);
                        codeToProcess = await getConsolidatedSources(consolidationRoot, prefix);
                    } else if (targetFiles.length === 1) {
                        codeToProcess = readSingleFile(targetFiles[0]);
                    } else { /* error */ process.exit(1); }
                    if (codeToProcess.trim() === '') { /* warn and return */ return; }

                    console.log(`\n${logPrefix} Invoking Gemini service for action: ${action}...`);
                    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(action, codeToProcess);
                    // Handle result (print or write file)...
                    if (result.type === 'text' && result.content !== null) {
                        if (action === EnhancementType.GenerateDocs) { /* write README.md */
                            const outputFileName = 'README.md';
                            const outputFilePath = path.resolve(process.cwd(), outputFileName);
                            console.log(`\n${logPrefix} Writing generated documentation to ${outputFileName}...`);
                            const success = writeOutputFile(outputFilePath, result.content);
                            if (!success) { /* error */ process.exitCode = 1; }
                            else { console.log(`\n${logPrefix} ✅ Documentation saved to: ${outputFileName}`); }
                        } else { /* print result */
                            console.log(`\n--- Gemini ${action} Result ---`);
                            console.log(result.content);
                            console.log(`--- End ${action} Result ---\n`);
                        }
                    } else if (result.type === 'error') { /* handle error */ process.exitCode = 1; }
                    else { /* handle unexpected type */ process.exitCode = 1; }

                } else if (isLocalProcessingAction) {
                    // Local processing logic...
                    if (action === EnhancementType.Consolidate) { /* consolidate logic */
                        const consolidationRoot = stats.isDirectory() ? targetPath : path.dirname(targetPath);
                        const consolidatedContent = await getConsolidatedSources(consolidationRoot, prefix);
                        const outputFileName = 'consolidated_output.txt';
                        const outputFilePath = path.resolve(process.cwd(), outputFileName);
                        const success = writeOutputFile(outputFilePath, consolidatedContent);
                        if (!success) process.exitCode = 1;
                        else console.log(`\n${logPrefix} ✅ Consolidated content saved to: ${outputFileName}`);
                    } else if (action === EnhancementType.InferFromData) { /* infer logic */
                        if (!interfaceName) { /* error */ process.exit(1); }
                        const dataFilePath = targetFiles[0];
                        const relativeDataFilePath = path.relative(process.cwd(), dataFilePath).split(path.sep).join('/');
                        try { /* read, parse, infer, print */
                            const fileContent = readSingleFile(dataFilePath);
                            let data: any;
                            try { data = JSON.parse(fileContent); } catch (e) { /* error */ process.exit(1); }
                            const inferredInterface = inferTypesFromData(interfaceName, data);
                            console.log(`\n--- Inferred Interface: ${interfaceName} ---\n${inferredInterface}\n--- End Interface ---`);
                        } catch (e) { /* error */ process.exit(1); }
                    } else if (action === EnhancementType.AddPathComment) { /* add path comment logic */
                        console.log(`\n${logPrefix} Starting SEQUENTIAL action '${action}' on ${targetFiles.length} file(s)...`);
                        let updatedCount = 0, unchangedCount = 0, skippedCount = 0, errorCount = 0;
                        const nonCommentableExtensions = new Set(['.json', '.env']);
                        const anyCommentRegex = /^\s*(\/\/.*|#.*)/;
                        for (const absoluteFilePath of targetFiles) { /* loop, skip, read, check, update */
                            const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
                            const fileExtension = path.extname(absoluteFilePath).toLowerCase();
                            if (nonCommentableExtensions.has(fileExtension)) { skippedCount++; continue; }
                            try {
                                const pathComment = `// File: ${relativeFilePath}`;
                                const originalCode = readSingleFile(absoluteFilePath);
                                const lines = originalCode.split(/\r?\n/);
                                // Check if correct
                                let firstNonBlankLineIndex = lines.findIndex(line => line.trim() !== '');
                                if (firstNonBlankLineIndex === -1) firstNonBlankLineIndex = 0; // Handle empty file case
                                const firstNonBlankLine = lines[firstNonBlankLineIndex]?.trim() ?? '';

                                let alreadyCorrect = false;
                                if (firstNonBlankLineIndex === 0 && firstNonBlankLine === pathComment && (lines.length === 1 || (lines.length > 1 && lines[1].trim() === ''))) {
                                    alreadyCorrect = true;
                                }

                                if (alreadyCorrect) { unchangedCount++; continue; }
                                // Update
                                let firstCodeLineIndex = 0;
                                while (firstCodeLineIndex < lines.length && (lines[firstCodeLineIndex].trim() === '' || anyCommentRegex.test(lines[firstCodeLineIndex].trim()))) {
                                    firstCodeLineIndex++;
                                }
                                const codeContentLines = lines.slice(firstCodeLineIndex);
                                const codeContent = codeContentLines.length > 0 ? codeContentLines.join('\n') : '';
                                const newCode = `${pathComment}\n\n${codeContent}`;
                                const updated = updateFileContent(absoluteFilePath, newCode);
                                if (updated) updatedCount++; else errorCount++;
                            } catch (e) { errorCount++; }
                        }
                        // Summarize
                        console.log("\n--- Sequential Action Summary ---");
                        console.log(`  Action: ${action}, Files: ${targetFiles.length}, Updated: ${updatedCount}, Unchanged: ${unchangedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
                        console.log("---------------------------------");
                        if (errorCount > 0) process.exitCode = 1;
                    }
                } else {
                    console.error(`${logPrefix} Internal Error: Enhancement action "${action}" was not handled.`);
                    process.exit(1);
                }

            } catch (error) {
                console.error(`\n${logPrefix} ❌ An unexpected error occurred during enhancement action ${action}:`);
                if (error instanceof Error) console.error(`   Message: ${error.message}`);
                else console.error("   Unknown error object:", error);
                process.exit(1);
            }
            console.log(`\n${logPrefix} Execution finished for action: ${action}.`);
            break; // Exit the switch case
        }


        // Default case for the switch statement
        default: {
            console.error(`${logPrefix} ❌ Internal Error: Unhandled command type received: ${command}`);
            process.exit(1);
        }
    } // End switch statement

} // End runCommandLogic