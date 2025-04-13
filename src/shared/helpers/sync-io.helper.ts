// File: src/shared/utils/file-io.utils.ts // Consolidated

import * as fs from 'fs';
import * as path from 'path';

const logPrefix = "[FileIO]"; // Standardized log prefix

/**
 * Reads the content of a single code file synchronously.
 * @param filePath The absolute path to the code file.
 * @returns The code content as a string.
 * @throws An error if the file cannot be read or is not a file.
 */
export function readSingleFile(filePath: string): string {
    const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
    try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            throw new Error(`Target path is not a file: ${relativeFilePath}`);
        }
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`${logPrefix} Read ${content.length} chars from ${relativeFilePath}.`); // Optional: log success
        return content;
    } catch (readError) {
        console.error(`${logPrefix} ❌ Error reading file ${relativeFilePath}: ${readError instanceof Error ? readError.message : readError}`);
        throw readError; // Re-throw after logging
    }
}

/**
 * Updates the content of a code file synchronously. Creates parent directory if needed.
 * @param filePath The absolute path to the code file.
 * @param newContent The new code content to write to the file.
 * @returns True if the file was updated successfully, false otherwise.
 */
export function updateFileContent(filePath: string, newContent: string): boolean {
    const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
    console.warn(`${logPrefix} ⚠️ Attempting to overwrite ${relativeFilePath}...`); // Keep warning
    try {
        const outputDir = path.dirname(filePath);
        // Ensure directory exists (moved from writeOutputFile as it's needed here too)
        if (!fs.existsSync(outputDir)) {
            // recursive: true creates parent directories if they don't exist
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`${logPrefix} Created directory: ${path.relative(process.cwd(), outputDir)}`);
        }
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`${logPrefix} ✅ Successfully updated ${relativeFilePath}.`);
        return true;
    } catch (writeError) {
        console.error(`${logPrefix} ❌ Error writing file ${relativeFilePath}: ${writeError instanceof Error ? writeError.message : writeError}`);
        return false;
    }
}

/**
 * Writes content to a specified output file. Creates parent directory if needed.
 * @param outputFilePath The absolute path for the output file.
 * @param content The content string to write.
 * @returns True if writing was successful, false otherwise.
 */
export function writeOutputFile(outputFilePath: string, content: string): boolean {
    const relativeOutputPath = path.relative(process.cwd(), outputFilePath).split(path.sep).join('/');
    console.log(`${logPrefix} Writing output to ${relativeOutputPath}...`);
    try {
        const outputDir = path.dirname(outputFilePath);
        // Ensure directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`${logPrefix} Created directory: ${path.relative(process.cwd(), outputDir)}`);
        }
        fs.writeFileSync(outputFilePath, content, 'utf8');
        console.log(`${logPrefix} ✅ Successfully wrote ${content.length} characters to ${relativeOutputPath}.`);
        return true;
    } catch (writeError) {
        console.error(`${logPrefix} ❌ Error writing output file ${relativeOutputPath}: ${writeError instanceof Error ? writeError.message : writeError}`);
        return false;
    }
}