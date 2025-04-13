// File: src/shared/helpers/source-aggregator.helper.ts

// File: src/shared/utils/filesystem.utils.ts // New File

import { promises as fs } from "fs";
import * as path from "path";
import { INCLUDE_EXTENSIONS, EXCLUDE_PATTERNS, EXCLUDE_FILENAMES } from '../constants/filesystem.constants.js'; // Updated import path
import { filterLines, getAllFiles } from "../index.js";

const logPrefix = "[FileSystem]"; // Consistent logging prefix

/**
 * Finds all relevant source files within a directory based on config.
 * @param rootDir The root directory to scan.
 * @param filePrefix Optional file prefix filter.
 * @returns A promise resolving to an array of absolute file paths.
 * @throws {Error} If the root directory cannot be accessed or is not a directory.
 */
export async function getTargetFiles(rootDir: string, filePrefix: string = ""): Promise<string[]> {
    console.log(`${logPrefix} Searching for target files in root: ${rootDir}${filePrefix ? `, prefix: '${filePrefix}'` : ''}`);
    let absRoot: string;
    try {
        absRoot = path.resolve(rootDir);
        const stats = await fs.stat(absRoot);
        if (!stats.isDirectory()) {
            throw new Error(`Target path is not a directory: ${rootDir}`);
        }
        await fs.access(absRoot);
    } catch (error) {
        console.error(`${logPrefix} Error accessing target directory: ${rootDir}`);
        throw new Error(`${logPrefix} failed: Cannot access target directory '${rootDir}'. ${error instanceof Error ? error.message : ''}`);
    }

    // Get all file paths recursively, passing exclusion config.
    const allFiles = await getAllFiles(absRoot, EXCLUDE_PATTERNS, EXCLUDE_FILENAMES);
    console.log(`${logPrefix} Found ${allFiles.length} potential files in directory tree.`);

    const targetFiles = allFiles.filter(filePath => {
        const fileName = path.basename(filePath);
        const passesPrefix = !filePrefix || fileName.startsWith(filePrefix);
        const passesExtension = INCLUDE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
        // Log filtering decision (optional, can be verbose)
        // if (passesPrefix && passesExtension) {
        //     console.log(`${logPrefix} - Including: ${fileName}`);
        // } else {
        //     console.log(`${logPrefix} - Excluding: ${fileName} (Prefix: ${passesPrefix}, Ext: ${passesExtension})`);
        // }
        return passesPrefix && passesExtension;
    });

    console.log(`${logPrefix} Found ${targetFiles.length} target files matching criteria.`);
    return targetFiles;
}

/**
 * Consolidates source files from a directory into a single string.
 * @param rootDir The root directory to scan.
 * @param filePrefix Optional file prefix filter.
 * @returns A promise resolving to the consolidated source code string, including a header.
 * @throws {Error} If the root directory cannot be accessed.
 */
export async function getConsolidatedSources(rootDir: string, filePrefix: string = ""): Promise<string> {
    console.log(`${logPrefix} Starting consolidation for root: ${rootDir}${filePrefix ? `, prefix: '${filePrefix}'` : ''}`);

    const seenFiles: Set<string> = new Set();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    let absRoot: string;
    try {
        absRoot = path.resolve(rootDir); // Resolve relative to current working directory
        await fs.access(absRoot); // Check if directory exists and is accessible
    } catch (error) {
        console.error(`${logPrefix} Error accessing root directory: ${rootDir}`);
        throw new Error(`${logPrefix} failed: Cannot access root directory '${rootDir}'. ${error instanceof Error ? error.message : ''}`);
    }


    // Build the header.
    const header = `// Consolidated sources from: ${absRoot}\n` +
        `// Consolidation timestamp: ${now}\n` +
        `// Tool Name: gemini-poc (inspector module)\n` +
        `// Root Directory: ${absRoot}\n` +
        `// Include Extensions: ${[...INCLUDE_EXTENSIONS].sort().join(", ")}\n` +
        `// Exclude Patterns/Files: ${[...EXCLUDE_PATTERNS, ...EXCLUDE_FILENAMES].sort().join(", ")}\n\n`;

    let outputContent = header;

    // Get all file paths recursively, passing exclusion config.
    const allFiles = await getAllFiles(absRoot, EXCLUDE_PATTERNS, EXCLUDE_FILENAMES);
    console.log(`${logPrefix} Found ${allFiles.length} potential files.`);

    for (const filePath of allFiles) {
        const fileName = path.basename(filePath);

        // Apply file prefix filter if provided.
        if (filePrefix && !fileName.startsWith(filePrefix)) {
            continue;
        }

        // Skip files with unsupported extension (redundant check, but safe)
        if (!INCLUDE_EXTENSIONS.has(path.extname(fileName).toLowerCase())) {
            continue;
        }

        let canonicalPath: string;
        try {
            canonicalPath = await fs.realpath(filePath); // Resolve symlinks
        } catch (realpathError) {
            console.warn(`${logPrefix} Warning: Could not get real path for ${filePath}. Skipping. Error: ${realpathError instanceof Error ? realpathError.message : realpathError}`);
            continue;
        }

        if (seenFiles.has(canonicalPath)) {
            // console.log(`  ${logPrefix} Skipping already seen file: ${canonicalPath}`);
            continue; // Skip already processed files
        }
        seenFiles.add(canonicalPath);

        // Compute relative and friendly path.
        const relativePath = path.relative(absRoot, canonicalPath);
        const friendlyPath = relativePath.split(path.sep).join("/"); // Normalize path separators
        const commentLine = `// File: ${friendlyPath}`;
        console.log(`  ${logPrefix} Processing: ${friendlyPath}`);


        // Read file content.
        let fileData: string;
        let lines: string[];
        try {
            fileData = await fs.readFile(canonicalPath, "utf-8");
            lines = fileData.split(/\r?\n/);
        } catch (error) {
            console.warn(`  ${logPrefix} Warning: Error reading ${friendlyPath}. Skipping. Error: ${error instanceof Error ? error.message : error}`);
            continue;
        }

        // Filter lines (remove preamble, duplicates)
        const filtered = filterLines(lines, friendlyPath);

        // Add content only if there's something left after filtering
        // Add empty files too if they aren't just whitespace
        if (filtered.length > 0 || fileData.trim() !== '') {
            outputContent += `${commentLine}\n\n`;
            outputContent += filtered.join("\n") + "\n\n";
        } else {
            console.log(`  ${logPrefix} Skipping empty or fully filtered file: ${friendlyPath}`);
        }
    } // End for loop

    console.log(`${logPrefix} Consolidation complete. Total length: ${outputContent.length} characters.`);
    return outputContent;
}