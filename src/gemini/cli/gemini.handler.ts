// File: src/gemini/cli/gemini.handler.ts

import { CliArguments } from "@shared/types/app.type";
import { EnhancementType } from "@/gemini/types/enhancement.type";

// --- Import Command Handlers ---
import * as addCommentsCmd from "@/gemini/commands/add-comments.command";
import * as addPathCommentCmd from "@/gemini/commands/add-path-comment.command";
import * as analyzeCmd from "@/gemini/commands/analyze.command";
import * as consolidateCmd from "@/gemini/commands/consolidate.command";
import * as explainCmd from "@/gemini/commands/explain.command";
import * as generateDocsCmd from "@/gemini/commands/generate-docs.command";
import * as generateStructureDocCmd from "@/gemini/commands/generate-structure-doc.command";
import * as inferFromDataCmd from "@/gemini/commands/infer-from-data.command";
import * as suggestImprovementsCmd from "@/gemini/commands/suggest-improvements.command";
import * as analyzeArchitectureCmd from "@/gemini/commands/analyze-architecture.command";
import * as generateModuleReadmeCmd from "@/gemini/commands/generate-module-readme.command";
import * as generateTestsCmd from "@/gemini/commands/generate-tests.command";
import * as developCmd from "@/gemini/commands/develop.command";
import * as generateProgressReportCmd from "@/gemini/commands/generate-progress-report.command";
import * as initCmd from "@/gemini/commands/init.command";
import * as runK6Cmd from "@/gemini/commands/run-k6.command";

const logPrefix = "[GeminiHandler]";

const commandHandlerMap: {
  [key in EnhancementType]: (args: CliArguments) => Promise<void>;
} = {
  [EnhancementType.AddComments]: addCommentsCmd.execute,
  [EnhancementType.AddPathComment]: addPathCommentCmd.execute,
  [EnhancementType.Analyze]: analyzeCmd.execute,
  [EnhancementType.Consolidate]: consolidateCmd.execute,
  [EnhancementType.Explain]: explainCmd.execute,
  [EnhancementType.GenerateDocs]: generateDocsCmd.execute,
  [EnhancementType.GenerateStructureDoc]: generateStructureDocCmd.execute,
  [EnhancementType.InferFromData]: inferFromDataCmd.execute,
  [EnhancementType.SuggestImprovements]: suggestImprovementsCmd.execute,
  [EnhancementType.AnalyzeArchitecture]: analyzeArchitectureCmd.execute,
  [EnhancementType.GenerateModuleReadme]: generateModuleReadmeCmd.execute,
  [EnhancementType.GenerateTests]: generateTestsCmd.execute,
  [EnhancementType.Develop]: developCmd.execute,
  [EnhancementType.GenerateProgressReport]: generateProgressReportCmd.execute,
  [EnhancementType.Init]: initCmd.execute,
  [EnhancementType.RunK6]: runK6Cmd.execute,
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
