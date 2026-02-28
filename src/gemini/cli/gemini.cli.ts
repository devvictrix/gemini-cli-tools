// File: src/gemini/cli/gemini.cli.ts

import yargs, { Argv } from "yargs";
import { hideBin } from "yargs/helpers";
import { CliArguments } from "@shared/types/app.type";
import { runCommandLogic } from "@/gemini/cli/gemini.handler";
import { ENHANCEMENT_TYPES } from "@/gemini/types/enhancement.type";

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
    // --- Unified Review Command ---
    .command(
      `${ENHANCEMENT_TYPES.REVIEW} <targetPath>`,
      "Review code for architecture, quality, or explanations (outputs to console).",
      (yargsInstance) => {
        return setupDefaultCommand(yargsInstance)
          .option("mode", {
            alias: "m",
            type: "string",
            description: "Review mode: architecture, quality, or explain",
            default: "quality",
            choices: ["architecture", "quality", "explain"],
          });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: ENHANCEMENT_TYPES.REVIEW,
        } as CliArguments)
    )
    // --- Unified Document Command ---
    .command(
      `${ENHANCEMENT_TYPES.DOCUMENT} <targetPath>`,
      "Generate documentation at the project, module, or tree level.",
      (yargsInstance) => {
        return setupDefaultCommand(yargsInstance)
          .option("level", {
            alias: "l",
            type: "string",
            description: "Documentation level: tree, module, or project",
            default: "project",
            choices: ["tree", "module", "project"],
          })
          .option("output", {
            alias: "o",
            type: "string",
            description: "Path for the output Markdown file.",
          })
          .option("descriptions", {
            alias: "d",
            type: "boolean",
            description: "Include standard descriptions for known directories (tree only).",
            default: false,
          })
          .option("depth", {
            alias: "L",
            type: "number",
            description: "Maximum directory depth to display (tree only).",
          })
          .option("exclude", {
            alias: "e",
            type: "string",
            description: 'Comma-separated list of patterns to exclude (tree only).',
            default: "",
          });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: ENHANCEMENT_TYPES.DOCUMENT,
        } as CliArguments)
    )
    .command(
      `${ENHANCEMENT_TYPES.CONSOLIDATE} <targetPath>`,
      "Consolidate code into a single output file (consolidated_output.txt). Supports filtering.",
      (yargsInstance) => {
        return setupDefaultCommand(yargsInstance).option("pattern", {
          alias: "P",
          type: "string",
          description:
            'Filter: Include files matching pattern (e.g., "*cmd*", "use*.ts", "*.helper.*"). Overrides --prefix.',
          demandOption: false,
        }).option("stripComments", {
          type: "boolean",
          description: 'Strip standard comments and boilerplate from output to save model tokens',
          default: false,
        }).option("minify", {
          alias: "M",
          type: "boolean",
          description: 'Aggressively compress output for LLM context (removes all blank lines, debug logs, truncates large strings). Implies --stripComments.',
          default: false,
        });
      },
      (argv) =>
        runCommandLogic({
          ...argv,
          command: ENHANCEMENT_TYPES.CONSOLIDATE,
        } as CliArguments)
    )

    .command(
      `${ENHANCEMENT_TYPES.GENERATE_TESTS} <targetPath>`,
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
          command: ENHANCEMENT_TYPES.GENERATE_TESTS,
        } as CliArguments)
    )
    .command(
      `${ENHANCEMENT_TYPES.INIT} <targetPath>`,
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
          command: ENHANCEMENT_TYPES.INIT,
        } as CliArguments)
    )
    .command(
      `${ENHANCEMENT_TYPES.DEVELOP} <targetPath>`,
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
          command: ENHANCEMENT_TYPES.DEVELOP,
        } as CliArguments)
    )
    .command(
      `${ENHANCEMENT_TYPES.GENERATE_PROGRESS_REPORT} <targetPath>`,
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
          command: ENHANCEMENT_TYPES.GENERATE_PROGRESS_REPORT,
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
