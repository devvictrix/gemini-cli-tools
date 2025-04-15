// File: src/gemini/commands/generate-tests.command.ts
// Status: New

import fs from 'fs';
import path from 'path';
import { CliArguments } from '../../shared/types/app.type.js';
import { getConsolidatedSources, getTargetFiles } from '../../shared/utils/filesystem.utils.js';
import { readSingleFile, writeOutputFile } from '../../shared/utils/file-io.utils.js';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../gemini.service.js';
// Corrected path assuming enhancement.type.ts is now in shared/enums
import { EnhancementType } from '../types/enhancement.type.js';
import { extractCodeBlock } from '../utils/code.extractor.js'; // Need this utility

const logPrefix = "[GenerateTests]";

/**
 * Executes the GenerateTests command. Consolidates code from the target file/directory,
 * sends it to Gemini for unit test generation, and either prints the result or saves it
 * to a specified output file.
 *
 * @param args - The command line arguments.
 * @returns A promise that resolves when the test generation is complete.
 * @throws Error if command/path validation fails, consolidation fails, Gemini fails,
 *         or writing the output file fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.GenerateTests) {
        throw new Error("Handler mismatch: Expected GenerateTests command.");
    }

    const { targetPath, prefix, output: outputFilePathArg, framework } = args;
    const frameworkHint = typeof framework === 'string' ? framework : 'jest'; // Default framework

    console.log(`\n${logPrefix} Generating tests for: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);
    if (outputFilePathArg) {
        console.log(`  Outputting tests to file: ${outputFilePathArg}`);
    } else {
        console.log(`  Outputting tests to console.`);
    }
    console.log(`  Using framework hint: ${frameworkHint}`);

    // --- Validate Target Path & Consolidate Code ---
    let stats: fs.Stats;
    let codeToProcess: string;
    let absTargetPath: string;
    try {
        absTargetPath = path.resolve(targetPath);
        stats = fs.statSync(absTargetPath);
    } catch (e) {
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists. ${e instanceof Error ? e.message : ''}`);
    }

    if (stats.isDirectory()) {
        console.log(`\n${logPrefix} Consolidating code from directory ${absTargetPath}...`);
        codeToProcess = await getConsolidatedSources(absTargetPath, prefix);
        if (codeToProcess.trim().split('\n').length <= 7) { // Check if only header exists
            console.warn(`${logPrefix} No relevant source files found in directory '${targetPath}'${prefix ? ` matching prefix '${prefix}'` : ''}. Cannot generate tests.`);
            return;
        }
    } else if (stats.isFile()) {
        console.log(`\n${logPrefix} Reading code from file ${absTargetPath}...`);
        codeToProcess = readSingleFile(absTargetPath);
    } else {
        throw new Error(`Target path ${targetPath} is neither a file nor a directory.`);
    }

    if (codeToProcess.trim() === '') {
        console.warn(`${logPrefix} Warning: Content to generate tests for is empty. Skipping.`);
        return;
    }

    // --- Invoke Gemini Service ---
    console.log(`\n${logPrefix} Invoking Gemini service to generate tests...`);
    // Pass framework hint to the service if the service function supports it (we'll add it)
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(
        EnhancementType.GenerateTests,
        codeToProcess,
        { frameworkHint } // Pass framework as an option
    );

    // --- Handle Result ---
    if (result.type === 'error') {
        throw new Error(`Gemini service failed during test generation: ${result.content ?? 'No specific error message provided.'}`);
    }

    if (result.content === null) {
        console.warn(`${logPrefix} ⚠️ Gemini returned no content for test generation.`);
        return; // Nothing to process
    }

    // Expecting text that contains a code block
    const extractedCode = extractCodeBlock(result.content);

    if (!extractedCode) {
        console.warn(`${logPrefix} ⚠️ Could not extract test code block from Gemini's response. Displaying raw response:`);
        console.log("\n--- Gemini Raw Response ---");
        console.log(result.content);
        console.log("--- End Raw Response ---\n");
        if (outputFilePathArg) {
            console.warn(`${logPrefix} Cannot save to file as code block was not reliably extracted.`);
        }
        return;
    }

    // --- Output ---
    if (outputFilePathArg && typeof outputFilePathArg === 'string') {
        // Save to file
        const absOutputFilePath = path.resolve(outputFilePathArg);
        const relativeOutput = path.relative(process.cwd(), absOutputFilePath).split(path.sep).join('/');
        console.log(`\n${logPrefix} Writing generated tests to ${relativeOutput}...`);
        if (fs.existsSync(absOutputFilePath)) {
            console.warn(`${logPrefix} ⚠️ File already exists at ${relativeOutput} and will be overwritten.`);
        }
        const success = writeOutputFile(absOutputFilePath, extractedCode);
        if (!success) {
            throw new Error(`Failed to write generated tests file to ${relativeOutput}.`);
        } else {
            console.log(`\n${logPrefix} ✅ Successfully generated tests saved to: ${relativeOutput}`);
        }
    } else {
        // Output to console
        console.log(`\n--- Generated Tests (${frameworkHint}) ---`);
        console.log(extractedCode);
        console.log(`--- End Generated Tests ---\n`);
    }
}