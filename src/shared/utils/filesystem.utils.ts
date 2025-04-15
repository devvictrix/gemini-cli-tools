// File: src/shared/utils/filesystem.utils.ts

import { promises as fs } from "fs";
import * as path from "path";
import { INCLUDE_EXTENSIONS, EXCLUDE_PATTERNS, EXCLUDE_FILENAMES } from '../constants/filesystem.constants';
import { filterLines, getAllFiles } from "../helpers/filesystem.helper.js";

/**
 * @constant {string} logPrefix - A constant string used as a prefix for all log messages originating from this module.
 * This helps in easily identifying the source of log messages.
 */
const logPrefix = "[FileSystemUtil]";

/**
 * Finds all relevant source files within a directory based on specified criteria such as allowed extensions,
 * optional file prefix, and exclusion patterns.
 *
 * @param {string} rootDir - The root directory to search for source files in.  This should be an absolute path for consistent behavior.
 * @param {string} [filePrefix=""] - An optional file prefix to filter files by. Only files starting with this prefix will be included.
 *                                   This can be useful when you need to process only a subset of files in a directory.
 * @returns {Promise<string[]>} A promise that resolves to an array of absolute file paths that match the specified criteria.
 *                              If no files are found, an empty array is returned.
 * @throws {Error} If the target directory does not exist or is not accessible. The error message will indicate the reason for failure.
 */
export async function getTargetFiles(rootDir: string, filePrefix: string = ""): Promise<string[]> {
    console.log(`${logPrefix} Searching for target files in root: ${rootDir}${filePrefix ? `, prefix: '${filePrefix}'` : ''}`);

    let absRoot: string;
    try {
        absRoot = path.resolve(rootDir); // Resolve the root directory to an absolute path.  This ensures consistent behavior regardless of the current working directory.
        const stats = await fs.stat(absRoot);
        if (!stats.isDirectory()) {
            throw new Error(`Target path is not a directory: ${rootDir}`); // Early exit if the provided path is not a directory.
        }
        await fs.access(absRoot); // Verify we have access to the directory.  This prevents errors later on if the process lacks read permissions.
    } catch (error) {
        console.error(`${logPrefix} Error accessing target directory: ${rootDir}`);
        throw new Error(`Failed: Cannot access target directory '${rootDir}'. ${error instanceof Error ? error.message : ''}`); // Re-throw the error with a more informative message.
    }

    const allFiles = await getAllFiles(absRoot, EXCLUDE_PATTERNS, EXCLUDE_FILENAMES); // Use helper function to get all files recursively while respecting exclusion patterns.
    console.log(`${logPrefix} Found ${allFiles.length} potential files in directory tree.`);

    const targetFiles = allFiles.filter(filePath => {
        const fileName = path.basename(filePath); // Extract the filename from the full path for easier filtering.
        const passesPrefix = !filePrefix || fileName.startsWith(filePrefix); // Check if the filename starts with the given prefix, or if no prefix is specified.
        const passesExtension = INCLUDE_EXTENSIONS.has(path.extname(fileName).toLowerCase()); // Check if the file extension is in the allowed list (case-insensitive).
        return passesPrefix && passesExtension; // Include the file only if it passes both the prefix and extension checks.
    });

    console.log(`${logPrefix} Found ${targetFiles.length} target files matching criteria.`);
    return targetFiles;
}

/**
 * Consolidates source files from a directory into a single string.  This function reads the content of all target files,
 * prepends a header with metadata about the consolidation process, and concatenates the content into a single string.
 *
 * @param {string} rootDir - The root directory to consolidate files from. This should be an absolute path for consistent behavior.
 * @param {string} [filePrefix=""] - An optional file prefix to filter files by. Only files starting with this prefix will be included.
 *                                   This can be useful when you need to consolidate only a subset of files in a directory.
 * @returns {Promise<string>} A promise that resolves to a single string containing the concatenated content of all target files.
 *                              The string includes a header with metadata about the consolidation.
 * @throws {Error} If the root directory does not exist or is not accessible.  The error message will indicate the reason for failure.
 */
