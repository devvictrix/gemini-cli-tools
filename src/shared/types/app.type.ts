// File: src/shared/types/app.type.ts

import { EnhancementType } from '../../gemini/types/enhancement.type';

/**
 * Represents the unified command-line arguments passed to the application,
 * including arguments specific to different commands.
 * This allows for a single, consistent way to access all arguments
 * regardless of how the application is invoked.
 */
export interface CliArguments {
    /**
     * The specific enhancement or utility action requested.
     * Determines which part of the application logic will be executed.
     * This essentially acts as a command selector.
     */
    command: EnhancementType;

    /**
     * The target file or directory path.
     * This path is the primary input for most commands.
     */
    targetPath: string;

    /**
     * Optional filename prefix filter.
     * Used by several commands. For Consolidate, this is ignored if --pattern is used.
     */
    prefix?: string;

    /**
     * Optional filename pattern filter (e.g., "*aaa", "aaa*", "*aaa*").
     * Used by the Consolidate command. Takes precedence over --prefix.
     */
    pattern?: string; // <<< ADDED/ENSURE THIS EXISTS

    /**
     * Optional name for the generated interface.
     * Used specifically by the `InferFromData` command.
     */
    interfaceName?: string;

    /**
     * Path for the output Markdown file.
     * Used by `GenerateStructureDoc` and `AnalyzeArchitecture`.
     */
    output?: string;

    /**
     * Flag to include standard descriptions in the generated documentation.
     * Used by the `GenerateStructureDoc` command.
     */
    descriptions?: boolean;

    /**
     * Optional maximum directory depth to traverse.
     * Used by the `GenerateStructureDoc` command.
     */
    depth?: number;

    /**
     * Optional comma-separated list of additional exclude patterns.
     * Used by the `GenerateStructureDoc` command.
     */
    exclude?: string;

    /**
     * Optional testing framework hint.
     * Used by the `GenerateTests` command.
     */
    framework?: string;

    // --- Standard yargs properties ---
    [key: string]: unknown;
    _: (string | number)[];
    $0: string;
}

// FileProcessingResult interface remains the same...
export interface FileProcessingResult {
    filePath: string;
    status: 'updated' | 'unchanged' | 'error' | 'processed';
    message?: string;
}