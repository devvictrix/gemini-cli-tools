// File: src/gemini/cli/gemini.handler.ts

import { CliArguments } from "@shared/types/app.type";
import { ENHANCEMENT_TYPES } from "@/gemini/types/enhancement.type";

import * as consolidateCmd from "@/gemini/commands/consolidate.command";
import * as generateTestsCmd from "@/gemini/commands/generate-tests.command";
import * as developCmd from "@/gemini/commands/develop.command";
import * as generateProgressReportCmd from "@/gemini/commands/generate-progress-report.command";
import * as initCmd from "@/gemini/commands/init.command";
import * as reviewCmd from "@/gemini/commands/review.command";
import * as documentCmd from "@/gemini/commands/document.command";

const logPrefix = "[GeminiHandler]";

const commandHandlerMap: {
  [key in ENHANCEMENT_TYPES]: (args: CliArguments) => Promise<void>;
} = {
  [ENHANCEMENT_TYPES.REVIEW]: reviewCmd.execute,
  [ENHANCEMENT_TYPES.DOCUMENT]: documentCmd.execute,
  [ENHANCEMENT_TYPES.CONSOLIDATE]: consolidateCmd.execute,
  [ENHANCEMENT_TYPES.GENERATE_TESTS]: generateTestsCmd.execute,
  [ENHANCEMENT_TYPES.DEVELOP]: developCmd.execute,
  [ENHANCEMENT_TYPES.GENERATE_PROGRESS_REPORT]: generateProgressReportCmd.execute,
  [ENHANCEMENT_TYPES.INIT]: initCmd.execute,
};

export async function runCommandLogic(argv: CliArguments): Promise<void> {
  const handler = commandHandlerMap[argv.command];

  if (!handler) {
    console.error(
      `${logPrefix} ❌ Internal Error: No handler found for command: ${argv.command}`
    );
    process.exitCode = 1;
    throw new Error(`No handler found for command: ${argv.command}`);
  }

  try {
    await handler(argv);
    console.log(`\n${logPrefix} Command '${argv.command}' finished.`);
  } catch (error) {
    // ... (rest of the error handling code remains the same) ...
    const isAlreadyLoggedByCommand =
      error instanceof Error &&
      (error.message.startsWith(logPrefix) ||
        error.message.startsWith("[InitCommand]") ||
        error.message.startsWith("[DevelopCmd]"));

    if (!isAlreadyLoggedByCommand) {
      console.error(
        `\n${logPrefix} ❌ Error during execution of command '${argv.command}':`
      );
    }

    if (error instanceof Error) {
      if (!isAlreadyLoggedByCommand) {
        console.error(`   Message: ${error.message}`);
      }

      const isUserInputError =
        error.message.includes("Cannot access target path") ||
        error.message.includes("Target path for") ||
        error.message.includes("must be a directory") ||
        error.message.includes("must be a file") ||
        error.message.includes("is required") ||
        error.message.includes("is not empty. Use --force") ||
        error.message.includes("exists but is not a directory");

      if (!isUserInputError && error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error("   An unknown error object was thrown:", error);
    }
    process.exitCode = 1;
    throw error;
  }
}
