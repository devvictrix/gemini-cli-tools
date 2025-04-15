// src/gemini/commands/generate-structure-doc.command.ts
// (Content provided in the previous correct answer)
import * as fs from 'fs';
import * as path from 'path';
import { CliArguments } from '../../shared/types/app.type.js';
import { EXCLUDE_PATTERNS, EXCLUDE_FILENAMES } from '../../shared/constants/filesystem.constants.js';
import { writeOutputFile } from '../../shared/utils/file-io.utils.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[GenerateStructureDoc]";

// --- Standard Directory Descriptions ---
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
interface GenerateTreeOptions {
    depth: number;
    maxDepth?: number;
    prefix: string;
    useDescriptions: boolean;
    exclusions: Set<string>;
}

// --- Recursive Tree Generation Function ---
async function generateTreeLines(
    currentPath: string,
    options: GenerateTreeOptions
): Promise<string[]> {
    /* ... function implementation from previous answer ... */
    const { depth, maxDepth, prefix, useDescriptions, exclusions } = options;
    let outputLines: string[] = [];

    if (maxDepth !== undefined && depth > maxDepth) {
        return [];
    }

    let entries: string[];
    try { entries = await fs.promises.readdir(currentPath); }
    catch (error) { console.warn(/*...*/); return [`${prefix}└── Error reading directory!`]; }

    const filteredEntries = entries
        .filter(entry => !exclusions.has(entry))
        .sort((a, b) => { /*...*/ return a.localeCompare(b); });

    for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i];
        const entryPath = path.join(currentPath, entry);
        const isLastEntry = i === filteredEntries.length - 1;
        const connector = isLastEntry ? '└── ' : '├── ';
        const linePrefix = prefix + connector;
        let line = linePrefix + entry;
        let isDirectory = false;

        try {
            const stats = await fs.promises.stat(entryPath);
            isDirectory = stats.isDirectory();
            if (isDirectory) {
                line += '/';
                if (useDescriptions && standardDescriptions.has(entry)) {
                    line += ` ${standardDescriptions.get(entry)}`;
                }
            }
            outputLines.push(line);
            if (isDirectory && (maxDepth === undefined || depth < maxDepth)) {
                const nextPrefix = prefix + (isLastEntry ? '    ' : '│   ');
                const childLines = await generateTreeLines(entryPath, { ...options, depth: depth + 1, prefix: nextPrefix });
                outputLines = outputLines.concat(childLines);
            }
        } catch (statError) { /* handle error */
            outputLines.push(`${linePrefix}${entry} (Error: ${statError instanceof Error ? statError.message : 'Cannot stat'})`);
            console.warn(`${logPrefix} ⚠️ Could not stat ${entryPath}: ${statError instanceof Error ? statError.message : statError}`);
        }
    }
    return outputLines;
}


// --- Exported Execute Function ---
export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.GenerateStructureDoc) {
        throw new Error("Handler mismatch: Expected GenerateStructureDoc command.");
    }
    // Type assertion specific to this command's needs
    const { targetPath, output, descriptions, depth, exclude } = args;
    console.log(`\n${logPrefix} Executing action: ${args.command} on target: ${targetPath}`);

    const outputOrDefault = output || 'Project Tree Structure.md';
    const descriptionsOrDefault = descriptions || false;
    const excludeOrDefault = exclude || '';

    console.log(`  Outputting to: ${outputOrDefault}`);
    if (descriptionsOrDefault) console.log(`  Including descriptions.`);
    if (depth !== undefined) console.log(`  Max depth: ${depth}`);
    if (excludeOrDefault) console.log(`  Excluding: ${excludeOrDefault}`);

    // Moved try-catch block to the dispatcher for consistency
    const absTargetPath = path.resolve(targetPath);
    const absOutputPath = path.resolve(outputOrDefault);

    if (!fs.existsSync(absTargetPath) || !fs.statSync(absTargetPath).isDirectory()) {
        throw new Error(`Target path '${targetPath}' does not exist or is not a directory.`);
    }

    const standardExclusions = new Set([...EXCLUDE_PATTERNS, ...EXCLUDE_FILENAMES]);
    const userExclusions = excludeOrDefault ? excludeOrDefault.split(',').map(s => s.trim()).filter(s => s) : [];
    userExclusions.forEach(ex => standardExclusions.add(ex));
    // Prevent infinite loop if output is inside target
    if (absOutputPath.startsWith(path.dirname(absTargetPath))) {
        standardExclusions.add(path.basename(absOutputPath));
    }


    console.log(`${logPrefix} Scanning directory structure...`);
    const treeOptions: GenerateTreeOptions = {
        depth: 0,
        maxDepth: depth,
        prefix: '',
        useDescriptions: descriptionsOrDefault,
        exclusions: standardExclusions,
    };
    const treeLines = await generateTreeLines(absTargetPath, treeOptions);

    const outputContent = `${path.basename(absTargetPath)}/\n` + treeLines.join('\n');
    const success = writeOutputFile(absOutputPath, outputContent);

    if (!success) {
        // Throw error to be caught by the dispatcher
        throw new Error(`Failed to write structure document to ${outputOrDefault}`);
    } else {
        console.log(`\n${logPrefix} ✅ Successfully generated structure document: ${outputOrDefault}`);
    }
}