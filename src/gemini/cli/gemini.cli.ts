// src/gemini/cli/gemini.cli.ts
import yargs, { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
// Corrected: Import the *specific types* needed, not the union directly here if only using EnhancementType
import { CliArguments } from '../../shared/types/app.type.js';
import { runCommandLogic } from './gemini.handler.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[GeminiCLI]";

/**
 * Sets up common options (targetPath, prefix) for yargs commands (used by EnhancementType commands).
 * This function is used as the `builder` argument in the yargs command definition.
 * It defines the positional `targetPath` argument and the optional `prefix` option, which are
 * common to most of the enhancement commands.
 *
 * @param yargsInstance The yargs instance to configure.  This is passed in by yargs itself when the command is defined.
 * @returns The yargs instance with the added options.  This allows for method chaining in the yargs configuration.
 */
const setupDefaultCommand = (yargsInstance: Argv<{}>): Argv<{ targetPath: string; prefix: string | undefined }> => {
    return yargsInstance
        .positional('targetPath', {
            describe: 'Target file or directory path',
            type: 'string',
            demandOption: true, // targetPath is always required
        })
        .option('prefix', {
            alias: 'p',
            type: 'string',
            description: 'Optional filename prefix filter for directory processing. Only files starting with this prefix will be processed.',
            demandOption: false, // prefix is optional
        });
};

/**
 * Configures and runs the yargs CLI parser.
 * This function is the main entry point for the Gemini CLI. It defines the available commands,
 * their options, and the corresponding logic to be executed.  It uses the `yargs` library to
 * handle argument parsing and command dispatch.
 *
 * @param processArgs The arguments passed to the process, typically process.argv.
 * @returns A Promise that resolves when the CLI execution is complete.
 * @throws An error if argument parsing or command execution fails.  The `fail` handler in yargs will catch parsing errors.
 *         Errors thrown by the command logic within `runCommandLogic` are caught in the `.catch` block at the end.
 */
export async function runCli(processArgs: string[]): Promise<void> {
    console.log(`${logPrefix} Initializing...`);

    await yargs(hideBin(processArgs)) // hideBin removes the first two arguments (node and script path)
        // --- EnhancementType Commands ---
        // Each of the following commands corresponds to a value in the `EnhancementType` enum.
        // They all follow a similar pattern:
        // 1. Define the command name and description.
        // 2. Use `setupDefaultCommand` to add the common `targetPath` and `prefix` options.
        // 3. Provide a handler function that calls `runCommandLogic` with the parsed arguments
        //    and the corresponding `EnhancementType` value.
        .command( // AddComments
            `${EnhancementType.AddComments} <targetPath>`,
            'Add AI-generated comments to files.',
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.AddComments } as CliArguments)
        )
        .command( // Analyze
            `${EnhancementType.Analyze} <targetPath>`,
            'Analyze code structure and quality.',
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.Analyze } as CliArguments)
        )
        .command( // Explain
            `${EnhancementType.Explain} <targetPath>`,
            'Explain what the code does.',
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.Explain } as CliArguments)
        )
        .command( // AddPathComment
            `${EnhancementType.AddPathComment} <targetPath>`,
            'Add "// File: <relativePath>" comment header to files.',
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.AddPathComment } as CliArguments)
        )
        .command( // Consolidate
            `${EnhancementType.Consolidate} <targetPath>`,
            'Consolidate code into a single output file (consolidated_output.txt).',
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.Consolidate } as CliArguments)
        )
        .command( // SuggestImprovements
            `${EnhancementType.SuggestImprovements} <targetPath>`,
            'Suggest improvements for the code.',
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.SuggestImprovements } as CliArguments)
        )
        .command( // GenerateDocs
            `${EnhancementType.GenerateDocs} <targetPath>`,
            'Generate Markdown documentation (saves to README.md).',
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.GenerateDocs } as CliArguments)
        )
        .command( // InferFromData
            `${EnhancementType.InferFromData} <targetPath>`,
            'Infer TypeScript interface from a JSON data file.',
            (yargsInstance) => {
                return yargsInstance
                    .positional('targetPath', {
                        describe: 'Path to the JSON data file',
                        type: 'string',
                        demandOption: true,
                    })
                    .option('interfaceName', {
                        alias: 'i',
                        type: 'string',
                        description: 'Name for the generated TypeScript interface',
                        demandOption: true,
                    });
            },
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.InferFromData } as CliArguments)
        )
        // --- GenerateStructureDoc Command ---
        // This command is different from the others in that it has specific options
        // that are not covered by `setupDefaultCommand`.
        // It also uses a default value for `targetPath` which is why it has `[targetPath]` instead of `<targetPath>`.
        .command(
            `${EnhancementType.GenerateStructureDoc} [targetPath]`, // Use enum value
            'Generate a Markdown file representing the project directory structure.',
            (yargsInstance) => { // Builder defines specific options
                return yargsInstance
                    .positional('targetPath', {
                        describe: 'Root directory to scan.',
                        type: 'string',
                        default: './src',
                    })
                    .option('output', {
                        alias: 'o',
                        type: 'string',
                        description: 'Path for the output Markdown file.',
                        default: 'Project Tree Structure.md',
                    })
                    .option('descriptions', {
                        alias: 'd',
                        type: 'boolean',
                        description: 'Include standard descriptions for known directories.',
                        default: false,
                    })
                    .option('depth', {
                        alias: 'L',
                        type: 'number',
                        description: 'Maximum directory depth to display.',
                    })
                    .option('exclude', {
                        alias: 'e',
                        type: 'string',
                        description: 'Comma-separated list of additional names/patterns to exclude.  Example: "node_modules,.git"',
                        default: '',
                    });
            },
            // Pass the correct enum value to the handler
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.GenerateStructureDoc } as CliArguments) // Use unified type
        )
        // --- End New Command ---
        .demandCommand(1, 'Please specify a valid command (action).') // Requires at least one command to be specified
        .strict() // Prevents the usage of unknown arguments
        .help() // Enables the help command
        .alias('h', 'help') // Sets alias for help command
        .wrap(null) // Enables word wrapping for help messages
        .fail((msg, err, yargs) => { // Custom error handling
            if (err) {
                console.error(`\n${logPrefix} 🚨 An unexpected error occurred during argument parsing:`);
                console.error(err);
                process.exit(1);
            }
            console.error(`\n${logPrefix} ❌ Error: ${msg}\n`);
            yargs.showHelp();
            process.exit(1);
        })
        .parseAsync() // Parses the arguments asynchronously
        .catch(error => { // Global error handling for command execution
            console.error(`\n${logPrefix} 🚨 An unexpected critical error occurred during execution:`);
            if (error instanceof Error) {
                console.error(`   Message: ${error.message}`);
                console.error(error.stack);
            } else {
                console.error("   An unknown error object was thrown:", error);
            }
            process.exit(1);
        });
}