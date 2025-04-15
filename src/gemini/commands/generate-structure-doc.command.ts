// File: src/gemini/commands/generate-structure-doc.command.ts

import * as fs from 'fs';
import * as path from 'path';
import { CliArguments } from '@shared/types/app.type';
import { EXCLUDE_PATTERNS, EXCLUDE_FILENAMES } from '@shared/constants/filesystem.constants';
import { writeOutputFile } from '@shared/utils/file-io.utils';
import { EnhancementType } from '@/gemini/types/enhancement.type';

/**
 * @const logPrefix - Prefix for all log messages from this module.
 * Used for easy identification of logs originating from this file.
 */
const logPrefix = "[GenerateStructureDoc]";

/**
 * @const standardDescriptions - A map providing human-readable descriptions for common directory names.
 * This enhances the generated documentation by providing context to directory structures.
 * The descriptions explain the purpose or conventions associated with specific directory names.
 */
const standardDescriptions: ReadonlyMap<string, string> = new Map([
    /* ... descriptions map from previous answer ... */
    ['cli', '# CLI specific logic (commands, handlers)'],
    ['clients', '# Clients for external APIs/services'],
    ['config', '# Configuration loading and access'],
    ['constants', '# Shared constant values (magic strings, keys)'],
    ['controllers', '# Handles incoming requests (HTTP/RPC)'],
    ['database', '# Database connection, migrations, seeding orchestration'],
    ['decorators', '# Custom TypeScript decorators'],
    ['dtos', '# Data Transfer Objects (input/output shapes)'],
    ['entities', '# Domain models or DB schema definitions'],
    ['enums', '# Shared enumerations'],
    ['events', '# Event definitions'],
    ['exceptions', '# Custom error/exception classes'],
    ['fakes', '# Mock/stub implementations for testing'],
    ['guards', '# Authorization/authentication guards'],
    ['handlers', '# Event/message handlers/listeners'],
    ['helpers', '# General-purpose utility functions'],
    ['jobs', '# Background job definitions'],
    ['lib', '# Shared libraries or complex utilities'],
    ['middleware', '# Request/response middleware'],
    ['migrations', '# Database schema migration files'],
    ['policies', '# Complex authorization policies'],
    ['prompts', '# AI prompt templates'],
    ['repositories', '# Data access layer abstraction'],
    ['routes', '# API endpoint definitions'],
    ['schemas', '# Data validation schemas (Zod, Joi, etc.)'],
    ['seeders', '# Database seeding scripts'],
    ['serializers', '# Data transformation utilities'],
    ['services', '# Core business logic'],
    ['shared', '# Shared utilities, types, constants (top-level)'],
    ['shared-modules', '# Shared cross-cutting modules (logging, auth)'],
    ['tests', '# Unit, integration, e2e tests'],
    ['types', '# Shared TypeScript interfaces/types'],
    ['utils', '# Shared utility functions (often more specific than helpers)'],
    ['validators', '# Custom validation logic/rules'],
]);

/**
 * @interface GenerateTreeOptions - Defines the configuration options for the directory tree generation process.
 */
interface GenerateTreeOptions {
    /**
     * @property depth - Current depth of the traversal.
     */
    depth: number;
    /**
     * @property maxDepth - Maximum depth to traverse.  Optional.
     * If not provided, the entire tree will be traversed.
     */
    maxDepth?: number;
    /**
     * @property prefix - String prefix for the current level. Used for indentation in the output tree.
     */
    prefix: string;
    /**
     * @property useDescriptions - Flag to indicate whether to include directory descriptions from `standardDescriptions`.
     */
    useDescriptions: boolean;
    /**
     * @property exclusions - Set of directory/file names to exclude from the tree.
     * Prevents unnecessary entries from appearing in the documentation.
     */
    exclusions: Set<string>;
}

/**
 * @function generateTreeLines - Recursively traverses the directory structure and generates the tree representation as an array of strings.
 * @param currentPath - The current directory being processed.
 * @param options - Configuration options for the tree generation.
 * @returns A Promise that resolves to an array of strings, each representing a line in the tree structure.
 */
