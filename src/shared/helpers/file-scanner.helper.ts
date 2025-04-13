// File: src/shared/utils/file.helpers.ts // New Path

import { promises as fs } from "fs";
import * as path from "path";

/**
 * Recursively traverse a directory and return all file paths, respecting exclusion patterns.
 * @param dir The directory to traverse.
 * @param excludePatterns A set of directory/file name patterns to exclude.
 * @param excludeFilenames A set of specific filenames to exclude.
 * @returns An array of absolute file paths.
 */
export async function getAllFiles(
    dir: string,
    excludePatterns: Set<string>,
    excludeFilenames: Set<string>
): Promise<string[]> {
    let results: string[] = [];
    try {
        const list = await fs.readdir(dir);
        for (const file of list) {
            const filePath = path.join(dir, file);

            // Check against exclusion patterns/filenames early
            if (excludePatterns.has(file) || excludeFilenames.has(file)) {
                // Keep logging consistent or make it more generic
                // console.log(`  [FileUtil] Excluding: ${filePath} (matches pattern/filename)`);
                continue;
            }

            try {
                const stat = await fs.stat(filePath);
                if (stat && stat.isDirectory()) {
                    // Recursively search subdirectories
                    results = results.concat(await getAllFiles(filePath, excludePatterns, excludeFilenames));
                } else {
                    // It's a file, add it to results
                    results.push(filePath);
                }
            } catch (statError) {
                console.warn(`  [FileUtil] Warning: Could not stat file/dir: ${filePath}. Skipping. Error: ${statError instanceof Error ? statError.message : statError}`);
            }
        }
    } catch (readdirError) {
        console.error(`  [FileUtil] Error reading directory: ${dir}. Error: ${readdirError instanceof Error ? readdirError.message : readdirError}`);
        // Decide if you want to throw or just return empty results for this branch
    }
    return results;
}

/**
 * Removes leading blank lines and any leading comment line that already contains the file path.
 * Filters duplicate consecutive lines.
 * @param lines Array of file lines.
 * @param friendlyPath The relative (friendly) file path used in marker comments.
 * @returns A filtered array of lines.
 */
export function filterLines(lines: string[], friendlyPath: string): string[] {
    let startIndex = 0;
    const pathCommentRegex = /^\s*\/\/\s*File:\s*(.+)\s*$/; // Slightly simpler regex if needed

    // Find the first non-empty, non-marker line
    while (startIndex < lines.length) {
        const firstLine = lines[startIndex].trim();
        if (firstLine === "") {
            startIndex++; // Skip blank lines
        } else if (pathCommentRegex.test(firstLine) && firstLine.includes(friendlyPath)) {
            // Skip marker comment lines for this specific file
            startIndex++;
        } else {
            break; // Stop when the first relevant line is found
        }
    }

    const relevantLines = lines.slice(startIndex);

    // Remove duplicate consecutive non-blank lines.
    const filteredLines: string[] = [];
    let prevLineTrimmed: string | null = null; // Initialize differently

    for (const line of relevantLines) {
        const currentLineTrimmed = line.trim();
        // Skip if current line is identical to the previous one (ignoring whitespace), but ONLY if it's not blank
        if (currentLineTrimmed !== "" && currentLineTrimmed === prevLineTrimmed) {
            continue;
        }
        filteredLines.push(line);
        prevLineTrimmed = currentLineTrimmed; // Update previous line
    }
    return filteredLines;
}