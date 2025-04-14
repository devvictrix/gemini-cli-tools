// src/shared/helpers/filesystem.helper.ts

import { promises as fs } from "fs";
import * as path from "path";

const logPrefix = "[FileSystemHelper]";

/**
 * Recursively traverse a directory and return all file paths, respecting exclusion patterns.
 * @param dir The directory to traverse.
 * @param excludePatterns A set of directory or file names to exclude from the traversal.
 * @param excludeFilenames A set of specific filenames to exclude from the traversal.
 * @returns A promise that resolves to an array of file paths.
 * @throws {Error} If there is an error reading a directory or statting a file. Errors are logged to the console.
 */
export async function getAllFiles(
    dir: string,
    excludePatterns: Set<string>,
    excludeFilenames: Set<string>
): Promise<string[]> {
    let results: string[] = [];
    try {
        const list = await fs.readdir(dir); // Read the contents of the directory
        for (const file of list) {
            const filePath = path.join(dir, file); // Create the full file path

            if (excludePatterns.has(file) || excludeFilenames.has(file)) {
                continue; // Skip files that match the exclude patterns or filenames
            }

            try {
                const stat = await fs.stat(filePath); // Get file/directory stats
                if (stat && stat.isDirectory()) {
                    results = results.concat(await getAllFiles(filePath, excludePatterns, excludeFilenames)); // Recursively call getAllFiles for directories
                } else {
                    results.push(filePath); // Add file path to results
                }
            } catch (statError) {
                console.warn(`${logPrefix} Warning: Could not stat file/dir: ${filePath}. Skipping. Error: ${statError instanceof Error ? statError.message : statError}`);
            }
        }
    } catch (readdirError) {
        console.error(`${logPrefix} Error reading directory: ${dir}. Error: ${readdirError instanceof Error ? readdirError.message : readdirError}`);
    }
    return results;
}

/**
 * Removes leading blank lines and specific comment markers, filters duplicate consecutive lines.
 * @param lines An array of strings representing the lines of a file.
 * @param friendlyPath A file path to use when filtering comment markers.
 * @returns An array of strings representing the filtered lines.
 */
export function filterLines(lines: string[], friendlyPath: string): string[] {
    let startIndex = 0;
    const pathCommentRegex = /^\s*\/\/\s*File:\s*(.+)\s*$/;

    // Remove leading blank lines and path comments.
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

    // Filter duplicate consecutive lines.
    for (const line of relevantLines) {
        const currentLineTrimmed = line.trim();
        if (currentLineTrimmed !== "" && currentLineTrimmed === prevLineTrimmed) {
            continue; // Skip if the current line is the same as the previous line
        }
        filteredLines.push(line);
        prevLineTrimmed = currentLineTrimmed;
    }
    return filteredLines;
}