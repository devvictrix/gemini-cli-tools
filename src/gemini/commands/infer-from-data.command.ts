// File: src/gemini/commands/infer-from-data.command.ts

import path from 'path';
import fs from 'fs'; // Used for statSync validation
import { CliArguments } from '@shared/types/app.type';
import { readSingleFile } from '@shared/utils/file-io.utils'; // Specific import for reading
import { inferTypesFromData } from '@shared/helpers/type-inference.helper'; // Specific import for inference logic
import { EnhancementType } from '@/gemini/types/enhancement.type';

const logPrefix = "[InferFromData]";

/**
 * Executes the logic for the 'InferFromData' command.
 *
 * This command reads a JSON file specified by `targetPath`, infers a TypeScript
 * interface from the JSON structure using `inferTypesFromData`, and then prints
 * the generated interface to the console. The interface is named using the
 * `interfaceName` argument.
 *
 * @param {CliArguments} args - The parsed command-line arguments containing information
 *                            such as the target JSON file path and the desired interface name.
 * @returns {Promise<void>} A promise that resolves when the interface inference and printing
 *                           are complete.  Rejects if any error occurs during file reading,
 *                           JSON parsing, or type inference.
 * @throws {Error} If:
 *   - The command argument doesn't match `EnhancementType.InferFromData`. This indicates
 *     a problem with the command dispatcher.
 *   - `interfaceName` is missing, which is required for naming the generated interface.
 *   - The `targetPath` does not exist or is not a file. This prevents processing invalid paths.
 *   - The JSON file at `targetPath` cannot be parsed. Ensures the input file is valid.
 *   - An error occurs during the type inference process.
 */
export async function execute(args: CliArguments): Promise<void> {
    // --- Command Specific Validation ---
    if (args.command !== EnhancementType.InferFromData) {
        // This check ensures that the dispatcher called the correct handler for this command.
        // If this fails, it indicates a problem in the command dispatching logic.
        throw new Error("Handler mismatch: Expected InferFromData command.");
    }
    const { targetPath, interfaceName } = args;

    // Validate that the required interfaceName argument was provided.
    // While yargs should handle this, this check adds an extra layer of safety.
    if (!interfaceName) {
        throw new Error("Interface name (-i, --interfaceName) is required for InferFromData.");
    }

    // Validate that the targetPath exists and is a file.
    // This is important to avoid attempting to read directories or non-existent files.
    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath);
        if (!stats.isFile()) {
            throw new Error(`Target path for '${EnhancementType.InferFromData}' must be a file (e.g., JSON). Found directory or other type at: ${targetPath}`);
        }
    } catch (e) {
        // Catch errors such as 'file not found' that can occur during statSync.
        // The error message provides helpful debugging information.
        throw new Error(`Cannot access target file: ${targetPath}. ${e instanceof Error ? e.message : 'Check if the path is correct and the file exists.'}`);
    }

    // --- Command Execution ---
    const dataFilePath = path.resolve(targetPath); // Ensure we have an absolute path
    const relativeDataFilePath = path.relative(process.cwd(), dataFilePath).split(path.sep).join('/'); // For logging
    console.log(`\n${logPrefix} Inferring types from data file: ${relativeDataFilePath}`);

    try {
        // Read the content of the specified JSON file using the shared utility function.
        const fileContent = readSingleFile(dataFilePath); // Use shared utility

        // Parse the file content as JSON.
        let data: any;
        try {
            data = JSON.parse(fileContent);
        } catch (parseError) {
            // Throw a specific error for parsing failures.  This provides more context
            // than a generic error during the inference process.
            throw new Error(`Error parsing JSON data from ${relativeDataFilePath}: ${parseError instanceof Error ? parseError.message : parseError}`);
        }

        // Perform the type inference using the shared helper function.
        const inferredInterface = inferTypesFromData(interfaceName, data);

        // Print the resulting interface definition to the console.
        console.log(`\n--- Inferred Interface: ${interfaceName} ---`);
        console.log(inferredInterface);
        console.log(`--- End Interface ---`);

    } catch (inferenceError) {
        // Catch errors that occur during readSingleFile or inferTypesFromData and re-throw them.
        // This allows the dispatcher's try-catch block to handle the error and log a final message.
        throw new Error(`Error during type inference process for ${relativeDataFilePath}: ${inferenceError instanceof Error ? inferenceError.message : inferenceError}`);
    }
    // No specific success message needed here as the output is the primary result.  The inferred
    // interface being printed to the console serves as confirmation of success.
}