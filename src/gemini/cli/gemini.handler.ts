// File: src/gemini/cli/gemini.handler.ts

import { CliArguments } from '@shared/types/app.type';
import { EnhancementType } from '@/gemini/types/enhancement.type';

// --- Import Command Handlers ---
import * as addCommentsCmd from '@/gemini/commands/add-comments.command';
import * as addPathCommentCmd from '@/gemini/commands/add-path-comment.command';
import * as analyzeCmd from '@/gemini/commands/analyze.command';
import * as consolidateCmd from '@/gemini/commands/consolidate.command';
import * as explainCmd from '@/gemini/commands/explain.command';
import * as generateDocsCmd from '@/gemini/commands/generate-docs.command';
import * as generateStructureDocCmd from '@/gemini/commands/generate-structure-doc.command';
import * as inferFromDataCmd from '@/gemini/commands/infer-from-data.command';
import * as suggestImprovementsCmd from '@/gemini/commands/suggest-improvements.command';
import * as analyzeArchitectureCmd from '@/gemini/commands/analyze-architecture.command';
import * as generateModuleReadmeCmd from '@/gemini/commands/generate-module-readme.command';
import * as generateTestsCmd from '@/gemini/commands/generate-tests.command';

/**
 * @constant {string} logPrefix - A constant string used as a prefix for all log messages originating from this file.
 * This provides a clear indication of the source of the log messages.
 */
const logPrefix = "[GeminiHandler]";

/**
 * @constant {Object} commandHandlerMap - A map that associates EnhancementType enum values (or their string representations)
 * to their corresponding command handler functions.  This map is crucial for the command dispatch mechanism, allowing
 * the system to dynamically execute the correct command based on user input.
 * Each command handler function should accept `CliArguments` and return a `Promise<void>`.
 */
const commandHandlerMap: { [key in EnhancementType]: (args: CliArguments) => Promise<void> } = {
    [EnhancementType.AddComments]: addCommentsCmd.execute,
    [EnhancementType.AddPathComment]: addPathCommentCmd.execute,
    [EnhancementType.Analyze]: analyzeCmd.execute,
    [EnhancementType.Consolidate]: consolidateCmd.execute,
    [EnhancementType.Explain]: explainCmd.execute,
    [EnhancementType.GenerateDocs]: generateDocsCmd.execute,
    [EnhancementType.GenerateStructureDoc]: generateStructureDocCmd.execute,
    [EnhancementType.InferFromData]: inferFromDataCmd.execute,
    [EnhancementType.SuggestImprovements]: suggestImprovementsCmd.execute,
    [EnhancementType.AnalyzeArchitecture]: analyzeArchitectureCmd.execute,
    [EnhancementType.GenerateModuleReadme]: generateModuleReadmeCmd.execute,
    [EnhancementType.GenerateTests]: generateTestsCmd.execute,
};

/**
 * @function runCommandLogic
 * @async
 *
 * @description This is the main dispatcher function responsible for executing the appropriate command logic based on the provided command-line arguments.
 * It retrieves the relevant command handler from the `commandHandlerMap` and executes it, providing centralized error handling.
 *
 * @param {CliArguments} argv - The parsed command-line arguments, including the command to execute and any associated options/parameters.
 *                               This object is typically created by a library like `yargs`.
 *
 * @returns {Promise<void>} A promise that resolves when the command logic has completed successfully or rejects if an error occurs.
 */
export async function runCommandLogic(argv: CliArguments): Promise<void> {
    // Retrieve the command handler function from the map using the command specified in the arguments.
    const handler = commandHandlerMap[argv.command];

    // Check if a handler was found for the given command. If not, it indicates an internal error (likely a missing entry in commandHandlerMap).
    if (!handler) {
        console.error(`${logPrefix} ❌ Internal Error: No handler found for command: ${argv.command}`);
        process.exit(1); // Exit with an error code to signal failure to the calling process.
    }

    try {
        // Execute the command handler, passing the parsed arguments.  The handler is expected to perform the requested action.
        await handler(argv);
        // Log a success message to the console.
        console.log(`\n${logPrefix} Command '${argv.command}' finished.`);
    } catch (error) {
        // Centralized error handling: Catch any errors thrown during command execution.
        console.error(`\n${logPrefix} ❌ Error during execution of command '${argv.command}':`);

        if (error instanceof Error) {
            // If the error is an instance of the built-in Error object, print its message.
            console.error(`   Message: ${error.message}`);

            // Detect if the error message suggests a user input error (e.g., invalid file path).
            // Avoid printing the full stack trace for these common errors to prevent overwhelming the user.
            const isUserInputError = error.message.includes("Cannot access target path") ||
                error.message.includes("Target path for") ||
                error.message.includes("must be a directory") ||
                error.message.includes("must be a file");

            if (!isUserInputError) {
                // If it's not a user input error, print the stack trace to help with debugging.
                console.error(error.stack);
            }
        } else {
            // If the error is not an Error object, print it as an unknown object. This is a fallback for unusual error types.
            console.error("   Unknown error object:", error);
        }
        // Set the process exit code to 1 to indicate failure to the calling process.
        process.exitCode = 1;
    }
}