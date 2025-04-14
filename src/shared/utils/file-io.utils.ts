// src/shared/utils/file-io.utils.ts

import * as fs from 'fs';
import * as path from 'path';

const logPrefix = "[FileIO]";

/**
 * Reads the content of a single file synchronously.
 */
export function readSingleFile(filePath: string): string {
    const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
    try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            throw new Error(`Target path is not a file: ${relativeFilePath}`);
        }
        const content = fs.readFileSync(filePath, 'utf8');
        // console.log(`${logPrefix} Read ${content.length} chars from ${relativeFilePath}.`); // Keep logging minimal
        return content;
    } catch (readError) {
        console.error(`${logPrefix} ❌ Error reading file ${relativeFilePath}: ${readError instanceof Error ? readError.message : readError}`);
        throw readError;
    }
}

/**
 * Updates the content of a file synchronously. Creates parent directory if needed.
 */
export function updateFileContent(filePath: string, newContent: string): boolean {
    const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
    console.warn(`${logPrefix} ⚠️ Attempting to overwrite ${relativeFilePath}...`);
    try {
        const outputDir = path.dirname(filePath);
        if (!fs.existsSync(outputDir)) {
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
 */
export function writeOutputFile(outputFilePath: string, content: string): boolean {
    const relativeOutputPath = path.relative(process.cwd(), outputFilePath).split(path.sep).join('/');
    console.log(`${logPrefix} Writing output to ${relativeOutputPath}...`);
    try {
        const outputDir = path.dirname(outputFilePath);
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