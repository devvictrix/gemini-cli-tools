// src/shared/helpers/filesystem.helper.ts

import { promises as fs } from "fs";
import * as path from "path";

const logPrefix = "[FileSystemHelper]";

/**
 * Recursively traverse a directory and return all file paths, respecting exclusion patterns.
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

            if (excludePatterns.has(file) || excludeFilenames.has(file)) {
                continue;
            }

            try {
                const stat = await fs.stat(filePath);
                if (stat && stat.isDirectory()) {
                    results = results.concat(await getAllFiles(filePath, excludePatterns, excludeFilenames));
                } else {
                    results.push(filePath);
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
 */
export function filterLines(lines: string[], friendlyPath: string): string[] {
    let startIndex = 0;
    const pathCommentRegex = /^\s*\/\/\s*File:\s*(.+)\s*$/;

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

    for (const line of relevantLines) {
        const currentLineTrimmed = line.trim();
        if (currentLineTrimmed !== "" && currentLineTrimmed === prevLineTrimmed) {
            continue;
        }
        filteredLines.push(line);
        prevLineTrimmed = currentLineTrimmed;
    }
    return filteredLines;
}