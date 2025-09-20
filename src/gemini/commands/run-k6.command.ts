// File: src/gemini/commands/run-k6.command.ts

import path from "path";
import { CliArguments } from "@shared/types/app.type";
import { EnhancementType } from "@/gemini/types/enhancement.type";
import { runTestsFromDataSource } from "@/k6-runner/services/k6-runner.service";

const logPrefix = "[RunK6Command]";

export async function execute(args: CliArguments): Promise<void> {
  if (args.command !== EnhancementType.RunK6) {
    throw new Error(`${logPrefix} Handler mismatch: Expected RunK6 command.`);
  }

  const { targetPath, output } = args;
  if (!targetPath) {
    throw new Error(`${logPrefix} Target path (XLSX or CSV file) is required.`);
  }

  const absolutePath = path.resolve(targetPath);
  console.log(
    `\n${logPrefix} Initializing k6 test runner for data source: ${absolutePath}`
  );

  await runTestsFromDataSource(absolutePath, output as string | undefined);
}
