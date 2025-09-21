// File: src/gemini/commands/run-k6.command.ts

import path from "path";
import { CliArguments } from "@shared/types/app.type";
import { EnhancementType } from "@/gemini/types/enhancement.type";
import { runTestsFromDataSource } from "@/k6/services/k6.service";

const logPrefix = "[RunK6Command]";

export async function execute(args: CliArguments): Promise<void> {
  if (args.command !== EnhancementType.RunK6) {
    throw new Error(`${logPrefix} Handler mismatch: Expected RunK6 command.`);
  }

  // Destructure all relevant arguments, including the new 'summaryCsv'
  const {
    targetPath,
    output,
    summaryFormat,
    htmlReport,
    cloud,
    mock,
    summaryCsv,
  } = args;

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

  // Pass all arguments, including the new 'summaryCsv', to the service layer.
  await runTestsFromDataSource(
    absolutePath,
    output as string | undefined,
    format,
    htmlReport as string | undefined,
    cloud as string | undefined,
    mock as boolean | undefined,
    summaryCsv as string | undefined // Pass the new argument
  );
}