async function generateTreeLines(
    currentPath: string,
    options: GenerateTreeOptions
): Promise<string[]> {
    const { depth, maxDepth, prefix, useDescriptions, exclusions } = options;
    let outputLines: string[] = [];

    // Base case: Stop recursion if the maximum depth is reached.
    if (maxDepth !== undefined && depth > maxDepth) {
        return [];
    }

    let entries: string[];
    try {
        // Asynchronously read the contents of the current directory.
        entries = await fs.promises.readdir(currentPath);
    } catch (error) {
        // Handle errors when reading the directory.  Report the error to the console and return a single line indicating the error.
        console.warn(`${logPrefix} ⚠️ Could not read directory ${currentPath}: ${error instanceof Error ? error.message : error}`);
        return [`${prefix}└── Error reading directory!`];
    }

    // Filter out excluded entries and sort the remaining entries alphabetically, prioritizing directories.
    const filteredEntries = entries
        .filter(entry => !exclusions.has(entry))
        .sort((a, b) => {
            // Prioritize directories over files by checking the file stats.
            const aIsDir = fs.statSync(path.join(currentPath, a)).isDirectory();
            const bIsDir = fs.statSync(path.join(currentPath, b)).isDirectory();

            if (aIsDir && !bIsDir) {
                return -1; // a is a directory and b is not, so a comes first.
            } else if (!aIsDir && bIsDir) {
                return 1; // b is a directory and a is not, so b comes first.
            }

            // If both are directories or both are files, sort alphabetically.
            return a.localeCompare(b);
        });

    // Iterate over the filtered entries and generate the tree lines.
    for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i];
        const entryPath = path.join(currentPath, entry);
        const isLastEntry = i === filteredEntries.length - 1;
        const connector = isLastEntry ? '└── ' : '├── '; // Use different connectors for the last entry in a directory.
        const linePrefix = prefix + connector;
        let line = linePrefix + entry;
        let isDirectory = false;

        try {
            // Asynchronously get the file stats for the current entry to determine if it is a directory.
            const stats = await fs.promises.stat(entryPath);
            isDirectory = stats.isDirectory();

            if (isDirectory) {
                line += '/'; // Add a trailing slash to directory names.
                if (useDescriptions && standardDescriptions.has(entry)) {
                    // Add the directory description if available and the 'useDescriptions' option is enabled.
                    line += ` ${standardDescriptions.get(entry)}`;
                }
            }
            outputLines.push(line);

            if (isDirectory && (maxDepth === undefined || depth < maxDepth)) {
                // Recursively call the function for subdirectories, if within the maximum depth limit.
                const nextPrefix = prefix + (isLastEntry ? '    ' : '│   '); // Adjust the prefix for the next level of indentation.
                const childLines = await generateTreeLines(entryPath, { ...options, depth: depth + 1, prefix: nextPrefix });
                outputLines = outputLines.concat(childLines);
            }
        } catch (statError) {
            // Handle errors when retrieving file stats.  Report the error and add an error message to the output.
            outputLines.push(`${linePrefix}${entry} (Error: ${statError instanceof Error ? statError.message : 'Cannot stat'})`);
            console.warn(`${logPrefix} ⚠️ Could not stat ${entryPath}: ${statError instanceof Error ? statError.message : statError}`);
        }
    }
    return outputLines;
}

/**
 * @function execute - Entry point for the command to generate a project structure document.
 * Parses the command line arguments, validates the target path, configures tree generation, and writes the output.
 * @param args - Command line arguments parsed by the CLI.
 * @returns A Promise that resolves when the document generation is complete.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Validate that the correct command is being executed.  This ensures that the correct handler is being used for the command.
    if (args.command !== EnhancementType.GenerateStructureDoc) {
        throw new Error("Handler mismatch: Expected GenerateStructureDoc command.");
    }

    // Extract relevant arguments from the CLI arguments.  Type assertion helps ensure that we're working with expected data.
    const { targetPath, output, descriptions, depth, exclude } = args;
    console.log(`\n${logPrefix} Executing action: ${args.command} on target: ${targetPath}`);

    // Use default values if optional arguments (output path, descriptions, excludes) are not provided.
    const outputOrDefault = output || 'Project Tree Structure.md';
    const descriptionsOrDefault = descriptions || false;
    const excludeOrDefault = exclude || '';

    console.log(`  Outputting to: ${outputOrDefault}`);
    if (descriptionsOrDefault) console.log(`  Including descriptions.`);
    if (depth !== undefined) console.log(`  Max depth: ${depth}`);
    if (excludeOrDefault) console.log(`  Excluding: ${excludeOrDefault}`);

    // Resolve target and output paths to absolute paths.  This ensures that the paths are valid regardless of the current working directory.
    const absTargetPath = path.resolve(targetPath);
    const absOutputPath = path.resolve(outputOrDefault);

    // Validate that the target path exists and is a directory.  This prevents the command from running on invalid targets.
    if (!fs.existsSync(absTargetPath) || !fs.statSync(absTargetPath).isDirectory()) {
        throw new Error(`Target path '${targetPath}' does not exist or is not a directory.`);
    }

    // Create a set of exclusions.  This set combines default exclusions (e.g., .git, node_modules) with user-provided exclusions.
    const standardExclusions = new Set([...EXCLUDE_PATTERNS, ...EXCLUDE_FILENAMES]);
    const userExclusions = excludeOrDefault ? excludeOrDefault.split(',').map(s => s.trim()).filter(s => s) : [];
    userExclusions.forEach(ex => standardExclusions.add(ex));

    // Prevent infinite loop if the output file is located inside the target directory.
    // Exclude the output file from the tree if it's within the target directory to prevent it being included in the documentation it generates.
    if (absOutputPath.startsWith(path.dirname(absTargetPath))) {
        standardExclusions.add(path.basename(absOutputPath));
    }

    console.log(`${logPrefix} Scanning directory structure...`);

    // Configure the options for the tree generation.  These options control the depth, appearance, and exclusions of the generated tree.
    const treeOptions: GenerateTreeOptions = {
        depth: 0,
        maxDepth: depth,
        prefix: '',
        useDescriptions: descriptionsOrDefault,
        exclusions: standardExclusions,
    };

    // Generate the tree lines.  This is the core part that creates the documentation's content.
    const treeLines = await generateTreeLines(absTargetPath, treeOptions);

    // Construct the output content by joining the lines with newline characters.  The output starts with the base directory name.
    const outputContent = `${path.basename(absTargetPath)}/\n` + treeLines.join('\n');

    // Write the output to the specified file.
    const success = writeOutputFile(absOutputPath, outputContent);

    // Handle success or failure of writing the output file.  Provides feedback to the user and logs the outcome.
    if (!success) {
        // Throw error to be caught by the dispatcher in case of write failure.
        throw new Error(`Failed to write structure document to ${outputOrDefault}`);
    } else {
        console.log(`\n${logPrefix} ✅ Successfully generated structure document: ${outputOrDefault}`);
    }
}