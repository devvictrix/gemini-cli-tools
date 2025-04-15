// File: src/shared/types/app.type.ts

import { EnhancementType } from '../enums/enhancement.type.js';

/**
 * Represents the unified command-line arguments passed to the application,
 * including arguments specific to different commands.
 */
export interface CliArguments {
    /** The specific enhancement or utility action requested. */
    command: EnhancementType;

    /** The target file or directory path (used by most commands, default for GenerateStructureDoc). */
    targetPath: string;

    /** Optional filename prefix filter (used by file-processing commands). */
    prefix?: string;

    /** Optional name for the generated interface (used by InferFromData). */
    interfaceName?: string;

    /** Path for the output Markdown file (used by GenerateStructureDoc, has default). */
    output?: string; // Changed to optional as it only applies to one command

    /** Flag to include standard descriptions (used by GenerateStructureDoc, has default). */
    descriptions?: boolean; // Changed to optional

    /** Optional maximum directory depth (used by GenerateStructureDoc). */
    depth?: number;

    /** Optional comma-separated list of additional exclude patterns (used by GenerateStructureDoc, has default). */
    exclude?: string; // Changed to optional

    // --- Standard yargs properties ---
    [key: string]: unknown; // Allow other yargs properties
    _: (string | number)[]; // Positional args not mapped to specific options
    $0: string;             // The script name or path as executed
}


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