// File: src/shared/utils/filesystem.utils.ts

import { promises as fs } from "fs";
import * as path from "path";
import { INCLUDE_EXTENSIONS, EXCLUDE_PATTERNS, EXCLUDE_FILENAMES } from '../constants/filesystem.constants.js'; // Correct path
import { filterLines, getAllFiles } from "../helpers/filesystem.helper.js"; // Correct path

const logPrefix = "[FileSystemUtil]"; // Renamed prefix for clarity

/**
 * Finds all relevant source files within a directory based on config.
 * @param {string} rootDir - The root directory to search in.
 * @param {string} [filePrefix=""] - An optional file prefix to filter files by.
 * @returns {Promise<string[]>} A promise that resolves to an array of file paths that match the criteria.
 * @throws {Error} If the target directory does not exist or is not accessible.
 */
export async function getTargetFiles(rootDir: string, filePrefix: string = ""): Promise<string[]> {
    console.log(`${logPrefix} Searching for target files in root: ${rootDir}${filePrefix ? `, prefix: '${filePrefix}'` : ''}`);
    let absRoot: string;
    try {
        absRoot = path.resolve(rootDir); // Resolve the root directory to an absolute path.
        const stats = await fs.stat(absRoot);
        if (!stats.isDirectory()) {
            throw new Error(`Target path is not a directory: ${rootDir}`);
        }
        await fs.access(absRoot); // Verify we have access to the directory.
    } catch (error) {
        console.error(`${logPrefix} Error accessing target directory: ${rootDir}`);
        throw new Error(`Failed: Cannot access target directory '${rootDir}'. ${error instanceof Error ? error.message : ''}`);
    }

    const allFiles = await getAllFiles(absRoot, EXCLUDE_PATTERNS, EXCLUDE_FILENAMES); // Use helper
    console.log(`${logPrefix} Found ${allFiles.length} potential files in directory tree.`);

    const targetFiles = allFiles.filter(filePath => {
        const fileName = path.basename(filePath); // Extract the filename from the full path.
        const passesPrefix = !filePrefix || fileName.startsWith(filePrefix); // Check if the filename starts with the given prefix.
        const passesExtension = INCLUDE_EXTENSIONS.has(path.extname(fileName).toLowerCase()); // Check if the file extension is in the allowed list.
        return passesPrefix && passesExtension;
    });

    console.log(`${logPrefix} Found ${targetFiles.length} target files matching criteria.`);
    return targetFiles;
}

/**
 * Consolidates source files from a directory into a single string.
 * @param {string} rootDir - The root directory to consolidate files from.
 * @param {string} [filePrefix=""] - An optional file prefix to filter files by.
 * @returns {Promise<string>} A promise that resolves to a single string containing the concatenated content of all target files.
 * @throws {Error} If the root directory does not exist or is not accessible.
 */
export async function getConsolidatedSources(rootDir: string, filePrefix: string = ""): Promise<string> {
    console.log(`${logPrefix} Starting consolidation for root: ${rootDir}${filePrefix ? `, prefix: '${filePrefix}'` : ''}`);

    const seenFiles: Set<string> = new Set(); // Keep track of files already processed to avoid duplicates.
    const now = new Date().toISOString().slice(0, 19).replace("T", " "); // Get current timestamp for the header.
    let absRoot: string;
    try {
        absRoot = path.resolve(rootDir); // Resolve the root directory to an absolute path.
        await fs.access(absRoot); // Verify we have access to the directory.
    } catch (error) {
        console.error(`${logPrefix} Error accessing root directory: ${rootDir}`);
        throw new Error(`Failed: Cannot access root directory '${rootDir}'. ${error instanceof Error ? error.message : ''}`);
    }

    const header = `// Consolidated sources from: ${absRoot}\n` +
        `// Consolidation timestamp: ${now}\n` +
        `// Tool Name: gemini-poc (inspector module)\n` +
        `// Root Directory: ${absRoot}\n` +
        `// Include Extensions: ${[...INCLUDE_EXTENSIONS].sort().join(", ")}\n` +
        `// Exclude Patterns/Files: ${[...EXCLUDE_PATTERNS, ...EXCLUDE_FILENAMES].sort().join(", ")}\n\n`;

    let outputContent = header;
    const allFiles = await getAllFiles(absRoot, EXCLUDE_PATTERNS, EXCLUDE_FILENAMES); // Use helper
    console.log(`${logPrefix} Found ${allFiles.length} potential files.`);

    for (const filePath of allFiles) {
        const fileName = path.basename(filePath); // Extract the filename from the full path.
        if (filePrefix && !fileName.startsWith(filePrefix)) continue;
        if (!INCLUDE_EXTENSIONS.has(path.extname(fileName).toLowerCase())) continue;

        let canonicalPath: string;
        try {
            canonicalPath = await fs.realpath(filePath); // Get the absolute, canonical path to handle symlinks correctly.
        } catch (realpathError) {
            console.warn(`${logPrefix} Warning: Could not get real path for ${filePath}. Skipping. Error: ${realpathError instanceof Error ? realpathError.message : realpathError}`);
            continue;
        }

        if (seenFiles.has(canonicalPath)) continue; // Skip if already processed.
        seenFiles.add(canonicalPath);

        const relativePath = path.relative(absRoot, canonicalPath); // Get the relative path from the root directory.
        const friendlyPath = relativePath.split(path.sep).join("/"); // Convert the path to a platform-independent format.
        const commentLine = `// File: ${friendlyPath}`;
        console.log(`  ${logPrefix} Processing: ${friendlyPath}`);

        let fileData: string;
        let lines: string[];
        try {
            fileData = await fs.readFile(canonicalPath, "utf-8"); // Read the file content.
            lines = fileData.split(/\r?\n/); // Split the file content into lines.
        } catch (error) {
            console.warn(`  ${logPrefix} Warning: Error reading ${friendlyPath}. Skipping. Error: ${error instanceof Error ? error.message : error}`);
            continue;
        }

        const filtered = filterLines(lines, friendlyPath); // Filter the lines based on exclude patterns.

        if (filtered.length > 0 || fileData.trim() !== '') {
            outputContent += `${commentLine}\n\n`;
            outputContent += filtered.join("\n") + "\n\n";
        } else {
            console.log(`  ${logPrefix} Skipping empty or fully filtered file: ${friendlyPath}`);
        }
    }

    console.log(`${logPrefix} Consolidation complete. Total length: ${outputContent.length} characters.`);
    return outputContent;
}