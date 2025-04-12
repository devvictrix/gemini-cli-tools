// src/inspector/inspector.service.ts
import { promises as fs } from "fs";
import * as path from "path";
import { INSPECTOR_INCLUDE_EXTENSIONS, INSPECTOR_EXCLUDE_PATTERNS, INSPECTOR_EXCLUDE_FILENAMES } from './inspector.config';
import { getAllFiles, filterLines } from './utils/file.utils';

/**
 * Finds all relevant source files within a directory based on config.
 * @param rootDir The root directory to scan.
 * @param filePrefix Optional file prefix filter.
 * @returns A promise resolving to an array of absolute file paths.
 * @throws Error if the root directory cannot be accessed or is not a directory.
 */
export async function getTargetFiles(rootDir: string, filePrefix: string = ""): Promise<string[]> {
    console.log(`[Inspector] Searching for target files in root: ${rootDir}${filePrefix ? `, prefix: '${filePrefix}'` : ''}`);
    let absRoot: string;
    try {
        absRoot = path.resolve(rootDir);
        const stats = await fs.stat(absRoot);
        if (!stats.isDirectory()) {
            throw new Error(`Target path is not a directory: ${rootDir}`);
        }
        await fs.access(absRoot);
    } catch (error) {
        console.error(`[Inspector] Error accessing target directory: ${rootDir}`);
        throw new Error(`Inspector failed: Cannot access target directory '${rootDir}'. ${error instanceof Error ? error.message : ''}`);
    }

    // Get all file paths recursively, passing exclusion config.
    const allFiles = await getAllFiles(absRoot, INSPECTOR_EXCLUDE_PATTERNS, INSPECTOR_EXCLUDE_FILENAMES);
    console.log(`[Inspector] Found ${allFiles.length} potential files in directory tree.`);

    const targetFiles = allFiles.filter(filePath => {
        const fileName = path.basename(filePath);
        const passesPrefix = !filePrefix || fileName.startsWith(filePrefix);
        const passesExtension = INSPECTOR_INCLUDE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
        return passesPrefix && passesExtension;
    });

    console.log(`[Inspector] Found ${targetFiles.length} target files matching criteria.`);
    return targetFiles;
}

/**
 * Consolidates source files from a directory into a single string.
 * @param rootDir The root directory to scan.
 * @param filePrefix Optional file prefix filter.
 * @returns A promise resolving to the consolidated source code string, including a header.
 * @throws Error if the root directory cannot be accessed.
 */
export async function getConsolidatedSources(rootDir: string, filePrefix: string = ""): Promise<string> {
    console.log(`[Inspector] Starting consolidation for root: ${rootDir}${filePrefix ? `, prefix: '${filePrefix}'` : ''}`);

    const seenFiles: Set<string> = new Set();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    let absRoot: string;
    try {
        absRoot = path.resolve(rootDir); // Resolve relative to current working directory
        await fs.access(absRoot); // Check if directory exists and is accessible
    } catch (error) {
        console.error(`[Inspector] Error accessing root directory: ${rootDir}`);
        throw new Error(`Inspector failed: Cannot access root directory '${rootDir}'. ${error instanceof Error ? error.message : ''}`);
    }


    // Build the header.
    const header = `// Consolidated sources from: ${absRoot}\n` +
        `// Consolidation timestamp: ${now}\n` +
        `// Tool Name: gemini-poc (inspector module)\n` + // Updated tool name
        `// Root Directory: ${absRoot}\n` +
        `// Include Extensions: ${[...INSPECTOR_INCLUDE_EXTENSIONS].sort().join(", ")}\n` +
        `// Exclude Patterns/Files: ${[...INSPECTOR_EXCLUDE_PATTERNS, ...INSPECTOR_EXCLUDE_FILENAMES].sort().join(", ")}\n\n`;

    let outputContent = header;

    // Get all file paths recursively, passing exclusion config.
    const allFiles = await getAllFiles(absRoot, INSPECTOR_EXCLUDE_PATTERNS, INSPECTOR_EXCLUDE_FILENAMES);
    console.log(`[Inspector] Found ${allFiles.length} potential files.`);

    for (const filePath of allFiles) {
        const fileName = path.basename(filePath);

        // Apply file prefix filter if provided.
        if (filePrefix && !fileName.startsWith(filePrefix)) {
            continue;
        }

        // Skip files with unsupported extension (already partly handled by getAllFiles logic but double-check)
        if (!INSPECTOR_INCLUDE_EXTENSIONS.has(path.extname(fileName).toLowerCase())) {
            continue;
        }

        let canonicalPath: string;
        try {
            canonicalPath = await fs.realpath(filePath);
        } catch (realpathError) {
            console.warn(`[Inspector] Warning: Could not get real path for ${filePath}. Skipping. Error: ${realpathError instanceof Error ? realpathError.message : realpathError}`);
            continue;
        }

        if (seenFiles.has(canonicalPath)) {
            // console.log(`  [Inspector] Skipping already seen file: ${canonicalPath}`);
            continue;
        }
        seenFiles.add(canonicalPath);

        // Compute relative and friendly path.
        const relativePath = path.relative(absRoot, canonicalPath);
        const friendlyPath = relativePath.split(path.sep).join("/"); // Normalize path separators
        const commentLine = `// File: ${friendlyPath}`; // Make comment clearer
        console.log(`  [Inspector] Processing: ${friendlyPath}`);


        // Read file content.
        let fileData: string;
        let lines: string[];
        try {
            fileData = await fs.readFile(canonicalPath, "utf-8");
            lines = fileData.split(/\r?\n/); // Handle different line endings
        } catch (error) {
            console.warn(`  [Inspector] Warning: Error reading ${friendlyPath}. Skipping. Error: ${error instanceof Error ? error.message : error}`);
            continue;
        }

        // Filter lines (remove preamble, duplicates)
        const filtered = filterLines(lines, friendlyPath);

        // Add content only if there's something left after filtering
        if (filtered.length > 0 || fileData.trim() !== '') { // Add empty files too if they aren't just whitespace
            outputContent += `${commentLine}\n\n`;
            outputContent += filtered.join("\n") + "\n\n";
        } else {
            console.log(`  [Inspector] Skipping empty or fully filtered file: ${friendlyPath}`);
        }
    }

    console.log(`[Inspector] Consolidation complete. Total length: ${outputContent.length} characters.`);
    return outputContent;
}