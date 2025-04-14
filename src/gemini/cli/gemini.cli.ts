// src/gemini/cli/gemini.cli.ts
import yargs, { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
// Corrected: Import the *specific types* needed, not the union directly here if only using EnhancementType
import { CliArguments, GenerateStructureDocCliArguments } from '../../shared/types/app.type.js';
import { runCommandLogic } from './gemini.handler.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

// --- DEFINE the command name constant ---
const GenerateStructureDocCommandName = 'GenerateStructureDoc'; // Define the command name

const logPrefix = "[GeminiCLI]";

/**
 * Sets up common options (targetPath, prefix) for yargs commands (used by EnhancementType commands).
 * @param yargsInstance The yargs instance to configure.
 * @returns The yargs instance with the added options.
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
            description: 'Optional filename prefix filter for directory processing',
            demandOption: false, // prefix is optional
        });
};

/**
 * Configures and runs the yargs CLI parser.
 * This function defines the commands, options, and logic for the Gemini CLI.
 * @param processArgs The arguments passed to the process, typically process.argv.
 * @returns A Promise that resolves when the CLI execution is complete.
 * @throws An error if argument parsing or command execution fails.
 */
export async function runCli(processArgs: string[]): Promise<void> {
    console.log(`${logPrefix} Initializing...`);

    await yargs(hideBin(processArgs))
        // --- EnhancementType Commands ---
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
        .command(
            `${GenerateStructureDocCommandName} [targetPath]`, // Use the defined constant
            'Generate a Markdown file representing the project directory structure.',
            (yargsInstance) => {
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
                        description: 'Comma-separated list of additional names/patterns to exclude.',
                        default: '',
                    });
            },
            // Use the defined constant when calling the handler
            (argv) => runCommandLogic({ ...argv, command: GenerateStructureDocCommandName } as GenerateStructureDocCliArguments) // Use specific type assertion
        )

        .demandCommand(1, 'Please specify a valid command (action).')
        .strict()
        .help()
        .alias('h', 'help')
        .wrap(null)
        .fail((msg, err, yargs) => {
            if (err) {
                console.error(`\n${logPrefix} 🚨 An unexpected error occurred during argument parsing:`);
                console.error(err);
                process.exit(1);
            }
            console.error(`\n${logPrefix} ❌ Error: ${msg}\n`);
            yargs.showHelp();
            process.exit(1);
        })
        .parseAsync()
        .catch(error => {
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