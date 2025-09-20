// File: src/k6-runner/services/k6-runner.service.ts

import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { TestCase } from "@/k6-runner/types/k6-runner.type";
import { parseDataSourceFile } from "@/shared/parsers/dataSource.parser";

const logPrefix = "[K6RunnerService]";

/**
 * Executes a k6 test script, with an option to export the summary.
 * This is an adapter to the external k6 process.
 * @param scriptPath - The path to the k6 script to run.
 * @param outputPath - Optional path to save the JSON summary report.
 * @returns A promise that resolves when k6 finishes, or rejects on failure.
 */
function executeK6(scriptPath: string, outputPath?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Dynamically build the command based on whether an output path is provided
    let command = `k6 run ${scriptPath}`;
    if (outputPath) {
      command += ` --summary-export=${outputPath}`;
      console.log(`${logPrefix} JSON summary will be saved to: ${outputPath}`);
    }

    console.log(`${logPrefix} Executing: ${command}`);
    const k6Process = exec(command);

    // Pipe the output from the k6 process to our main process's output streams
    k6Process.stdout?.pipe(process.stdout);
    k6Process.stderr?.pipe(process.stderr);

    k6Process.on("close", (code) => {
      if (code !== 0) {
        // A non-zero exit code indicates a failure (e.g., thresholds not met)
        reject(
          new Error(
            `k6 process exited with code ${code}. Thresholds may have failed.`
          )
        );
      } else {
        // A zero exit code indicates success
        resolve();
      }
    });
  });
}

/**
 * Main orchestrator for the data-driven k6 runner. It reads test cases from a
 * data source, generates a k6 script for each, executes it, and optionally saves
 * a summary report.
 * @param dataSourcePath - Path to the XLSX or CSV file.
 * @param outputDir - Optional directory path to save JSON summary reports.
 */
export async function runTestsFromDataSource(
  dataSourcePath: string,
  outputDir?: string
) {
  console.log(
    `${logPrefix} Starting test run with data source: ${dataSourcePath}`
  );

  // Delegate parsing to the shared utility
  const testCases = await parseDataSourceFile(dataSourcePath);
  console.log(`${logPrefix} Parsed ${testCases.length} test cases.`);

  // Load the k6 script template
  const templatePath = path.resolve(__dirname, "../templates/default.k6.js");
  const template = await fs.readFile(templatePath, "utf-8");

  // Ensure the output directory exists if the user specified one
  if (outputDir) {
    try {
      await fs.mkdir(outputDir, { recursive: true });
      console.log(`${logPrefix} Ensured output directory exists: ${outputDir}`);
    } catch (error) {
      throw new Error(
        `Failed to create output directory at ${outputDir}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  // Sequentially process each test case
  for (const test of testCases) {
    console.log(`\n--- [${logPrefix}] Running test: ${test.testName} ---`);

    // Sanitize the test name for use in filenames and k6 scenario names
    const sanitizedTestName = test.testName.replace(/[^a-zA-Z0-9_]/g, "");

    // Populate the k6 script template with data from the current test case
    const script = template
      .replace("__TEST_NAME__", sanitizedTestName)
      .replace("__METHOD__", test.method)
      .replace("__URL__", test.url)
      .replace(
        "__QUERY_PARAMS__",
        test.queryParams ? JSON.stringify(test.queryParams) : "null"
      )
      .replace("__BODY__", test.body ? JSON.stringify(test.body) : "null")
      .replace("__THRESHOLDS__", JSON.stringify(test.thresholds));

    // Define a unique path for the temporary script file
    const scriptPath = path.join(
      process.cwd(),
      `_test_${sanitizedTestName}.js`
    );
    await fs.writeFile(scriptPath, script);

    // Determine the unique output path for this specific test run's JSON summary
    let jsonOutputPath: string | undefined;
    if (outputDir) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `${sanitizedTestName}-${timestamp}.json`;
      jsonOutputPath = path.join(outputDir, fileName);
    }

    try {
      // Execute the k6 script and pass the specific output path for the summary
      await executeK6(scriptPath, jsonOutputPath);
      console.log(`--- [${logPrefix}] Test PASSED: ${test.testName} ---`);
    } catch (error) {
      console.error(`--- [${logPrefix}] Test FAILED: ${test.testName} ---`);
      // Re-throw the error to stop the entire execution and signal failure to the CLI
      throw error;
    } finally {
      // Clean up the temporary script file regardless of success or failure
      await fs.unlink(scriptPath);
    }
  }
  console.log(`\n${logPrefix} All ${testCases.length} test cases completed.`);
}
