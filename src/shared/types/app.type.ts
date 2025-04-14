// File: src/shared/types/app.type.ts

import { EnhancementType } from '../enums/enhancement.type.js'; // Use the enum from its new location

/**
 * Represents the command-line arguments passed to the application.
 */
export interface CliArguments {
    /**
     * The enhancement type to apply (e.g., 'add-decorator').
     */
    command: EnhancementType;
    /**
     * The target file or directory path.
     */
    targetPath: string;
    /**
     * An optional prefix to add (e.g., to class names).
     */
    prefix?: string;
    /**
     * An optional interface name (used by the 'InferFromData' command).
     */
    interfaceName?: string; // Specific to InferFromData command
    /**
     * Allows other properties to be passed from yargs.
     */
    [key: string]: unknown; // Allow other yargs properties
    /**
     * Positional arguments passed to the script.
     */
    _: (string | number)[]; // Positional args
    /**
     * The name of the script being executed.
     */
    $0: string;             // Script name
}

/**
 * Represents the result of processing a single file.
 */
export interface FileProcessingResult {
    /**
     * The path to the processed file.
     */
    filePath: string;
    /**
     * The status of the file processing operation.
     *  - 'updated': The file was modified.
     *  - 'unchanged': The file was not modified.
     *  - 'error': An error occurred during processing.
     *  - 'processed': The file was processed, even if no modifications were made.
     */
    status: 'updated' | 'unchanged' | 'error' | 'processed'; // 'processed' could be for non-modification tasks
    /**
     * An optional message providing more detail about the processing result.
     */
    message?: string;
}