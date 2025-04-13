// File: src/shared/utils/file-io.utils.ts

import * as fs from 'fs';
import * as path from 'path';

export function readSingleFile(filePath: string): string {
    const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
    try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            throw new Error(`Target path is not a file: ${relativeFilePath}`);
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return content;
    } catch (readError) {
        console.error(`[FileIO] ❌ Error reading file ${relativeFilePath}: ${readError instanceof Error ? readError.message : readError}`);
        throw readError;
    }
}

export function updateFileContent(filePath: string, newContent: string): boolean {
    const relativeFilePath = path.relative(process.cwd(), filePath).split(path.sep).join('/');
    console.warn(`[FileIO] ⚠️ Attempting to overwrite ${relativeFilePath}...`);
    try {
        const outputDir = path.dirname(filePath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`[FileIO] Created directory: ${path.relative(process.cwd(), outputDir)}`);
        }
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`[FileIO] ✅ Successfully updated ${relativeFilePath}.`);
        return true;
    } catch (writeError) {
        console.error(`[FileIO] ❌ Error writing file ${relativeFilePath}: ${writeError instanceof Error ? writeError.message : writeError}`);
        return false;
    }
}

export function writeOutputFile(outputFilePath: string, content: string): boolean {
    const relativeOutputPath = path.relative(process.cwd(), outputFilePath).split(path.sep).join('/');
    console.log(`[FileIO] Writing output to ${relativeOutputPath}...`);
    try {
        const outputDir = path.dirname(outputFilePath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`[FileIO] Created directory: ${path.relative(process.cwd(), outputDir)}`);
        }
        fs.writeFileSync(outputFilePath, content, 'utf8');
        console.log(`[FileIO] ✅ Successfully wrote ${content.length} characters to ${relativeOutputPath}.`);
        return true;
    } catch (writeError) {
        console.error(`[FileIO] ❌ Error writing output file ${relativeOutputPath}: ${writeError instanceof Error ? writeError.message : writeError}`);
        return false;
    }
}
