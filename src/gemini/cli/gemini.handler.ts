// src/gemini/cli/gemini.handler.ts
import { CliArguments } from '../../shared/types/app.type.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

// --- Import Command Handlers ---
import * as addCommentsCmd from '../commands/add-comments.command.js';
import * as addPathCommentCmd from '../commands/add-path-comment.command.js';
import * as analyzeCmd from '../commands/analyze.command.js';
import * as consolidateCmd from '../commands/consolidate.command.js';
import * as explainCmd from '../commands/explain.command.js';
import * as generateDocsCmd from '../commands/generate-docs.command.js';
import * as generateStructureDocCmd from '../commands/generate-structure-doc.command.js';
import * as inferFromDataCmd from '../interfaces/infer-from-data.command.js';
import * as suggestImprovementsCmd from '../commands/suggest-improvements.command.js';

const logPrefix = "[GeminiHandler]";

// Map command enum/string (EnhancementType) to the corresponding handler function's execute method.
// This allows for dynamic dispatch of commands based on the parsed CLI arguments.  The key is the EnhancementType enum,
// and the value is a function that takes CliArguments and returns a promise.
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
};

/**
 * Main dispatcher function.  This function receives the parsed command-line arguments,
 * determines the appropriate command handler to execute based on the 'command' argument,
 * and then executes that handler.  It also includes centralized error handling for command execution.
 * @param {CliArguments} argv The parsed arguments object from yargs, containing the command and any command-specific options.
 * @returns {Promise<void>} A promise that resolves when the command logic is complete.  The promise may reject if an error occurs during command execution.
 */
export async function runCommandLogic(argv: CliArguments): Promise<void> {
    const handler = commandHandlerMap[argv.command];

    if (!handler) {
        console.error(`${logPrefix} ❌ Internal Error: No handler found for command: ${argv.command}`);
        process.exit(1); // Should not happen if yargs validation is correct. Yargs should prevent invalid commands from reaching this point.
    }

    try {
        // Execute the selected handler, passing the parsed arguments.
        await handler(argv);
        // Log success only if the handler didn't throw an error.  This provides a clear indication of successful command completion.
        console.log(`\n${logPrefix} Command '${argv.command}' finished.`);
    } catch (error) {
        // Centralized error catching for command execution failures.  This ensures consistent error handling across all commands.
        console.error(`\n${logPrefix} ❌ Error during execution of command '${argv.command}':`);
        if (error instanceof Error) {
            console.error(`   Message: ${error.message}`);
            // Only log stack for unexpected internal errors, not user errors like bad paths.  This reduces noise in the logs and focuses on actionable errors.
            // Consider externalizing this logic to a configurable error handling strategy.
            if (!error.message.startsWith("Cannot access target path") && !error.message.startsWith("Target path for")) {
                console.error(error.stack);
            }
        } else {
            console.error("   Unknown error object:", error); // Log the error even if it's not an Error instance.
        }
        process.exitCode = 1; // Indicate failure to the operating system.
    }
}