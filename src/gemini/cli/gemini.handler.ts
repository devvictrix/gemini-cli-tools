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
import * as developCmd from '@/gemini/commands/develop.command';
import * as generateProgressReportCmd from '@/gemini/commands/generate-progress-report.command';
import * as initCmd from '@/gemini/commands/init.command'; // New import

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
    [EnhancementType.Develop]: developCmd.execute,
    [EnhancementType.GenerateProgressReport]: generateProgressReportCmd.execute,
    [EnhancementType.Init]: initCmd.execute, // New mapping
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
        // Instead of process.exit(1), set exitCode and let yargs's .fail or .parseAsync().catch() handle the exit.
        // This allows for more graceful shutdown and consistent error reporting through yargs.
        process.exitCode = 1;
        // Re-throw the error so it can be caught by the yargs .parseAsync().catch() or .fail()
        throw new Error(`No handler found for command: ${argv.command}`);
    }

    try {
        // Execute the command handler, passing the parsed arguments.  The handler is expected to perform the requested action.
        await handler(argv);
        // Log a success message to the console.
        console.log(`\n${logPrefix} Command '${argv.command}' finished.`);
    } catch (error) {
        // Centralized error handling: Catch any errors thrown during command execution.
        // Error messages from command handlers should be user-friendly.
        // This block primarily catches unexpected errors or ensures exitCode is set.

        // Check if the error message already includes our standard prefixes to avoid double logging.
        const isAlreadyLoggedByCommand = error instanceof Error &&
            (
                error.message.startsWith(logPrefix) || // General handler prefix
                error.message.startsWith("[InitCommand]") || // Specific command prefix
                error.message.startsWith("[DevelopCmd]") // Another specific command prefix
                // Add other command-specific prefixes here if they log their own detailed errors
            );

        if (!isAlreadyLoggedByCommand) {
            console.error(`\n${logPrefix} ❌ Error during execution of command '${argv.command}':`);
        }


        if (error instanceof Error) {
            // If the error message wasn't already logged by the command itself, log its message.
            if (!isAlreadyLoggedByCommand) {
                console.error(`   Message: ${error.message}`);
            }

            // Determine if it's a common user input error to avoid printing stack trace.
            const isUserInputError =
                error.message.includes("Cannot access target path") ||
                error.message.includes("Target path for") ||
                error.message.includes("must be a directory") ||
                error.message.includes("must be a file") ||
                error.message.includes("is required") || // For missing arguments from yargs or command validation
                error.message.includes("is not empty. Use --force") || // For Init command non-empty dir
                error.message.includes("exists but is not a directory"); // For Init command path validation


            if (!isUserInputError && error.stack) {
                // Only print stack trace for non-user-input errors and if stack exists.
                console.error(error.stack);
            }
        } else {
            // Fallback for non-Error objects being thrown.
            console.error("   An unknown error object was thrown:", error);
        }
        // Set the process exit code to 1 to indicate failure to the calling process.
        process.exitCode = 1;
        // Re-throw so yargs .parseAsync().catch() can handle the final process exit.
        // This ensures that even if a command handler itself doesn't call process.exit,
        // the CLI exits with an error code as managed by yargs.
        throw error;
    }
}