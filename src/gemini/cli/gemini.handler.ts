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
import * as inferFromDataCmd from '../commands/infer-from-data.command.js';
import * as suggestImprovementsCmd from '../commands/suggest-improvements.command.js';

const logPrefix = "[GeminiHandler]";

// Map command enum/string to the actual handler function's execute method
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
 * Main dispatcher function. Selects and executes the appropriate command handler.
 * @param {CliArguments} argv The parsed arguments object from yargs.
 * @returns {Promise<void>} A promise that resolves when the command logic is complete.
 */
export async function runCommandLogic(argv: CliArguments): Promise<void> {
    const handler = commandHandlerMap[argv.command];

    if (!handler) {
        console.error(`${logPrefix} ❌ Internal Error: No handler found for command: ${argv.command}`);
        process.exit(1); // Should not happen if yargs validation is correct
    }

    try {
        // Execute the selected handler
        await handler(argv);
        // Log success only if the handler didn't throw an error
        console.log(`\n${logPrefix} Command '${argv.command}' finished.`);
    } catch (error) {
        // Centralized error catching for command execution failures
        console.error(`\n${logPrefix} ❌ Error during execution of command '${argv.command}':`);
        if (error instanceof Error) {
            console.error(`   Message: ${error.message}`);
            // Only log stack for unexpected internal errors, not user errors like bad paths
            // if (!error.message.startsWith("Cannot access target path") && !error.message.startsWith("Target path for")) {
            //     console.error(error.stack);
            // }
        } else {
            console.error("   Unknown error object:", error);
        }
        process.exitCode = 1; // Indicate failure
    }
}