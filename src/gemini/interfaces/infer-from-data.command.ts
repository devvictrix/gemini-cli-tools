// src/gemini/commands/infer-from-data.command.ts
import path from 'path';
import fs from 'fs';
import { CliArguments } from '../../shared/types/app.type.js';
import { readSingleFile } from '../../shared/utils/file-io.utils.js';
import { inferTypesFromData } from '../../shared/helpers/type-inference.helper.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[InferFromData]";

/**
 * Executes the "infer from data" command.  This command reads a JSON data file,
 * infers the TypeScript types from the data, and prints the inferred interface
 * to the console.
 *
 * @param args - The command-line arguments.
 * @returns A promise that resolves when the command is complete.
 * @throws An error if the command fails.
 */
export async function execute(args: CliArguments): Promise<void> {
    // Check if the command is the expected type.
    if (args.command !== EnhancementType.InferFromData) {
        throw new Error("Handler mismatch: Expected InferFromData command.");
    }

    // Extract the target file path and interface name from the arguments.
    const { targetPath, interfaceName } = args;

    // Validate that the interface name is provided.
    if (!interfaceName) {
        // This should technically be caught by yargs 'demandOption' - defensive check
        throw new Error("Interface name (-i, --interfaceName) is required for InferFromData.");
    }

    // Validate that the target path exists and is a file.
    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath);
        if (!stats.isFile()) {
            throw new Error(`Target path for '${EnhancementType.InferFromData}' must be a file.`);
        }
    } catch (e) {
        // Handle file system errors (e.g., file not found, permission denied).
        throw new Error(`Cannot access target path: ${targetPath}. ${e instanceof Error ? e.message : ''}`);
    }

    // Resolve the absolute path to the data file.
    const dataFilePath = path.resolve(targetPath); // Ensure absolute path
    const relativeDataFilePath = path.relative(process.cwd(), dataFilePath).split(path.sep).join('/'); // Get relative path for logging
    console.log(`\n${logPrefix} Inferring types from data file: ${relativeDataFilePath}`);

    try {
        // Read the content of the data file.
        const fileContent = readSingleFile(dataFilePath); // Use shared utility
        let data: any;
        try {
            // Parse the JSON content of the file.
            data = JSON.parse(fileContent); // Parse JSON content
        } catch (parseError) {
            // Handle JSON parsing errors.
            throw new Error(`Error parsing JSON data from ${relativeDataFilePath}: ${parseError instanceof Error ? parseError.message : parseError}`);
        }

        // Infer the TypeScript interface from the data.
        const inferredInterface = inferTypesFromData(interfaceName, data); // Perform inference

        // Print the inferred interface to the console.
        console.log(`\n--- Inferred Interface: ${interfaceName} ---`);
        console.log(inferredInterface); // Print the result
        console.log(`--- End Interface ---`);

    } catch (inferenceError) {
        // Catch errors from readSingleFile or inferTypesFromData
        throw new Error(`Error during type inference for ${relativeDataFilePath}: ${inferenceError instanceof Error ? inferenceError.message : inferenceError}`);
    }
}