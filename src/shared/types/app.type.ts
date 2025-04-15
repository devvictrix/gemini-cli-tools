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
     * This path is the primary input for most commands.  For example, it would be
     * the path to a file whose structure is being documented, or a directory
     * containing data from which an interface should be inferred.
     * It serves as the default target for the GenerateStructureDoc command if no other is specified.
     */
    targetPath: string;

    /**
     * Optional filename prefix filter.
     * If provided, only files whose names start with this prefix will be processed.
     * This is useful for limiting the scope of file-processing commands to a subset of files.
     */
    prefix?: string;

    /**
     * Optional name for the generated interface.
     * Used specifically by the `InferFromData` command.
     * If not provided, a default name will be used (usually based on the file name).
     * Providing a name here ensures a consistent and meaningful interface name.
     */
    interfaceName?: string;

    /**
     * Path for the output Markdown file.
     * Used by the `GenerateStructureDoc` command to specify where the generated
     * documentation should be written.
     * If not provided, a default path will be used.
     */
    output?: string; // Changed to optional as it only applies to one command

    /**
     * Flag to include standard descriptions in the generated documentation.
     * Used by the `GenerateStructureDoc` command.
     * When `true`, adds a default description for each property based on type,
     * such as "string", "number", etc.  This can be useful for quickly
     * generating documentation, but may need to be refined manually.
     */
    descriptions?: boolean; // Changed to optional

    /**
     * Optional maximum directory depth to traverse.
     * Used by the `GenerateStructureDoc` command.  If not provided, the documentation
     * generation will cover all subdirectories. Setting a depth limit prevents excessive
     * traversal of very deep directory structures, potentially improving performance.
     */
    depth?: number;

    /**
     * Optional comma-separated list of additional exclude patterns.
     * Used by the `GenerateStructureDoc` command.  Allows specifying patterns
     * (using glob syntax) to exclude files or directories from documentation generation.
     * Useful for avoiding documentation of files that are not relevant or should be kept private.
     *
     * Example: "*.test.ts,node_modules"
     */
    exclude?: string; // Changed to optional

    // --- Standard yargs properties ---

    /**
     * Allows other yargs properties to be accessed.
     * This provides flexibility to access automatically-generated or
     * custom properties added by yargs (the command-line argument parser).
     */
    [key: string]: unknown; // Allow other yargs properties

    /**
     * Positional arguments not mapped to specific options.
     * These are arguments passed to the command-line that don't have a
     * corresponding option flag.  Often used as a fallback or for simpler
     * commands where arguments are expected in a specific order.
     */
    _: (string | number)[]; // Positional args not mapped to specific options

    /**
     * The script name or path as executed.
     * Represents the full path to the script file that was executed from the
     * command-line.  For example, if the script is run as
     * `node ./dist/index.js`, then `$0` will be `./dist/index.js`.
     */
    $0: string;             // The script name or path as executed
}


/**
 * Represents the result of processing a single file.
 * Used for batch operations to track the status of each file.
 */
export interface FileProcessingResult {
    /**
     * The relative path of the processed file.
     * This should be relative to the root directory being processed,
     * making it easy to identify the file within the overall project.
     */
    filePath: string;

    /**
     * The outcome of the processing for this file.
     * Indicates whether the file was updated, remained unchanged, encountered
     * an error during processing, or was simply processed (regardless of changes).
     */
    status: 'updated' | 'unchanged' | 'error' | 'processed';

    /**
     * Optional message, typically used for errors or warnings.
     * If the `status` is `error`, this should contain a detailed error message.
     * It can also be used for informational messages, such as warnings about
     * potential issues found during processing.
     */
    message?: string;
}