// File: src/shared/utils/filesystem.utils.ts

import { promises as fs } from "fs";
import * as path from "path";
import { INCLUDE_EXTENSIONS, EXCLUDE_PATTERNS, EXCLUDE_FILENAMES } from '../constants/filesystem.constants';
import { filterLines, getAllFiles } from "../helpers/filesystem.helper.js"; // Assuming .js if built

const logPrefix = "[FileSystemUtil]";

// --- ADD patternToRegex HELPER ---
/**
 * Converts a simple glob-like pattern (*aaa, aaa*, *aaa*, aaa) to a RegExp.
 * Case-insensitive matching.
 * Escapes basic regex special characters in the non-wildcard part.
 */
function patternToRegex(pattern: string): RegExp {
    // Escape common regex special characters in the pattern body
    const escapeRegex = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    let regexPattern = pattern;
    let startsWithWildcard = false;
    let endsWithWildcard = false;

    if (regexPattern.startsWith('*')) {
        startsWithWildcard = true;
        regexPattern = regexPattern.substring(1);
    }
    if (regexPattern.endsWith('*')) {
        endsWithWildcard = true;
        regexPattern = regexPattern.substring(0, regexPattern.length - 1);
    }

    // Escape the remaining core part
    const corePattern = escapeRegex(regexPattern);

    if (!corePattern && (startsWithWildcard || endsWithWildcard)) {
        // Handle '*' or '**' -> match anything (non-empty)
        return /.+/i;
    }

    if (startsWithWildcard && endsWithWildcard) {
        // Contains: *aaa* -> /aaa/i
        return new RegExp(corePattern, 'i');
    } else if (startsWithWildcard) {
        // Ends with: *aaa -> /aaa$/i
        return new RegExp(corePattern + '$', 'i');
    } else if (endsWithWildcard) {
        // Starts with: aaa* -> /^aaa/i
        return new RegExp('^' + corePattern, 'i');
    } else {
        // Exact match: aaa -> /^aaa$/i
        return new RegExp('^' + corePattern + '$', 'i');
    }
}
// --- END HELPER ---


// getTargetFiles function remains the same (uses only prefix)
export async function getTargetFiles(rootDir: string, filePrefix: string = ""): Promise<string[]> {
    // ... (implementation as before) ...
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
 * Consolidates source files from a directory into a single string, applying filters.
 *
 * @param {string} rootDir - The root directory to consolidate files from.
 * @param {string} [filePrefix] - Optional file prefix filter (used ONLY if pattern is not provided).
 * @param {string} [pattern] - Optional filename pattern filter (e.g., "*aaa", "aaa*", "*aaa*"). Takes precedence over filePrefix.
 * @returns {Promise<string>} A promise resolving to the consolidated content string.
 * @throws {Error} If the root directory is not accessible.
 */
export async function getConsolidatedSources(
    rootDir: string,
    filePrefix?: string, // Keep for other commands
    pattern?: string     // Add pattern
): Promise<string> {
    // Determine which filter is active and log appropriately
    let activeFilterLog = '';
    let filterRegex: RegExp | null = null;
    let usePrefix = false;

    if (pattern) {
        activeFilterLog = `, pattern: '${pattern}'`;
        filterRegex = patternToRegex(pattern);
    } else if (filePrefix) {
        activeFilterLog = `, prefix: '${filePrefix}'`;
        usePrefix = true;
    }
    console.log(`${logPrefix} Starting consolidation for root: ${rootDir}${activeFilterLog}`);

    const seenFiles: Set<string> = new Set();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    let absRoot: string;
    try {
        absRoot = path.resolve(rootDir);
        await fs.access(absRoot);
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
    const allFiles = await getAllFiles(absRoot, EXCLUDE_PATTERNS, EXCLUDE_FILENAMES);
    console.log(`${logPrefix} Found ${allFiles.length} potential files (after exclusions).`);

    for (const filePath of allFiles) {
        const fileName = path.basename(filePath);

        // --- Apply Filtering Logic ---
        if (filterRegex) { // Pattern takes precedence
            if (!filterRegex.test(fileName)) continue;
        } else if (usePrefix) { // Use prefix only if pattern wasn't provided
            if (!fileName.startsWith(filePrefix!)) continue;
        }
        // --- End Filtering Logic ---

        if (!INCLUDE_EXTENSIONS.has(path.extname(fileName).toLowerCase())) continue;

        let canonicalPath: string;
        try {
            canonicalPath = await fs.realpath(filePath);
        } catch (realpathError) {
            console.warn(`${logPrefix} Warning: Could not get real path for ${filePath}. Skipping. Error: ${realpathError instanceof Error ? realpathError.message : realpathError}`);
            continue;
        }

        if (seenFiles.has(canonicalPath)) continue;
        seenFiles.add(canonicalPath);

        const relativePath = path.relative(absRoot, canonicalPath);
        const friendlyPath = relativePath.split(path.sep).join("/");
        const commentLine = `// File: ${friendlyPath}`;
        console.log(`  ${logPrefix} Processing: ${friendlyPath}`);

        let fileData: string;
        let lines: string[];
        try {
            fileData = await fs.readFile(canonicalPath, "utf-8");
            lines = fileData.split(/\r?\n/);
        } catch (error) {
            console.warn(`  ${logPrefix} Warning: Error reading ${friendlyPath}. Skipping. Error: ${error instanceof Error ? error.message : error}`);
            continue;
        }

        const filtered = filterLines(lines, friendlyPath);

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