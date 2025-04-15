// File: src/gemini/commands/generate-tests.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments, FileProcessingResult } from '@shared/types/app.type';
import { getTargetFiles } from '@shared/utils/filesystem.utils'; // Use this again
import { readSingleFile, writeOutputFile } from '@shared/utils/file-io.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../gemini.service';
import { EnhancementType } from '../types/enhancement.type'; // Adjusted path
import { extractCodeBlock } from '../utils/code.extractor';

const logPrefix = "[GenerateTests]";
const TEST_DIR_NAME = 'tests'; // Top-level directory for tests

/**
 * Calculates the mirrored test file path under the top-level test directory.
 * Assumes source files are under a directory like 'src'.
 * Example: /project/src/services/utils/helpers.ts -> /project/tests/services/utils/helpers.test.ts
 * @param sourcePath Absolute path to the source file.
 * @param projectRoot Optional: The root of the project to calculate relative paths from. Defaults to cwd.
 * @returns Absolute path for the corresponding test file under the TEST_DIR_NAME directory.
 * @throws Error if the source path doesn't seem to be in a standard structure (e.g., under 'src').
 */
function deriveMirroredTestFilePath(sourcePath: string, projectRoot: string = process.cwd()): string {
    const relativeSourcePath = path.relative(projectRoot, sourcePath);

    // Find the likely source root ('src' or the first dir if not 'src')
    const pathParts = relativeSourcePath.split(path.sep);
    let sourceRoot = 'src'; // Assume 'src' by default
    if (pathParts.length > 1 && pathParts[0] !== 'src') {
        // If not directly under 'src', maybe it's just under the root?
        // Or should we error? Let's assume it's relative from project root for now if src isn't found.
        // A more robust approach might find the closest package.json or tsconfig.json rootDir.
        console.warn(`${logPrefix} Source file ${relativeSourcePath} not found under a 'src' directory. Mirroring path relative to project root in '${TEST_DIR_NAME}'.`);
        sourceRoot = ''; // Use project root as base
    } else if (pathParts[0] === 'src') {
        pathParts.shift(); // Remove 'src' part
    } else {
        // It's directly in the project root? Unlikely for src files.
        console.warn(`${logPrefix} Source file ${relativeSourcePath} is in project root? Mirroring path directly in '${TEST_DIR_NAME}'.`);
        sourceRoot = '';
    }


    const relativePathInsideSourceRoot = pathParts.join(path.sep);

    const dir = path.dirname(relativePathInsideSourceRoot);
    const ext = path.extname(relativePathInsideSourceRoot);
    const baseName = path.basename(relativePathInsideSourceRoot, ext);
    const testFileName = `${baseName}.test${ext}`;

    // Join with the top-level TEST_DIR_NAME and the intermediate directory structure
    const finalTestPath = path.join(projectRoot, TEST_DIR_NAME, dir, testFileName);

    return path.resolve(finalTestPath); // Ensure absolute path
}


