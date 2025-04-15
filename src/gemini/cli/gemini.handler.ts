// File: src/gemini/cli/gemini.handler.ts
// Status: Updated (Added mapping for AnalyzeArchitecture)

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
import * as analyzeArchitectureCmd from '../commands/analyze-architecture.command.js'; // <<< Added Import
import * as generateModuleReadmeCmd from '../commands/generate-module-readme.command.js'; // <<< Added Import

const logPrefix = "[GeminiHandler]";

// Map command enum/string (EnhancementType) to the corresponding handler function's execute method.
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
    [EnhancementType.AnalyzeArchitecture]: analyzeArchitectureCmd.execute, // <<< Added Mapping
    [EnhancementType.GenerateModuleReadme]: generateModuleReadmeCmd.execute, // <<< Added Mapping
    // [EnhancementType.GenerateModuleReadme]: generateModuleReadmeCmd.execute, // Deferred
};

/**
 * Main dispatcher function.
 * @param {CliArguments} argv The parsed arguments object from yargs.
 * @returns {Promise<void>} A promise that resolves when the command logic is complete.
 */
export async function runCommandLogic(argv: CliArguments): Promise<void> {
    const handler = commandHandlerMap[argv.command];

    if (!handler) {
        console.error(`${logPrefix} ❌ Internal Error: No handler found for command: ${argv.command}`);
        process.exit(1);
    }

    try {
        await handler(argv);
        console.log(`\n${logPrefix} Command '${argv.command}' finished.`);
    } catch (error) {
        // Centralized error catching for command execution failures.
        console.error(`\n${logPrefix} ❌ Error during execution of command '${argv.command}':`);
        if (error instanceof Error) {
            console.error(`   Message: ${error.message}`);
            // Avoid noisy stack traces for common user errors like bad paths
            const isUserInputError = error.message.includes("Cannot access target path") ||
                error.message.includes("Target path for") ||
                error.message.includes("must be a directory") ||
                error.message.includes("must be a file");
            if (!isUserInputError) {
                console.error(error.stack);
            }
        } else {
            console.error("   Unknown error object:", error);
        }
        process.exitCode = 1; // Indicate failure
    }
}