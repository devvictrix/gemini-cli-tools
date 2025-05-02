// File: gemini/cli/gemini.cli.ts

import yargs, { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CliArguments } from '@shared/types/app.type';
import { runCommandLogic } from '@/gemini/cli/gemini.handler';
import { EnhancementType } from '@/gemini/types/enhancement.type';

/**
 * @constant logPrefix - A string used as a prefix for all console logs in this file.
 * This provides a clear visual indicator in the console output that the message originates from this CLI.
 */
const logPrefix = "[GeminiCLI]";

/**
 * @function setupDefaultCommand
 * @description Sets up common options (`targetPath`, `prefix`) for yargs commands.
 * These options are commonly used across multiple commands to specify the target file/directory and an optional filename prefix.
 * @param {Argv<{}>} yargsInstance - The yargs instance to which the options will be added.
 * @returns {Argv<{ targetPath: string; prefix: string | undefined }>} - The yargs instance with the added options.
 */
const setupDefaultCommand = (yargsInstance: Argv<{}>): Argv<{ targetPath: string; prefix: string | undefined }> => {
    return yargsInstance
        .positional('targetPath', {
            describe: 'Target file or directory path',
            type: 'string',
            demandOption: true, // Ensure the targetPath is always provided
        })
        .option('prefix', {
            alias: 'p',
            type: 'string',
            description: 'Optional filename prefix filter for directory processing.',
            demandOption: false, // The prefix is optional, allowing processing of all files in a directory if not specified.
        });
};

/**
 * @async
 * @function runCli
 * @description Configures and runs the yargs CLI parser, defining all available commands and their options.
 * This is the main entry point for the CLI application, handling argument parsing and command execution.
 * @param {string[]} processArgs - The array of command-line arguments passed to the process.
 * @returns {Promise<void>} - A promise that resolves when the CLI execution is complete.
 */
