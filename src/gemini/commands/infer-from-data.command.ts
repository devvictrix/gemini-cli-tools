// src/gemini/commands/infer-from-data.command.ts
import path from 'path';
import fs from 'fs';
import { CliArguments } from '../../shared/types/app.type.js';
import { readSingleFile } from '../../shared/utils/file-io.utils.js';
import { inferTypesFromData } from '../../shared/helpers/type-inference.helper.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[InferFromData]";

export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.InferFromData) {
        throw new Error("Handler mismatch: Expected InferFromData command.");
    }
    const { targetPath, interfaceName } = args;

    // Validate required interfaceName
    if (!interfaceName) {
        // This should technically be caught by yargs 'demandOption'
        throw new Error("Interface name (-i, --interfaceName) is required for InferFromData.");
    }
    // Validate targetPath is a file
    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath);
        if (!stats.isFile()) {
            throw new Error(`Target path for '${EnhancementType.InferFromData}' must be a file.`);
        }
    } catch (e) {
        throw new Error(`Cannot access target path: ${targetPath}. ${e instanceof Error ? e.message : ''}`);
    }

    const dataFilePath = path.resolve(targetPath); // Ensure absolute path
    const relativeDataFilePath = path.relative(process.cwd(), dataFilePath).split(path.sep).join('/');
    console.log(`\n${logPrefix} Inferring types from data file: ${relativeDataFilePath}`);

    try {
        const fileContent = readSingleFile(dataFilePath); // Use shared utility
        let data: any;
        try {
            data = JSON.parse(fileContent); // Parse JSON content
        } catch (parseError) {
            throw new Error(`Error parsing JSON data from ${relativeDataFilePath}: ${parseError instanceof Error ? parseError.message : parseError}`);
        }

        const inferredInterface = inferTypesFromData(interfaceName, data); // Perform inference

        console.log(`\n--- Inferred Interface: ${interfaceName} ---`);
        console.log(inferredInterface); // Print the result
        console.log(`--- End Interface ---`);

    } catch (inferenceError) {
        // Catch errors from readSingleFile or inferTypesFromData
        throw new Error(`Error during type inference for ${relativeDataFilePath}: ${inferenceError instanceof Error ? inferenceError.message : inferenceError}`);
    }
}