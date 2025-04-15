// File: src/shared/utils/file-io.utils.ts

import * as fs from 'fs';
import * as path from 'path';

const logPrefix = "[FileIO]";

/**
 * Reads the content of a single file synchronously.
 * @param {string} filePath - The path to the file to read.
 * @returns {string} The content of the file as a string.
 * @throws {Error} If the file does not exist or cannot be read.
 */
export function readSingleFile(filePath: string): string {
    // Create a relative file path for logging purposes.  This improves readability of log messages.
    const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
    try {
        // Check if the provided path is actually a file.
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            throw new Error(`Target path is not a file: ${relativeFilePath}`);
        }
        // Read the file content in UTF-8 encoding.  UTF-8 is a good default for most text files.
        const content = fs.readFileSync(filePath, 'utf8');
        // console.log(`${logPrefix} Read ${content.length} chars from ${relativeFilePath}.`); // Keep logging minimal
        return content;
    } catch (readError) {
        // Log the error and re-throw it.  Re-throwing allows the calling function to handle the error as needed.
        console.error(`${logPrefix} ❌ Error reading file ${relativeFilePath}: ${readError instanceof Error ? readError.message : readError}`);
        throw readError;
    }
}

/**
 * Updates the content of a file synchronously. Creates parent directory if needed.
 * @param {string} filePath - The path to the file to update.
 * @param {string} newContent - The new content to write to the file.
 * @returns {boolean} True if the file was successfully updated, false otherwise.
 */
export function updateFileContent(filePath: string, newContent: string): boolean {
    // Create a relative file path for logging purposes.
    const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
    // Add a warning log before overwriting a file. This is good practice to alert the user of potential data loss.
    console.warn(`${logPrefix} ⚠️ Attempting to overwrite ${relativeFilePath}...`);
    try {
        // Get the directory of the file.
        const outputDir = path.dirname(filePath);
        // Check if the directory exists. If not, create it recursively.
        if (!fs.existsSync(outputDir)) {
            // Create the directory recursively if it doesn't exist. The `recursive: true` option ensures that parent directories are also created if they don't exist.
            fs.mkdirSync(outputDir, { recursive: true });
            // Log the creation of the directory.
            console.log(`${logPrefix} Created directory: ${path.relative(process.cwd(), outputDir)}`);
        }
        // Write the new content to the file in UTF-8 encoding.
        fs.writeFileSync(filePath, newContent, 'utf8');
        // Log the successful update.
        console.log(`${logPrefix} ✅ Successfully updated ${relativeFilePath}.`);
        return true;
    } catch (writeError) {
        // Log the error and return false. Returning false allows the calling function to handle the error.
        console.error(`${logPrefix} ❌ Error writing file ${relativeFilePath}: ${writeError instanceof Error ? writeError.message : writeError}`);
        return false;
    }
}

/**
 * Writes content to a specified output file. Creates parent directory if needed.
 * @param {string} outputFilePath - The path to the output file.
 * @param {string} content - The content to write to the output file.
 * @returns {boolean} True if the file was successfully written, false otherwise.
 */
export function writeOutputFile(outputFilePath: string, content: string): boolean {
    // Create a relative output path for logging purposes.
    const relativeOutputPath = path.relative(process.cwd(), outputFilePath).split(path.sep).join('/');
    // Log the intention to write to the output file.
    console.log(`${logPrefix} Writing output to ${relativeOutputPath}...`);
    try {
        // Get the directory of the output file.
        const outputDir = path.dirname(outputFilePath);
        // Check if the directory exists. If not, create it recursively.
        if (!fs.existsSync(outputDir)) {
            // Create the directory recursively if it doesn't exist. The `recursive: true` option ensures that parent directories are also created if they don't exist.
            fs.mkdirSync(outputDir, { recursive: true });
            // Log the creation of the directory.
            console.log(`${logPrefix} Created directory: ${path.relative(process.cwd(), outputDir)}`);
        }
        // Write the content to the output file in UTF-8 encoding.
        fs.writeFileSync(outputFilePath, content, 'utf8');
        // Log the successful write.
        console.log(`${logPrefix} ✅ Successfully wrote ${content.length} characters to ${relativeOutputPath}.`);
        return true;
    } catch (writeError) {
        // Log the error and return false. Returning false allows the calling function to handle the error.
        console.error(`${logPrefix} ❌ Error writing output file ${relativeOutputPath}: ${writeError instanceof Error ? writeError.message : writeError}`);
        return false;
    }
}