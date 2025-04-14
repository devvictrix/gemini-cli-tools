// File: src/gemini/cli/gemini.cli.ts

import yargs, { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CliArguments } from '../../shared/types/app.type.js'; // Updated path
import { runCommandLogic } from './gemini.handler.js'; // Updated path
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[GeminiCLI]";

/**
 * Sets up common options (targetPath, prefix) for yargs commands.
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
        .command( // AddComments
            `${EnhancementType.AddComments} <targetPath>`,
            'Add AI-generated comments to files.',
            setupDefaultCommand, // Use common options setup
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.AddComments } as CliArguments) // Run main logic with command type
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
            (yargsInstance) => { // Custom setup for this command
                return yargsInstance
                    .positional('targetPath', { // Requires a file path
                        describe: 'Path to the JSON data file',
                        type: 'string',
                        demandOption: true,
                    })
                    .option('interfaceName', { // Requires an interface name
                        alias: 'i',
                        type: 'string',
                        description: 'Name for the generated TypeScript interface',
                        demandOption: true, // Interface name is required for this command
                    });
            },
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.InferFromData } as CliArguments) // Run main logic
        )
        .demandCommand(1, 'Please specify a valid command (action).') // Require at least one command
        .strict() // Report errors for unknown options/commands
        .help() // Enable --help option
        .alias('h', 'help') // Alias -h for help
        .wrap(null) // Adjust terminal width automatically
        .fail((msg, err, yargs) => { // Custom failure handler
            if (err) {
                // Handle unexpected parsing errors
                console.error(`\n${logPrefix} 🚨 An unexpected error occurred during argument parsing:`);
                console.error(err);
                process.exit(1);
            }
            // Handle validation errors (missing command, wrong options, etc.)
            console.error(`\n${logPrefix} ❌ Error: ${msg}\n`);
            yargs.showHelp(); // Show help message on failure
            process.exit(1);
        })
        .parseAsync() // Parse arguments asynchronously
        .catch(error => { // Catch errors from the async parsing or command execution if not caught internally
            console.error(`\n${logPrefix} 🚨 An unexpected critical error occurred during execution:`);
            if (error instanceof Error) {
                console.error(`   Message: ${error.message}`);
                console.error(error.stack); // Log stack trace for critical errors
            } else {
                console.error("   An unknown error object was thrown:", error);
            }
            process.exit(1); // Exit with failure code
        });
}