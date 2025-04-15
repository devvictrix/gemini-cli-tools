// File: src/gemini/commands/generate-structure-doc.command.ts

import * as fs from 'fs';
import * as path from 'path';
import { CliArguments } from '../../shared/types/app.type';
import { EXCLUDE_PATTERNS, EXCLUDE_FILENAMES } from '../../shared/constants/filesystem.constants';
import { writeOutputFile } from '../../shared/utils/file-io.utils';
import { EnhancementType } from '../types/enhancement.type';

const logPrefix = "[GenerateStructureDoc]"; // Prefix for all log messages from this module

// --- Standard Directory Descriptions ---
// This map provides human-readable descriptions for common directory names.
// It's used to enhance the generated documentation with context.
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

// --- Define an interface for the options ---
// This interface defines the configuration options for the tree generation process.
interface GenerateTreeOptions {
    depth: number; // Current depth of the traversal
    maxDepth?: number; // Maximum depth to traverse (optional)
    prefix: string; // String prefix for the current level (used for indentation)
    useDescriptions: boolean; // Flag to indicate whether to include directory descriptions
    exclusions: Set<string>; // Set of directory/file names to exclude from the tree
}

// --- Recursive Tree Generation Function ---
// This function recursively traverses the directory structure and generates the tree representation.
async function generateTreeLines(
    currentPath: string,
    options: GenerateTreeOptions
): Promise<string[]> {
    const { depth, maxDepth, prefix, useDescriptions, exclusions } = options;
    let outputLines: string[] = []; // Array to store the generated lines

    // Base case: If the maximum depth is reached, stop traversing.
    if (maxDepth !== undefined && depth > maxDepth) {
        return [];
    }

    let entries: string[];
    try { entries = await fs.promises.readdir(currentPath); } // Asynchronously read the contents of the current directory.
    catch (error) {
        console.warn(`${logPrefix} ⚠️ Could not read directory ${currentPath}: ${error instanceof Error ? error.message : error}`);
        return [`${prefix}└── Error reading directory!`]; // Return an error message if reading fails
    }

    // Filter out excluded entries and sort the remaining entries alphabetically.
    const filteredEntries = entries
        .filter(entry => !exclusions.has(entry))
        .sort((a, b) => {
            // Prioritize directories over files.
            const aIsDir = fs.statSync(path.join(currentPath, a)).isDirectory();
            const bIsDir = fs.statSync(path.join(currentPath, b)).isDirectory();

            if (aIsDir && !bIsDir) {
                return -1;
            } else if (!aIsDir && bIsDir) {
                return 1;
            }

            return a.localeCompare(b);
        });

    // Iterate over the filtered entries and generate the tree lines.
    for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i];
        const entryPath = path.join(currentPath, entry); // Full path to the current entry
        const isLastEntry = i === filteredEntries.length - 1; // Flag indicating if this is the last entry in the current directory
        const connector = isLastEntry ? '└── ' : '├── '; // Connector string based on whether it's the last entry
        const linePrefix = prefix + connector; // Prefix for the current line, including indentation and connector
        let line = linePrefix + entry; // The current line being built
        let isDirectory = false; // Flag indicating if the entry is a directory

        try {
            const stats = await fs.promises.stat(entryPath); // Asynchronously get the file stats for the current entry
            isDirectory = stats.isDirectory();
            if (isDirectory) {
                line += '/'; // Add a trailing slash to directory names
                if (useDescriptions && standardDescriptions.has(entry)) {
                    line += ` ${standardDescriptions.get(entry)}`; // Add the directory description if available and enabled
                }
            }
            outputLines.push(line); // Add the line to the output array
            if (isDirectory && (maxDepth === undefined || depth < maxDepth)) {
                // Recursively call the function for subdirectories, if within the maximum depth limit
                const nextPrefix = prefix + (isLastEntry ? '    ' : '│   '); // Calculate the prefix for the next level
                const childLines = await generateTreeLines(entryPath, { ...options, depth: depth + 1, prefix: nextPrefix }); // Recursive call
                outputLines = outputLines.concat(childLines); // Add the child lines to the output array
            }
        } catch (statError) { // Error handling for file stats retrieval
            outputLines.push(`${linePrefix}${entry} (Error: ${statError instanceof Error ? statError.message : 'Cannot stat'})`);
            console.warn(`${logPrefix} ⚠️ Could not stat ${entryPath}: ${statError instanceof Error ? statError.message : statError}`);
        }
    }
    return outputLines; // Return the array of generated lines
}