export async function getConsolidatedSources(rootDir: string, filePrefix: string = ""): Promise<string> {
    console.log(`${logPrefix} Starting consolidation for root: ${rootDir}${filePrefix ? `, prefix: '${filePrefix}'` : ''}`);

    const seenFiles: Set<string> = new Set(); // Keep track of files already processed to avoid duplicates, especially important when dealing with symlinks.
    const now = new Date().toISOString().slice(0, 19).replace("T", " "); // Get current timestamp for the header.  This helps track when the consolidation was performed.
    let absRoot: string;
    try {
        absRoot = path.resolve(rootDir); // Resolve the root directory to an absolute path. This ensures consistent behavior regardless of the current working directory.
        await fs.access(absRoot); // Verify we have access to the directory. This prevents errors later on if the process lacks read permissions.
    } catch (error) {
        console.error(`${logPrefix} Error accessing root directory: ${rootDir}`);
        throw new Error(`Failed: Cannot access root directory '${rootDir}'. ${error instanceof Error ? error.message : ''}`); // Re-throw the error with a more informative message.
    }

    const header = `// Consolidated sources from: ${absRoot}\n` +
        `// Consolidation timestamp: ${now}\n` +
        `// Tool Name: gemini-poc (inspector module)\n` +
        `// Root Directory: ${absRoot}\n` +
        `// Include Extensions: ${[...INCLUDE_EXTENSIONS].sort().join(", ")}\n` +
        `// Exclude Patterns/Files: ${[...EXCLUDE_PATTERNS, ...EXCLUDE_FILENAMES].sort().join(", ")}\n\n`; // Header containing metadata about the consolidation.  Includes important configuration information.

    let outputContent = header;
    const allFiles = await getAllFiles(absRoot, EXCLUDE_PATTERNS, EXCLUDE_FILENAMES); // Use helper function to get all files recursively while respecting exclusion patterns.
    console.log(`${logPrefix} Found ${allFiles.length} potential files.`);

    for (const filePath of allFiles) {
        const fileName = path.basename(filePath); // Extract the filename from the full path for easier filtering.
        if (filePrefix && !fileName.startsWith(filePrefix)) continue; // Skip files that don't match the specified prefix (if any).
        if (!INCLUDE_EXTENSIONS.has(path.extname(fileName).toLowerCase())) continue; // Skip files that don't have the allowed extensions.

        let canonicalPath: string;
        try {
            canonicalPath = await fs.realpath(filePath); // Get the absolute, canonical path to handle symlinks correctly. This is crucial to avoid processing the same file multiple times.
        } catch (realpathError) {
            console.warn(`${logPrefix} Warning: Could not get real path for ${filePath}. Skipping. Error: ${realpathError instanceof Error ? realpathError.message : realpathError}`);
            continue; // Skip the file if we can't resolve its real path.  This prevents potential issues with symlinks.
        }

        if (seenFiles.has(canonicalPath)) continue; // Skip if already processed.  This prevents duplicates, especially when dealing with symlinks.
        seenFiles.add(canonicalPath);

        const relativePath = path.relative(absRoot, canonicalPath); // Get the relative path from the root directory. This is used for a more user-friendly file path in the output.
        const friendlyPath = relativePath.split(path.sep).join("/"); // Convert the path to a platform-independent format (using forward slashes). This ensures consistency across different operating systems.
        const commentLine = `// File: ${friendlyPath}`; // Create a comment line with the file path for easy identification in the consolidated output.
        console.log(`  ${logPrefix} Processing: ${friendlyPath}`);

        let fileData: string;
        let lines: string[];
        try {
            fileData = await fs.readFile(canonicalPath, "utf-8"); // Read the file content as UTF-8. UTF-8 is a widely supported encoding.
            lines = fileData.split(/\r?\n/); // Split the file content into lines, handling both Windows and Unix line endings.
        } catch (error) {
            console.warn(`  ${logPrefix} Warning: Error reading ${friendlyPath}. Skipping. Error: ${error instanceof Error ? error.message : error}`);
            continue; // Skip the file if there was an error reading it.
        }

        const filtered = filterLines(lines, friendlyPath); // Filter the lines based on exclude patterns.  This allows removing specific lines or comments from the consolidated output.

        if (filtered.length > 0 || fileData.trim() !== '') { // Only add the file content if it's not completely empty after filtering or initially not empty
            outputContent += `${commentLine}\n\n`; // Add the comment line with the file path.
            outputContent += filtered.join("\n") + "\n\n"; // Add the filtered file content to the output, with newlines separating the lines.
        } else {
            console.log(`  ${logPrefix} Skipping empty or fully filtered file: ${friendlyPath}`); // Log a message if the file is skipped because it's empty or fully filtered.
        }
    }

    console.log(`${logPrefix} Consolidation complete. Total length: ${outputContent.length} characters.`);
    return outputContent;
}