/**
 * Executes the GenerateTests command. Reads source file(s), sends them to Gemini
 * for unit test generation, and saves results to corresponding *.test.ts files
 * under the top-level 'tests' directory.
 *
 * @param args - The command line arguments.
 * @returns A promise that resolves when the test generation is complete.
 * @throws Error if validation fails, file ops fail, or Gemini fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.GenerateTests) {
        throw new Error("Handler mismatch: Expected GenerateTests command.");
    }

    const { targetPath, prefix, framework } = args;
    const frameworkHint = typeof framework === 'string' ? framework : 'jest';

    console.log(`\n${logPrefix} Generating tests for: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);
    console.log(`  Using framework hint: ${frameworkHint}`);
    console.log(`  Outputting test files to '${TEST_DIR_NAME}/<mirrored_path>/<file>.test.ts'`);

    // --- Determine Target Files ---
    let sourceFiles: string[] = [];
    let absTargetPath: string;
    try {
        absTargetPath = path.resolve(targetPath);
        const stats = fs.statSync(absTargetPath);
        if (stats.isDirectory()) {
            console.log(`\n${logPrefix} Target is a directory. Finding source files...`);
            sourceFiles = await getTargetFiles(absTargetPath, prefix); // Use utility
        } else if (stats.isFile()) {
            console.log(`\n${logPrefix} Target is a single file.`);
            sourceFiles.push(absTargetPath); // Process just this one file
        } else {
            throw new Error(`Target path ${targetPath} is not a valid file or directory.`);
        }
    } catch (e) {
        throw new Error(`Cannot access target path: ${targetPath}. ${e instanceof Error ? e.message : ''}`);
    }

    if (sourceFiles.length === 0) {
        console.log(`\n${logPrefix} No relevant source files found matching criteria. Exiting.`);
        return;
    }
    console.log(`${logPrefix} Found ${sourceFiles.length} source file(s) to generate tests for.`);

    // --- Process Files (Potentially in Parallel) ---
    const concurrencyLimit = 5; // Adjust as needed
    // Dynamically import p-limit as it's an ESM module
    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(concurrencyLimit); // Use the dynamically imported function
    const results: FileProcessingResult[] = [];

    console.log(`\n${logPrefix} Starting test generation for ${sourceFiles.length} file(s)...`);

    const fileProcessor = async (sourceFilePath: string): Promise<void> => {
        const relativeSourcePath = path.relative(process.cwd(), sourceFilePath).split(path.sep).join('/');
        let resultStatus: FileProcessingResult['status'] = 'processed'; // Default, change on error/update
        let message: string | undefined;

        try {
            console.log(`  ${logPrefix} Processing: ${relativeSourcePath}`);

            // 1. Derive Output Path
            const testFilePath = deriveMirroredTestFilePath(sourceFilePath); // Use the new derivation logic
            const relativeTestFilePath = path.relative(process.cwd(), testFilePath).split(path.sep).join('/');

            // 2. Read Source Code
            const codeToProcess = readSingleFile(sourceFilePath);
            if (codeToProcess.trim() === '') {
                console.warn(`    ${logPrefix} Skipping empty source file: ${relativeSourcePath}`);
                results.push({ filePath: relativeSourcePath, status: 'unchanged', message: 'Source file empty' });
                return;
            }

            // 3. Invoke Gemini Service
            const result = await enhanceCodeWithGemini(
                EnhancementType.GenerateTests,
                codeToProcess,
                { frameworkHint }
            );

            // 4. Handle Result
            if (result.type === 'error' || result.content === null) {
                throw new Error(`Gemini service failed: ${result.content ?? 'No content returned'}`);
            }

            // 5. Extract Code Block
            const extractedCode = extractCodeBlock(result.content);
            if (!extractedCode) {
                // Log raw response for debugging but treat as an error for file writing
                console.warn(`    ${logPrefix} ⚠️ Could not extract code block for ${relativeSourcePath}. Raw response was:`);
                console.warn(`    ${result.content.substring(0, 300)}...`);
                throw new Error(`Failed to extract valid code block from AI response.`);
            }

            // 6. Write Output File
            if (fs.existsSync(testFilePath)) {
                console.warn(`    ${logPrefix} ⚠️ Test file exists (${relativeTestFilePath}) and will be overwritten.`);
            }
            const success = writeOutputFile(testFilePath, extractedCode);
            if (!success) {
                throw new Error(`Failed to write test file.`); // Let catch block handle specifics
            }
            message = `Test file generated: ${relativeTestFilePath}`;
            resultStatus = 'updated';

        } catch (error) {
            console.error(`    ${logPrefix} ❌ Error processing ${relativeSourcePath}: ${error instanceof Error ? error.message : error}`);
            resultStatus = 'error';
            message = error instanceof Error ? error.message : 'Unknown error during processing';
        } finally {
            // Record result for summary
            results.push({ filePath: relativeSourcePath, status: resultStatus, message });
        }
    };

    // Create and run tasks
    const tasks = sourceFiles.map(filePath => limit(() => fileProcessor(filePath)));
    await Promise.all(tasks); // Wait for all files to be processed

    // --- Summarize Results ---
    let successCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;
    results.forEach(res => {
        switch (res.status) {
            case 'updated':
            case 'processed': // Treat processed (no error) as success if not explicitly unchanged/error
                successCount++;
                break;
            case 'unchanged':
                unchangedCount++;
                break;
            case 'error':
                errorCount++;
                break;
        }
    });

    console.log("\n--- Test Generation Summary ---");
    console.log(`  Framework Hint:      ${frameworkHint}`);
    console.log(`  Files Processed:     ${sourceFiles.length}`);
    console.log(`  Tests Generated/Updated: ${successCount}`);
    console.log(`  Skipped (e.g., empty): ${unchangedCount}`);
    console.log(`  Errors:              ${errorCount}`);
    console.log("-----------------------------");

    if (errorCount > 0) {
        // Indicate overall failure if any file errored
        throw new Error(`${errorCount} error(s) occurred during test generation.`);
    }
}