export async function runCli(processArgs: string[]): Promise<void> {
    console.log(`${logPrefix} Initializing...`);

    await yargs(hideBin(processArgs)) // Use hideBin to strip away the node executable and script filename
        // --- Standard Enhancement Commands ---
        .command( // AddComments
            `${EnhancementType.AddComments} <targetPath>`,
            'Add AI-generated comments to files.',
            setupDefaultCommand, // Uses prefix
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.AddComments } as CliArguments) // Executes the command logic
        )
        .command( // Analyze
            `${EnhancementType.Analyze} <targetPath>`,
            'Analyze code structure and quality (outputs to console).', // Clarified output
            setupDefaultCommand, // Uses prefix
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.Analyze } as CliArguments) // Executes the command logic
        )
        .command( // Explain
            `${EnhancementType.Explain} <targetPath>`,
            'Explain what the code does (outputs to console).', // Clarified output
            setupDefaultCommand, // Uses prefix
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.Explain } as CliArguments) // Executes the command logic
        )
        .command( // SuggestImprovements
            `${EnhancementType.SuggestImprovements} <targetPath>`,
            'Suggest improvements for the code (outputs to console).', // Clarified output
            setupDefaultCommand, // Uses prefix
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.SuggestImprovements } as CliArguments) // Executes the command logic
        )
        .command( // GenerateDocs
            `${EnhancementType.GenerateDocs} <targetPath>`,
            'Generate Markdown documentation for the project (saves to README.md).',
            setupDefaultCommand, // Uses prefix
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.GenerateDocs } as CliArguments) // Executes the command logic
        )

        // --- Local Manipulation Commands ---
        .command( // AddPathComment
            `${EnhancementType.AddPathComment} <targetPath>`,
            'Add "// File: <relativePath>" comment header to files.',
            setupDefaultCommand, // Uses prefix
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.AddPathComment } as CliArguments) // Executes the command logic
        )
        .command( // Consolidate <<< MODIFIED HERE
            `${EnhancementType.Consolidate} <targetPath>`,
            'Consolidate code into a single output file (consolidated_output.txt). Supports filtering.', // Updated description
            (yargsInstance) => { // Start with default setup and add the pattern option
                return setupDefaultCommand(yargsInstance) // Include targetPath and --prefix
                    .option('pattern', { // Add the new --pattern option
                        alias: 'P', // Different alias than prefix's -p
                        type: 'string',
                        description: 'Filter: Include files matching pattern (e.g., "*cmd*", "use*.ts", "*.helper.*"). Overrides --prefix.',
                        demandOption: false,
                    });
            },
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.Consolidate } as CliArguments) // Executes the command logic
        )
        .command( // InferFromData
            `${EnhancementType.InferFromData} <targetPath>`,
            'Infer TypeScript interface from a JSON data file (outputs to console).', // Clarified output
            (yargsInstance) => {
                return yargsInstance
                    .positional('targetPath', {
                        describe: 'Path to the JSON data file',
                        type: 'string',
                        demandOption: true, // Ensure the targetPath to the JSON file is provided
                    })
                    .option('interfaceName', {
                        alias: 'i',
                        type: 'string',
                        description: 'Name for the generated TypeScript interface',
                        demandOption: true, // Ensure the interfaceName is provided for the generated interface.
                    });
            },
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.InferFromData } as CliArguments) // Executes the command logic
        )

        // --- Architecture/Design System Commands ---
        .command( // GenerateStructureDoc (Refined - no change needed here)
            `${EnhancementType.GenerateStructureDoc} [targetPath]`, // targetPath is now optional (defaults to '.')
            'Generate a Markdown file representing the project directory structure.',
            (yargsInstance) => {
                return yargsInstance
                    .positional('targetPath', {
                        describe: 'Root directory to scan.',
                        type: 'string',
                        default: '.', // <<< Changed default to current directory
                    })
                    .option('output', {
                        alias: 'o',
                        type: 'string',
                        description: 'Path for the output Markdown file.',
                        default: 'Project_Structure.md', // Stays as is
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
                        description: 'Comma-separated list of patterns to exclude (e.g., "node_modules,.git").',
                        default: '', // Default uses constants + user excludes
                    });
            },
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.GenerateStructureDoc } as CliArguments) // Executes the command logic
        )
        .command( // AnalyzeArchitecture (Updated Default Output)
            `${EnhancementType.AnalyzeArchitecture} <targetPath>`,
            'Generate an AI-driven analysis of the project architecture (saves to file).',
            (yargsInstance) => {
                return yargsInstance
                    .positional('targetPath', {
                        describe: 'Root project directory to analyze.', // More specific description
                        type: 'string',
                        demandOption: true, // Ensure the target path is provided
                    })
                    .option('output', {
                        alias: 'o',
                        type: 'string',
                        description: 'Path for the output Architecture Analysis Markdown file.',
                        default: 'AI_Architecture_Analyzed.md', // <<< Changed Default Name
                    })
                    .option('prefix', { // Keep prefix option available if needed for specific analysis focus
                        alias: 'p',
                        type: 'string',
                        description: 'Optional filename prefix filter for included files.',
                        demandOption: false, // Prefix filter is optional.
                    });
            },
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.AnalyzeArchitecture } as CliArguments) // Executes the command logic
        )
        .command( // GenerateModuleReadme (New)
            `${EnhancementType.GenerateModuleReadme} <targetPath>`,
            'Generate a README.md for a specific module directory using AI.',
            (yargsInstance) => { // Use builder directly as we don't need --output
                return yargsInstance
                    .positional('targetPath', {
                        describe: 'Path to the module directory.', // Specific description
                        type: 'string',
                        demandOption: true, // Ensure the target module directory is provided.
                    })
                    .option('prefix', { // Keep prefix option for module-specific focus
                        alias: 'p',
                        type: 'string',
                        description: 'Optional filename prefix filter for files within the module.',
                        demandOption: false, // Prefix filter is optional.
                    });
            },
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.GenerateModuleReadme } as CliArguments) // Executes the command logic
        )
        // --- End Architecture/Design System Commands ---

        // --- Test Generation Command (New) ---
        .command( // GenerateTests
            `${EnhancementType.GenerateTests} <targetPath>`,
            'Generate/update unit test file(s) for source file(s) using AI (output to tests/...).', // Updated description
            (yargsInstance) => {
                return yargsInstance
                    .positional('targetPath', {
                        describe: 'Path to the source file or directory to generate tests for.', // Supports file or dir
                        type: 'string',
                        demandOption: true, // Ensures the target path to source files or directories is provided
                    })
                    // Output is implicit now
                    .option('framework', {
                        alias: 'f',
                        type: 'string',
                        description: 'Testing framework hint for generation (e.g., jest, vitest, mocha).',
                        default: 'jest',
                    })
                    .option('prefix', { // Re-added prefix for directories
                        alias: 'p',
                        type: 'string',
                        description: 'Optional filename prefix filter (if targetPath is a directory).',
                        demandOption: false, // Prefix filter is optional.
                    });
            },
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.GenerateTests } as CliArguments) // Executes the command logic
        )
        // --- End Test Generation Command ---
        .command( // Develop (New)
            `${EnhancementType.Develop} <targetPath>`,
            'Develop the next feature based on REQUIREMENT.md and REQUIREMENTS_CHECKLIST.md.',
            (yargsInstance) => {
                return yargsInstance
                    .positional('targetPath', {
                        describe: 'Root project directory containing requirement files.',
                        type: 'string',
                        demandOption: true,
                    });
                // Add other options if needed in the future (e.g., --force-task=<id>)
            },
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.Develop } as CliArguments) // Executes the command logic
        )
        .command(
            `${EnhancementType.GenerateProgressReport} <targetPath>`,
            'Generate PROGRESS-{date}.md based on current requirements/checklist.',
            (yargsInstance) => {
                return yargsInstance
                    .positional('targetPath', {
                        describe: 'Root project directory containing requirement/checklist files.',
                        type: 'string',
                        demandOption: true,
                    })
                    .option('output', { // Optional: Allow overriding output dir/name
                        alias: 'o',
                        type: 'string',
                        description: 'Optional path/filename for the output progress report.',
                        demandOption: false,
                    });
            },
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.GenerateProgressReport } as CliArguments)
        )
        .demandCommand(1, 'Please specify a valid command (action).') // Ensures that at least one command is specified.
        .strict() // Enable strict mode to prevent unknown options.
        .help() // Enable the help command.
        .alias('h', 'help') // Alias 'h' for the help command.
        .wrap(null) // Wrap the help text to the terminal width.
        .fail((msg, err, yargs) => { // Custom error handling
            if (err) {
                console.error(`\n${logPrefix} 🚨 An unexpected error occurred during argument parsing:`);
                console.error(err);
                process.exit(1); // Exit the process with an error code
            }
            console.error(`\n${logPrefix} ❌ Error: ${msg}\n`);
            yargs.showHelp(); // Display the help message
            process.exit(1); // Exit the process with an error code
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
            process.exit(1); // Exit the process with an error code
        });
}