#!/usr/bin/env node


/**
 * src/index.ts
 *
 * This tool recursively consolidates source files (with extensions .ts, .js, .json, .env)
 * from a given repository directory into a single output file. Each file’s content is preceded
 * by a marker comment showing its relative path. The consolidated output begins with a detailed
 * header that includes metadata such as the source directory, timestamp, tool name, and configuration details.
 *
 * Usage:
 *   ts-node src/index.ts <command> [path] [file_prefix]
 *   or
 *   node dist/index.js <command> [path] [file_prefix]  (after building with 'npm run build')
 *
 * Available commands:
 *   consolidate-sources  -> Consolidate code into one file (consolidated_sources.ts)
 *          Optional third argument: file prefix to filter files starting with that prefix
 *   help                 -> Show this help message
 *
 * Examples:
 *   ts-node src/index.ts consolidate-sources src/ product
 *   ts-node src/index.ts help
 *
 * Note: After building, you can run the tool using its binary name (if installed globally)
 *       or via 'node dist/index.js'. For development, using ts-node is recommended.
 */

import { promises as fs } from "fs";
import * as path from "path";
import { exit } from "process";

// Configuration
const ROOT_DIR: string = ".";
const EXCLUDE_PATTERNS: Set<string> = new Set(["node_modules", "dist", "build", ".git", "coverage", "package-lock.json", ".json"]);
const INCLUDE_EXTENSIONS: Set<string> = new Set([".ts", ".js", ".json", ".env"]);

// Output file for the consolidated source code (renamed to a more generic name)
const OUTPUT_FILE: string = "consolidated_sources.ts";

/**
 * Recursively traverse a directory and return all file paths.
 *
 * @param dir The directory to traverse.
 * @returns An array of absolute file paths.
 */
async function getAllFiles(dir: string): Promise<string[]> {
    let results: string[] = [];
    const list = await fs.readdir(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        if (stat && stat.isDirectory()) {
            // Skip directories that match exclusion patterns
            if ([...EXCLUDE_PATTERNS].some(pattern => file.includes(pattern))) {
                continue;
            }
            results = results.concat(await getAllFiles(filePath));
        } else {
            results.push(filePath);
        }
    }
    return results;
}

/**
 * Removes leading blank lines and any leading comment line that already contains the file path.
 *
 * @param lines Array of file lines.
 * @param friendlyPath The relative (friendly) file path.
 * @returns A filtered array of lines.
 */
function filterLines(lines: string[], friendlyPath: string): string[] {
    while (lines.length) {
        const firstLine = lines[0].trim();
        if (firstLine === "") {
            lines.shift();
        } else if (firstLine.startsWith("//") && firstLine.includes(friendlyPath)) {
            lines.shift();
        } else {
            break;
        }
    }

    // Remove duplicate consecutive comment lines.
    const filteredLines: string[] = [];
    let prevLine = "";
    for (const line of lines) {
        if (line.trim() === prevLine.trim()) {
            continue;
        }
        filteredLines.push(line);
        prevLine = line;
    }
    return filteredLines;
}

/**
 * Consolidates source files from a directory into a single output file.
 *
 * @param rootDir The root directory to scan.
 * @param outputFile The output file path.
 * @param filePrefix Optional file prefix filter.
 */
async function consolidateSources(rootDir: string, outputFile: string, filePrefix: string = ""): Promise<void> {
    const seenFiles: Set<string> = new Set();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const absRoot = path.resolve(rootDir);
    const absOutput = path.resolve(outputFile);

    // Build the header.
    const header = `// Consolidated sources from: ${absRoot}\n` +
        `// Consolidation timestamp: ${now}\n` +
        `// Tool Name: repo-inspector\n` +
        `// Command Executed: consolidate-sources\n` +
        `// Output File: ${absOutput}\n` +
        `// Root Directory: ${absRoot}\n` +
        `// Include Extensions: ${[...INCLUDE_EXTENSIONS].sort().join(", ")}\n` +
        `// Exclude Patterns: ${[...EXCLUDE_PATTERNS].sort().join(", ")}\n\n`;

    let outputContent = header;

    // Get all file paths recursively.
    const allFiles = await getAllFiles(absRoot);
    for (const filePath of allFiles) {
        const fileName = path.basename(filePath);
        // Apply file prefix filter if provided.
        if (filePrefix && !fileName.startsWith(filePrefix)) {
            continue;
        }
        // Skip files whose name includes any exclude pattern.
        if ([...EXCLUDE_PATTERNS].some(pattern => fileName.includes(pattern))) {
            continue;
        }
        // Skip files with unsupported extension.
        if (!INCLUDE_EXTENSIONS.has(path.extname(fileName))) {
            continue;
        }

        const canonicalPath = await fs.realpath(filePath);
        if (seenFiles.has(canonicalPath)) {
            continue;
        }
        seenFiles.add(canonicalPath);

        // Compute relative and friendly path.
        const relativePath = path.relative(absRoot, canonicalPath);
        const friendlyPath = relativePath.split(path.sep).join("/");
        const commentLine = `// ${friendlyPath}`;

        outputContent += `${commentLine}\n\n`;

        // Read file content.
        let lines: string[];
        try {
            const fileData = await fs.readFile(canonicalPath, "utf-8");
            lines = fileData.split(/\r?\n/);
        } catch (error) {
            console.error(`Error reading ${filePath}: ${error}`);
            continue;
        }

        const filtered = filterLines(lines, friendlyPath);
        outputContent += filtered.join("\n") + "\n\n";
    }

    await fs.writeFile(outputFile, outputContent, "utf-8");
    console.log(`[consolidate-sources] Files have been consolidated into '${outputFile}'.`);
}

/**
 * Prints the help message.
 */
function printHelp(): void {
    console.log("Usage: node repo-inspector.js <command> [path] [file_prefix]\n");
    console.log("Available commands:");
    console.log("  consolidate-sources  -> Consolidate code into one file (consolidated_sources.ts)");
    console.log("       Optional third argument: file prefix to filter files starting with that prefix");
    console.log("  help                 -> Show this help message\n");
    console.log("Examples:");
    console.log("  node repo-inspector.js consolidate-sources src/ product");
    console.log("  node repo-inspector.js help");
    console.log("\nNote: Call the script using its filename (e.g., repo-inspector.js) rather than running 'consolidate-sources' directly.");
}

/**
 * Main function to parse command-line arguments and dispatch commands.
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        printHelp();
        exit(1);
    }

    const command = args[0];
    const dirPath = args[1] || ROOT_DIR;
    const filePrefix = args[2] || "";

    if (command === "help") {
        printHelp();
    } else if (command === "consolidate-sources") {
        await consolidateSources(dirPath, OUTPUT_FILE, filePrefix);
    } else {
        console.error(`Unknown command: ${command}\n`);
        printHelp();
        exit(1);
    }
}

main().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
