// src/shared/types/app.type.ts

import { EnhancementType } from '../enums/enhancement.type.js'; // Use the enum from its new location

// Define command names union including the new command
export type CommandNameType = EnhancementType | 'GenerateStructureDoc';

/**
 * Base interface for common CLI arguments provided by yargs.
 */
export interface BaseCliArguments {
    [key: string]: unknown; // Allow other yargs properties
    _: (string | number)[]; // Positional args not mapped to specific options
    $0: string;             // The script name or path as executed
}

/**
 * Arguments specific to commands that perform code enhancements (using EnhancementType).
 */
export interface EnhancementCliArguments extends BaseCliArguments {
    /** The specific code enhancement action requested. */
    command: EnhancementType;
    /** The target file or directory path for the enhancement. */
    targetPath: string;
    /** Optional filename prefix filter for directory processing. */
    prefix?: string;
    /** Optional name for the generated interface (used by InferFromData). */
    interfaceName?: string;
}

/**
 * Arguments specific to the GenerateStructureDoc command.
 */
export interface GenerateStructureDocCliArguments extends BaseCliArguments {
    /** The command name, fixed to 'GenerateStructureDoc'. */
    command: 'GenerateStructureDoc';
    /** Root directory to scan (has default value). */
    targetPath: string;
    /** Path for the output Markdown file (has default value). */
    output: string;
    /** Flag to include standard descriptions for known directories (has default value). */
    descriptions: boolean;
    /** Optional maximum directory depth to display. */
    depth?: number;
    /** Optional comma-separated list of additional names/patterns to exclude (has default value). */
    exclude: string;
}

/**
 * Union type representing the arguments for any valid command.
 * Used by the command handler for type safety.
 */
export type CliArguments = EnhancementCliArguments | GenerateStructureDocCliArguments;


/**
 * Represents the result of processing a single file,
 * often used in summarizing batch operations.
 */
export interface FileProcessingResult {
    /** The relative path of the processed file. */
    filePath: string;
    /** The outcome of the processing for this file. */
    status: 'updated' | 'unchanged' | 'error' | 'processed';
    /** Optional message, typically used for errors or warnings. */
    message?: string;
}