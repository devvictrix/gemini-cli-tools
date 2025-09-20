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

  // Capture all relevant arguments
  const { targetPath, output, summaryFormat, htmlReport } = args;

  if (!targetPath) {
    throw new Error(`${logPrefix} Target path (XLSX or CSV file) is required.`);
  }

  const absolutePath = path.resolve(targetPath);
  console.log(
    `\n${logPrefix} Initializing k6 test runner for data source: ${absolutePath}`
  );

  const format =
    summaryFormat === "csv" || summaryFormat === "json"
      ? summaryFormat
      : "json";

  // Pass all arguments to the service layer.
  await runTestsFromDataSource(
    absolutePath,
    output as string | undefined,
    format,
    htmlReport as string | undefined
  );
}
