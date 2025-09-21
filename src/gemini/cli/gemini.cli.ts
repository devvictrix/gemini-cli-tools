// File: src/gemini/cli/gemini.cli.ts

import yargs, { Argv } from "yargs";
import { hideBin } from "yargs/helpers";
import { CliArguments } from "@shared/types/app.type";
import { runCommandLogic } from "@/gemini/cli/gemini.handler";
import { EnhancementType } from "@/gemini/types/enhancement.type";

const logPrefix = "[GeminiCLI]";

const setupDefaultCommand = (
  yargsInstance: Argv<{}>
): Argv<{ targetPath: string; prefix: string | undefined }> => {
  return yargsInstance
    .positional("targetPath", {
      describe: "Target file or directory path",
      type: "string",
      demandOption: true,
    })
    .option("prefix", {
      alias: "p",
      type: "string",
      description: "Optional filename prefix filter for directory processing.",
      demandOption: false,
    });
};

export async function runCli(processArgs: string[]): Promise<void> {
  console.log(`${logPrefix} Initializing...`);

  await yargs(hideBin(processArgs))
    // --- Standard Enhancement Commands ---
    .command(
      `${EnhancementType.AddComments} <targetPath>`,
      "Add AI-generated comments to files.",
      setupDefaultCommand,
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.AddComments,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.Analyze} <targetPath>`,
      "Analyze code structure and quality (outputs to console).",
      setupDefaultCommand,
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.Analyze,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.Explain} <targetPath>`,
      "Explain what the code does (outputs to console).",
      setupDefaultCommand,
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.Explain,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.SuggestImprovements} <targetPath>`,
      "Suggest improvements for the code (outputs to console).",
      setupDefaultCommand,
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.SuggestImprovements,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.GenerateDocs} <targetPath>`,
      "Generate Markdown documentation for the project (saves to README.md).",
      setupDefaultCommand,
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.GenerateDocs,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.AddPathComment} <targetPath>`,
      'Add "// File: <relativePath>" comment header to files.',
      setupDefaultCommand,
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.AddPathComment,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.Consolidate} <targetPath>`,
      "Consolidate code into a single output file (consolidated_output.txt). Supports filtering.",
      (yargsInstance) => {
        return setupDefaultCommand(yargsInstance).option("pattern", {
          alias: "P",
          type: "string",
          description:
            'Filter: Include files matching pattern (e.g., "*cmd*", "use*.ts", "*.helper.*"). Overrides --prefix.',
          demandOption: false,
        });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.Consolidate,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.InferFromData} <targetPath>`,
      "Infer TypeScript interface from a JSON data file (outputs to console).",
      (yargsInstance) => {
        return yargsInstance
          .positional("targetPath", {
            describe: "Path to the JSON data file",
            type: "string",
            demandOption: true,
          })
          .option("interfaceName", {
            alias: "i",
            type: "string",
            description: "Name for the generated TypeScript interface",
            demandOption: true,
          });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.InferFromData,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.GenerateStructureDoc} [targetPath]`,
      "Generate a Markdown file representing the project directory structure.",
      (yargsInstance) => {
        return yargsInstance
          .positional("targetPath", {
            describe: "Root directory to scan.",
            type: "string",
            default: ".",
          })
          .option("output", {
            alias: "o",
            type: "string",
            description: "Path for the output Markdown file.",
            default: "Project_Structure.md",
          })
          .option("descriptions", {
            alias: "d",
            type: "boolean",
            description: "Include standard descriptions for known directories.",
            default: false,
          })
          .option("depth", {
            alias: "L",
            type: "number",
            description: "Maximum directory depth to display.",
          })
          .option("exclude", {
            alias: "e",
            type: "string",
            description:
              'Comma-separated list of patterns to exclude (e.g., "node_modules,.git").',
            default: "",
          });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.GenerateStructureDoc,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.AnalyzeArchitecture} <targetPath>`,
      "Generate an AI-driven analysis of the project architecture (saves to file).",
      (yargsInstance) => {
        return yargsInstance
          .positional("targetPath", {
            describe: "Root project directory to analyze.",
            type: "string",
            demandOption: true,
          })
          .option("output", {
            alias: "o",
            type: "string",
            description:
              "Path for the output Architecture Analysis Markdown file.",
            default: "AI_Architecture_Analyzed.md",
          })
          .option("prefix", {
            alias: "p",
            type: "string",
            description: "Optional filename prefix filter for included files.",
            demandOption: false,
          });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.AnalyzeArchitecture,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.GenerateModuleReadme} <targetPath>`,
      "Generate a README.md for a specific module directory using AI.",
      (yargsInstance) => {
        return yargsInstance
          .positional("targetPath", {
            describe: "Path to the module directory.",
            type: "string",
            demandOption: true,
          })
          .option("prefix", {
            alias: "p",
            type: "string",
            description:
              "Optional filename prefix filter for files within the module.",
            demandOption: false,
          });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.GenerateModuleReadme,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.GenerateTests} <targetPath>`,
      "Generate/update unit test file(s) for source file(s) using AI (output to tests/...).",
      (yargsInstance) => {
        return yargsInstance
          .positional("targetPath", {
            describe:
              "Path to the source file or directory to generate tests for.",
            type: "string",
            demandOption: true,
          })
          .option("framework", {
            alias: "f",
            type: "string",
            description:
              "Testing framework hint for generation (e.g., jest, vitest, mocha).",
            default: "jest",
          })
          .option("prefix", {
            alias: "p",
            type: "string",
            description:
              "Optional filename prefix filter (if targetPath is a directory).",
            demandOption: false,
          });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.GenerateTests,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.Init} <targetPath>`,
      "Initialize a new target project with basic structure and files.",
      (yargsInstance: Argv) => {
        return yargsInstance
          .positional("targetPath", {
            describe: "Directory to initialize the new project in.",
            type: "string",
            demandOption: true,
          })
          .option("packageName", {
            alias: "n",
            type: "string",
            description: "The name of the new project (for package.json).",
            demandOption: true,
          })
          .option("description", {
            alias: "d",
            type: "string",
            description: "A short description for the new project.",
            demandOption: false,
          })
          .option("force", {
            alias: "f",
            type: "boolean",
            description:
              "Force initialization even if the target directory is not empty.",
            default: false,
          });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.Init,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.Develop} <targetPath>`,
      "Develop the next feature based on FEATURE_ROADMAP.md within the target project.",
      (yargsInstance) => {
        return yargsInstance.positional("targetPath", {
          describe: "Root project directory containing FEATURE_ROADMAP.md.",
          type: "string",
          demandOption: true,
        });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.Develop,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.GenerateProgressReport} <targetPath>`,
      "Generate PROGRESS-{date}.md based on current requirements/checklist.",
      (yargsInstance) => {
        return yargsInstance
          .positional("targetPath", {
            describe:
              "Root project directory containing requirement/checklist files.",
            type: "string",
            demandOption: true,
          })
          .option("output", {
            alias: "o",
            type: "string",
            description:
              "Optional path/filename for the output progress report.",
            demandOption: false,
          });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.GenerateProgressReport,
        } as CliArguments)
    )
    .command(
      `${EnhancementType.RunK6} <targetPath>`,
      "Run data-driven k6 tests from a source file (XLSX or CSV).",
      (yargsInstance) => {
        return yargsInstance
          .positional("targetPath", {
            describe: "Path to the XLSX or CSV data source file.",
            type: "string",
            demandOption: true,
          })
          .option("output", {
            alias: "o",
            type: "string",
            description: "Optional directory path to save raw summary reports.",
            demandOption: false,
          })
          .option("summaryFormat", {
            alias: "f",
            type: "string",
            description:
              "Format for raw reports (json or csv). 'csv' is required for --summaryCsv.",
            default: "json",
            choices: ["json", "csv"],
          })
          .option("htmlReport", {
            alias: "H",
            type: "string",
            description:
              "Path to save a consolidated HTML report for the entire run.",
            demandOption: false,
          })
          .option("summaryCsv", {
            alias: "S",
            type: "string",
            description:
              "Path to save a powerful, human-readable summary CSV report. Requires --output and --summaryFormat csv.",
            demandOption: false,
          })
          .option("cloud", {
            alias: "c",
            type: "string",
            description:
              "Run test on Grafana Cloud k6 using the provided API token.",
            demandOption: false,
          })
          .option("mock", {
            alias: "m",
            type: "boolean",
            description:
              "Start a local mock server for testing the runner logic.",
            default: false,
          });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: EnhancementType.RunK6,
        } as CliArguments)
    )
    .demandCommand(1, "Please specify a valid command (action).")
    .strict()
    .help()
    .alias("h", "help")
    .wrap(yargs.terminalWidth())
    .fail((msg, err, yargsInstance) => {
      if (err) {
        console.error(
          `\n${logPrefix} 🚨 An unexpected error occurred during argument parsing:`
        );
        console.error(err);
        process.exit(1);
      }
      const specificMsg = msg || "Invalid command or arguments.";
      console.error(`\n${logPrefix} ❌ Error: ${specificMsg}\n`);
      yargsInstance.showHelp();
      process.exit(1);
    })
    .parseAsync()
    .catch((error) => {
      console.error(
        `\n${logPrefix} 🚨 An unexpected critical error occurred during execution:`
      );
      if (error instanceof Error) {
        console.error(`   Message: ${error.message}`);
        if (error.stack) {
          console.error(error.stack);
        }
      } else {
        console.error("   An unknown error object was thrown:", error);
      }
      process.exit(1);
    });
}
