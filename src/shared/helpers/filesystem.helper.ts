// File: src/shared/helpers/filesystem.helper.ts

import { promises as fs } from "fs";
import * as path from "path";

/**
 * @constant {string} logPrefix - A prefix used for logging messages from this module.
 * This helps to easily identify the source of log messages.
 */
const logPrefix = "[FileSystemHelper]";

/**
 * Converts a simple wildcard pattern (e.g., "*.ts", "file.*") into a RegExp object.
 * This is a helper function to enable glob-like file matching for exclusions.
 * @param pattern The wildcard string.
 * @returns A RegExp object for matching against filenames.
 */
function wildcardToRegex(pattern: string): RegExp {
    // Escape regex special characters, then convert wildcard '*' to '.*'
    const escapedPattern = pattern.replace(/[-\/\\^$+.()|[\]{}]/g, '\\$&');
    const regexPattern = escapedPattern.replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`, 'i'); // Anchor to start/end and make case-insensitive
}


/**
 * Recursively traverses a directory and returns all file paths, respecting exclusion patterns.
 * This function is designed to efficiently gather all files within a directory structure,
 * while allowing specific directories and files to be excluded from the results. This is
 * particularly useful for tasks such as code analysis or file processing where certain
 * files or directories (e.g., node_modules, .git) should be ignored.
 *
 * @async
 * @function getAllFiles
 * @param {string} dir - The directory to traverse.  This is the starting point for the recursive search.
 * @param {Set<string>} excludePatterns - A set of directory or file names to exclude from the traversal.
 *                                        If a directory or file name is present in this set, it will be skipped.
 * @param {Set<string>} excludeFilenames - A set of specific filenames to exclude from the traversal.
 *                                         This allows for the exclusion of specific files regardless of their location.
 * @param {Set<string>} excludeWildcards - A set of wildcard patterns for filenames to exclude.
 * @returns {Promise<string[]>} A promise that resolves to an array of file paths.  The array contains the absolute paths
 *                              of all files found within the directory, excluding those that matched the exclusion patterns.
 * @throws {Error} If there is an error reading a directory or statting a file. Errors are logged to the console.
 */
export async function getAllFiles(
    dir: string,
    excludePatterns: Set<string>,
    excludeFilenames: Set<string>,
    excludeWildcards: Set<string>
): Promise<string[]> {
    const wildcardRegexes = Array.from(excludeWildcards).map(wildcardToRegex);
    let results: string[] = [];
    try {
        const list = await fs.readdir(dir); // Read the contents of the directory
        for (const file of list) {
            const filePath = path.join(dir, file); // Create the full file path

            // Check if the current file or directory should be excluded.
            if (excludePatterns.has(file) || excludeFilenames.has(file)) {
                continue; // Skip if it matches exact directory/file exclusion
            }

            // Test filename against wildcard patterns
            if (wildcardRegexes.some(regex => regex.test(file))) {
                continue;
            }


            try {
                const stat = await fs.stat(filePath); // Get file/directory stats
                if (stat && stat.isDirectory()) {
                    // If the current path is a directory, recursively call getAllFiles to traverse it.
                    results = results.concat(await getAllFiles(filePath, excludePatterns, excludeFilenames, excludeWildcards)); // Recurse
                } else {
                    results.push(filePath); // Add file path to results
                }
            } catch (statError) {
                // Handle errors that occur while trying to get file/directory stats.
                // This is important for robustness, as it allows the process to continue even if some files/directories are inaccessible.
                console.warn(`${logPrefix} Warning: Could not stat file/dir: ${filePath}. Skipping. Error: ${statError instanceof Error ? statError.message : statError}`);
            }
        }
    } catch (readdirError) {
        // Handle errors that occur while trying to read a directory.
        // This is critical to prevent the entire process from failing if a directory cannot be accessed.
        console.error(`${logPrefix} Error reading directory: ${dir}. Error: ${readdirError instanceof Error ? readdirError.message : readdirError}`);
    }
    return results;
}

/**
 * Removes leading blank lines and specific comment markers, filters duplicate consecutive lines.
 * This function is designed to clean up file content by removing unnecessary blank lines at the beginning,
 * filtering out comment markers that might contain file paths (useful for removing auto-generated headers),
 * and eliminating duplicate consecutive lines, which can occur due to various file processing operations.
 * This ensures that the resulting content is more readable and concise.
 *
 * @function filterLines
 * @param {string[]} lines - An array of strings representing the lines of a file.  This is the raw content of the file, split into individual lines.
 * @param {string} friendlyPath - A file path to use when filtering comment markers. This allows the function to identify and remove comments
 *                                  that refer to the original file path. This is useful for removing automatically generated headers.
 * @param {boolean} stripComments - If true, removes single-line (//) and multi-line comments from the code. Also removes boilerplate like 'require_once' sequences.
 * @param {boolean} minify - If true, enforces maximum information density for LLMs (no blank lines, drops debug logs, truncates long strings).
 * @returns {string[]} An array of strings representing the filtered lines. The array contains the cleaned-up content of the file.
 */
export function filterLines(lines: string[], friendlyPath: string, stripComments: boolean = false, minify: boolean = false): string[] {
    let startIndex = 0;
    const pathCommentRegex = /^\s*\/\/\s*File:\s*(.+)\s*$/;

    // Remove leading blank lines and path comments.
    // This loop iterates through the lines until it finds a non-blank line or a line that doesn't match the path comment regex.
    while (startIndex < lines.length) {
        const firstLine = lines[startIndex].trim();
        if (firstLine === "") {
            startIndex++;
        } else if (pathCommentRegex.test(firstLine) && firstLine.includes(friendlyPath)) {
            startIndex++;
        } else {
            break;
        }
    }

    const relevantLines = lines.slice(startIndex);
    const filteredLines: string[] = [];
    let prevLineTrimmed: string | null = null;

    let inBlockComment = false;
    let requireOnceCount = 0;

    // Filter duplicate consecutive lines and apply advanced stripping
    for (const line of relevantLines) {
        let currentLineTrimmed = line.trim();
        
        if (stripComments) {
            // Handle Block Comments
            if (inBlockComment) {
                if (currentLineTrimmed.includes("*/")) {
                    inBlockComment = false;
                    currentLineTrimmed = currentLineTrimmed.split("*/", 2)[1].trim();
                } else {
                    continue; // Skip lines entirely inside block comment
                }
            } else if (currentLineTrimmed.startsWith("/*")) {
                if (currentLineTrimmed.includes("*/")) {
                    // Inline block comment, strip it
                    currentLineTrimmed = currentLineTrimmed.replace(/\/\*.*?\*\//g, "").trim();
                } else {
                    inBlockComment = true;
                    continue; // Skip the start of a block comment
                }
            }

            // Handle Single-Line Comments
            if (currentLineTrimmed.startsWith("//") || currentLineTrimmed.startsWith("#")) {
                continue; // Skip full comment lines
            } else if (currentLineTrimmed.includes("//")) {
                // Strip end-of-line comments
                currentLineTrimmed = currentLineTrimmed.split("//")[0].trim();
            }

            // Boilerplate Reduction (PHP 'require_once' and 'include_once' chains)
            if (currentLineTrimmed.startsWith("require_once") || currentLineTrimmed.startsWith("include_once") || currentLineTrimmed.startsWith("require ") || currentLineTrimmed.startsWith("include ")) {
                requireOnceCount++;
                if (requireOnceCount === 1) {
                    filteredLines.push("// ... [Includes omitted for brevity] ...");
                }
                continue; // Skip the actual include lines
            } else if (currentLineTrimmed !== "") {
                requireOnceCount = 0; // Reset counter if we hit normal code
            }
        }

        // Apply LLM-Density Minify logic if enabled
        if (minify) {
            // Remove debugging logs entirely
            if (
                currentLineTrimmed.startsWith("console.log") ||
                currentLineTrimmed.startsWith("console.error") ||
                currentLineTrimmed.startsWith("console.info") ||
                currentLineTrimmed.startsWith("console.debug") ||
                currentLineTrimmed.startsWith("var_dump(") ||
                currentLineTrimmed.startsWith("error_log(") ||
                currentLineTrimmed.startsWith("print_r(")
            ) {
                continue;
            }

            // Truncate massively long strings/base64 inline (basic regex logic)
            // Look for quotes with > 250 word characters/symbols without spaces
            if (currentLineTrimmed.length > 250) {
                // Replacing long string literals enclosed in single or double quotes
                currentLineTrimmed = currentLineTrimmed.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match, quote) => {
                    if (match.length > 250) {
                        return `${quote}...[TRUNCATED_FOR_AI]...${quote}`;
                    }
                    return match;
                });
            }
        }

        if (currentLineTrimmed !== "" && currentLineTrimmed === prevLineTrimmed) {
            continue; // Skip if the current line is the same as the previous line
        }

        // Push the original processed line (or stripped line if stripComments is active and it was reduced)
        // If minify is active, we strip all original whitespace and only use one indent scale if applicable
        let lineToPush = stripComments ? currentLineTrimmed : line;

        if (minify) {
            // If minify is true, we ONLY push the trimmed line (no leading spaces unless absolutely needed)
            // But for structural context, keeping leading spaces is better. We will collapse multiple spaces to single inside the text instead.
            lineToPush = currentLineTrimmed;
            
            // Re-apply original leading indent string exactly as it was
            const originalIndentArr = line.match(/^([ \t]+)/);
            if (originalIndentArr) {
                 lineToPush = originalIndentArr[1] + lineToPush;
            }
            
            // Remove ANY entirely blank lines
            if (!currentLineTrimmed) continue;
        } else {
            // Original blank lines logic skips if everything was stripped
            if (stripComments && !currentLineTrimmed) continue;
        }

        filteredLines.push(lineToPush);
        prevLineTrimmed = currentLineTrimmed;
    }
    return filteredLines;
}