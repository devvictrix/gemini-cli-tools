// src/gemini/commands/infer-from-data.command.ts
import path from 'path';
import fs from 'fs'; // Used for statSync validation
import { CliArguments } from '../../shared/types/app.type.js';
import { readSingleFile } from '../../shared/utils/file-io.utils.js'; // Specific import for reading
import { inferTypesFromData } from '../../shared/helpers/type-inference.helper.js'; // Specific import for inference logic
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[InferFromData]";

/**
 * Executes the logic for the 'InferFromData' command.
 * Reads a JSON file, infers a TypeScript interface from its structure,
 * and prints the generated interface to the console.
 * @param {CliArguments} args - The parsed command-line arguments.
 * @returns {Promise<void>} A promise that resolves when execution is complete.
 * @throws {Error} If validation fails (missing args, incorrect file type) or if file operations/parsing fail.
 */
export async function execute(args: CliArguments): Promise<void> {
    // --- Command Specific Validation ---
    if (args.command !== EnhancementType.InferFromData) {
        // This check ensures the dispatcher called the correct handler
        throw new Error("Handler mismatch: Expected InferFromData command.");
    }
    const { targetPath, interfaceName } = args;

    // Validate required interfaceName was provided (should be caught by yargs, but good practice)
    if (!interfaceName) {
        throw new Error("Interface name (-i, --interfaceName) is required for InferFromData.");
    }

    // Validate targetPath exists and is a file
    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath);
        if (!stats.isFile()) {
            throw new Error(`Target path for '${EnhancementType.InferFromData}' must be a file (e.g., JSON). Found directory or other type at: ${targetPath}`);
        }
    } catch (e) {
        // Catch errors like file not found
        throw new Error(`Cannot access target file: ${targetPath}. ${e instanceof Error ? e.message : 'Check if the path is correct and the file exists.'}`);
    }

    // --- Command Execution ---
    const dataFilePath = path.resolve(targetPath); // Ensure we have an absolute path
    const relativeDataFilePath = path.relative(process.cwd(), dataFilePath).split(path.sep).join('/'); // For logging
    console.log(`\n${logPrefix} Inferring types from data file: ${relativeDataFilePath}`);

    try {
        // Read the content of the specified JSON file
        const fileContent = readSingleFile(dataFilePath); // Use shared utility

        // Parse the file content as JSON
        let data: any;
        try {
            data = JSON.parse(fileContent);
        } catch (parseError) {
            // Throw specific error for parsing failure
            throw new Error(`Error parsing JSON data from ${relativeDataFilePath}: ${parseError instanceof Error ? parseError.message : parseError}`);
        }

        // Perform the type inference using the shared helper
        const inferredInterface = inferTypesFromData(interfaceName, data);

        // Print the resulting interface definition to the console
        console.log(`\n--- Inferred Interface: ${interfaceName} ---`);
        console.log(inferredInterface);
        console.log(`--- End Interface ---`);

    } catch (inferenceError) {
        // Catch errors from readSingleFile or inferTypesFromData and re-throw
        // The dispatcher's try-catch will handle logging the final error message.
        throw new Error(`Error during type inference process for ${relativeDataFilePath}: ${inferenceError instanceof Error ? inferenceError.message : inferenceError}`);
    }
    // No specific success message needed here as the output is the primary result
}