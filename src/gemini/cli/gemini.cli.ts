// File: src/gemini/cli/gemini.cli.ts
// Status: Updated (Changed default output for AnalyzeArchitecture)

import yargs, { Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CliArguments } from '../../shared/types/app.type.js';
import { runCommandLogic } from './gemini.handler.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[GeminiCLI]";

/**
 * Sets up common options (targetPath, prefix) for yargs commands.
 */
const setupDefaultCommand = (yargsInstance: Argv<{}>): Argv<{ targetPath: string; prefix: string | undefined }> => {
    return yargsInstance
        .positional('targetPath', {
            describe: 'Target file or directory path',
            type: 'string',
            demandOption: true,
        })
        .option('prefix', {
            alias: 'p',
            type: 'string',
            description: 'Optional filename prefix filter for directory processing.',
            demandOption: false,
        });
};

/**
 * Configures and runs the yargs CLI parser.
 */
export async function runCli(processArgs: string[]): Promise<void> {
    console.log(`${logPrefix} Initializing...`);

    await yargs(hideBin(processArgs))
        // --- Standard Enhancement Commands ---
        .command( // AddComments
            `${EnhancementType.AddComments} <targetPath>`,
            'Add AI-generated comments to files.',
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.AddComments } as CliArguments)
        )
        .command( // Analyze
            `${EnhancementType.Analyze} <targetPath>`,
            'Analyze code structure and quality (outputs to console).', // Clarified output
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.Analyze } as CliArguments)
        )
        .command( // Explain
            `${EnhancementType.Explain} <targetPath>`,
            'Explain what the code does (outputs to console).', // Clarified output
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.Explain } as CliArguments)
        )
        .command( // SuggestImprovements
            `${EnhancementType.SuggestImprovements} <targetPath>`,
            'Suggest improvements for the code (outputs to console).', // Clarified output
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.SuggestImprovements } as CliArguments)
        )
        .command( // GenerateDocs
            `${EnhancementType.GenerateDocs} <targetPath>`,
            'Generate Markdown documentation for the project (saves to README.md).',
            setupDefaultCommand,
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.GenerateDocs } as CliArguments)
        )

        // --- Local Manipulation Commands ---
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
        .command( // InferFromData
            `${EnhancementType.InferFromData} <targetPath>`,
            'Infer TypeScript interface from a JSON data file (outputs to console).', // Clarified output
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
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.GenerateStructureDoc } as CliArguments)
        )
        .command( // AnalyzeArchitecture (Updated Default Output)
            `${EnhancementType.AnalyzeArchitecture} <targetPath>`,
            'Generate an AI-driven analysis of the project architecture (saves to file).',
            (yargsInstance) => {
                return yargsInstance
                    .positional('targetPath', {
                        describe: 'Root project directory to analyze.', // More specific description
                        type: 'string',
                        demandOption: true,
                    })
                    .option('output', {
                        alias: 'o',
                        type: 'string',
                        description: 'Path for the output Architecture Analysis Markdown file.',
                        default: 'AI Architecture Analyzed.md', // <<< Changed Default Name
                    })
                    .option('prefix', { // Keep prefix option available if needed
                        alias: 'p',
                        type: 'string',
                        description: 'Optional filename prefix filter for included files.',
                        demandOption: false,
                    });
            },
            (argv) => runCommandLogic({ ...argv, command: EnhancementType.AnalyzeArchitecture } as CliArguments)
        )
        // --- End Architecture/Design System Commands ---

        .demandCommand(1, 'Please specify a valid command (action).')
        .strict()
        .help()
        .alias('h', 'help')
        .wrap(null)
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