// --- Exported Execute Function ---
// This function is the entry point for the command. It parses the arguments,
// validates the target path, configures the tree generation options, and writes the output to a file.
export async function execute(args: CliArguments): Promise<void> {
    // Validate that the correct command is being executed.
    if (args.command !== EnhancementType.GenerateStructureDoc) {
        throw new Error("Handler mismatch: Expected GenerateStructureDoc command.");
    }
    // Type assertion specific to this command's needs.  Extract relevant arguments from the CLI arguments.
    const { targetPath, output, descriptions, depth, exclude } = args;
    console.log(`\n${logPrefix} Executing action: ${args.command} on target: ${targetPath}`);

    // Use default values if output path, descriptions, or excludes are not provided
    const outputOrDefault = output || 'Project Tree Structure.md';
    const descriptionsOrDefault = descriptions || false;
    const excludeOrDefault = exclude || '';

    console.log(`  Outputting to: ${outputOrDefault}`);
    if (descriptionsOrDefault) console.log(`  Including descriptions.`);
    if (depth !== undefined) console.log(`  Max depth: ${depth}`);
    if (excludeOrDefault) console.log(`  Excluding: ${excludeOrDefault}`);

    // Moved try-catch block to the dispatcher for consistency. Resolve target and output paths to absolute paths.
    const absTargetPath = path.resolve(targetPath);
    const absOutputPath = path.resolve(outputOrDefault);

    // Validate that the target path exists and is a directory
    if (!fs.existsSync(absTargetPath) || !fs.statSync(absTargetPath).isDirectory()) {
        throw new Error(`Target path '${targetPath}' does not exist or is not a directory.`);
    }

    // Create a set of exclusions from the default exclusions and the user-provided exclusions.
    const standardExclusions = new Set([...EXCLUDE_PATTERNS, ...EXCLUDE_FILENAMES]);
    const userExclusions = excludeOrDefault ? excludeOrDefault.split(',').map(s => s.trim()).filter(s => s) : [];
    userExclusions.forEach(ex => standardExclusions.add(ex));

    // Prevent infinite loop if output is inside target.  Exclude the output file from the tree if it is located within the target directory.
    if (absOutputPath.startsWith(path.dirname(absTargetPath))) {
        standardExclusions.add(path.basename(absOutputPath));
    }


    console.log(`${logPrefix} Scanning directory structure...`);
    // Configure the options for the tree generation.
    const treeOptions: GenerateTreeOptions = {
        depth: 0,
        maxDepth: depth,
        prefix: '',
        useDescriptions: descriptionsOrDefault,
        exclusions: standardExclusions,
    };
    // Generate the tree lines.
    const treeLines = await generateTreeLines(absTargetPath, treeOptions);

    // Construct the output content by joining the lines with newline characters.
    const outputContent = `${path.basename(absTargetPath)}/\n` + treeLines.join('\n');
    // Write the output to the specified file.
    const success = writeOutputFile(absOutputPath, outputContent);

    // Handle success or failure of writing the output file.
    if (!success) {
        // Throw error to be caught by the dispatcher
        throw new Error(`Failed to write structure document to ${outputOrDefault}`);
    } else {
        console.log(`\n${logPrefix} ✅ Successfully generated structure document: ${outputOrDefault}`);
    }
}