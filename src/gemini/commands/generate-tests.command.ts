import fs from 'fs';
import path from 'path';
import { CliArguments, FileProcessingResult } from '@shared/types/app.type';
import { getTargetFiles } from '@shared/utils/filesystem.utils';
import { readSingleFile, writeOutputFile } from '@shared/utils/file-io.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';
import { extractCodeBlock } from '@/gemini/utils/code.extractor';

const logPrefix = "[GenerateTests]";
const TEST_DIR_NAME = 'tests'; // Top-level directory for tests

/**
 * Calculates the mirrored test file path under the top-level test directory.
 * Assumes source files are under a directory like 'src'.
 * Example: /project/src/services/utils/helpers.ts -> /project/tests/services/utils/helpers.test.ts
 *
 * The function attempts to mirror the directory structure of the source files under a 'tests' directory.
 * If the source file isn't under a standard 'src' directory, it will attempt to place the test file
 * under 'tests' mirroring the entire path relative to the project root.
 *
 * @param sourcePath Absolute path to the source file.
 * @param projectRoot Optional: The root of the project to calculate relative paths from. Defaults to cwd.
 * @returns Absolute path for the corresponding test file under the TEST_DIR_NAME directory.
 * @throws Error if the source path doesn't seem to be in a standard structure (e.g., under 'src').
 */
function deriveMirroredTestFilePath(sourcePath: string, projectRoot: string = process.cwd()): string {
    const relativeSourcePath = path.relative(projectRoot, sourcePath);

    // Find the likely source root ('src' or the first dir if not 'src')
    const pathParts = relativeSourcePath.split(path.sep);

    // Determine if the path is under the 'src' folder
    if (pathParts.length > 1 && pathParts[0] !== 'src') {
        // If not directly under 'src', maybe it's just under the root?
        console.warn(`${logPrefix} Source file ${relativeSourcePath} not found under a 'src' directory. Mirroring path relative to project root in '${TEST_DIR_NAME}'.`);
    } else if (pathParts[0] === 'src') {
        // If it's under 'src', we want to remove 'src' from the path to mirror from the source root.
        pathParts.shift(); // Remove 'src' part
    } else {
        // It's directly in the project root? Unlikely for src files.
        console.warn(`${logPrefix} Source file ${relativeSourcePath} is in project root? Mirroring path directly in '${TEST_DIR_NAME}'.`);
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
 * under the top-level 'tests' directory. Processes files sequentially.
 *
 * The function first validates the command.  Then, it determines which files
 * to process based on the target path (single file or directory). For each
 * source file identified, it calls the Gemini service to generate the tests,
 * extracts the generated code, and writes it to the corresponding test file.
 * Error handling ensures that failures are logged and reported in the summary.
 *
 * @param args - The command line arguments.
 * @returns A promise that resolves when the test generation is complete.
 * @throws Error if validation fails, file ops fail, or Gemini fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Validate the command to ensure it's the expected one
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
            sourceFiles = await getTargetFiles(absTargetPath, prefix); // Use utility to find files
        } else if (stats.isFile()) {
            console.log(`\n${logPrefix} Target is a single file.`);
            // Ensure we don't try to generate tests for non-code files if a single file is targeted
            const fileName = path.basename(absTargetPath);
            const passesExtension = ['ts', 'js'].some(ext => fileName.toLowerCase().endsWith('.' + ext)); // Basic check for TS/JS
            if (passesExtension) {
                sourceFiles.push(absTargetPath); // Process just this one file
            } else {
                console.warn(`${logPrefix} Target file ${targetPath} does not have a processable extension (.ts, .js). Skipping.`);
            }
        } else {
            throw new Error(`Target path ${targetPath} is not a valid file or directory.`);
        }
    } catch (e) {
        throw new Error(`Cannot access target path: ${targetPath}. ${e instanceof Error ? e.message : ''}`);
    }

    // Exit early if no files were found
    if (sourceFiles.length === 0) {
        console.log(`\n${logPrefix} No relevant source files found matching criteria. Exiting.`);
        return;
    }
    console.log(`${logPrefix} Found ${sourceFiles.length} source file(s) to generate tests for.`);

    // --- Process Files Sequentially ---
    const results: FileProcessingResult[] = [];
    console.log(`\n${logPrefix} Starting SEQUENTIAL test generation for ${sourceFiles.length} file(s)...`);

    /**
     * Inner function to process a single file and update the results array.
     * This function reads the source code, calls Gemini to generate tests,
     * extracts the generated code, and writes it to the corresponding test file.
     * Errors during processing are caught and logged, and the result is recorded.
     *
     * @param sourceFilePath - The absolute path to the source file to process.
     */
    const fileProcessor = async (sourceFilePath: string): Promise<void> => {
        const relativeSourcePath = path.relative(process.cwd(), sourceFilePath).split(path.sep).join('/');
        let resultStatus: FileProcessingResult['status'] = 'processed'; // Default, change on error/update
        let message: string | undefined;

        try {
            console.log(`  ${logPrefix} Processing: ${relativeSourcePath}`);

            // 1. Derive Output Path
            const testFilePath = deriveMirroredTestFilePath(sourceFilePath);
            const relativeTestFilePath = path.relative(process.cwd(), testFilePath).split(path.sep).join('/');

            // 2. Read Source Code
            const codeToProcess = readSingleFile(sourceFilePath);
            if (codeToProcess.trim() === '') {
                console.warn(`    ${logPrefix} Skipping empty source file: ${relativeSourcePath}`);
                resultStatus = 'unchanged'; // Mark as unchanged/skipped
                message = 'Source file empty';
                return; // Exit early for this file
            }

            // 3. Invoke Gemini Service
            const result: GeminiEnhancementResult = await enhanceCodeWithGemini(
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
                throw new Error(`Failed to write test file.`);
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

    // Process files one by one using the inner function
    for (const sourceFilePath of sourceFiles) {
        await fileProcessor(sourceFilePath);
    }

    // --- Summarize Results ---
    let successCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;
    results.forEach(res => {
        switch (res.status) {
            case 'updated':
            case 'processed': // Treat generated (but maybe empty) as success if not explicitly unchanged/error
                successCount++;
                break;
            case 'unchanged': // Specifically for skipped empty files etc.
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

    // Indicate overall failure if any file errored
    if (errorCount > 0) {
        throw new Error(`${errorCount} error(s) occurred during test generation.`);
    }
}