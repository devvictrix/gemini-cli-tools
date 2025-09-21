// File: src/k6/services/k6.service.ts

import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { TestCase } from "@/k6/types/k6.schema";
import { parseDataSourceFile } from "@/k6/parsers/data-source.parser";

const logPrefix = "[K6Service]";

function promisifiedExec(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`${logPrefix} Executing: ${command}`);
    const childProc = exec(command, { env: process.env }, (error) => {
      if (error) {
        if (error.code === 99) {
          console.warn(
            `${logPrefix} k6 exited with code 99. Thresholds were crossed.`
          );
          resolve();
        } else {
          reject(error);
        }
        return;
      }
      resolve();
    });
    childProc.stdout?.pipe(process.stdout);
    childProc.stderr?.pipe(process.stderr);
  });
}

// In: src/k6/services/k6.service.ts
function generateTestFunction(test: TestCase): string {
  const sanitizedTestName = (test.testName || `test_${Date.now()}`).replace(
    /[^a-zA-Z0-9_]/g,
    ""
  );

  return `
export function ${sanitizedTestName}() {
    group("${test.testName}", function() {
        const url = replacePlaceholders(${JSON.stringify(test.url)}, extractedVars);
        const body = ${test.body ? JSON.stringify(test.body) : "null"};
        const resolvedBody = body ? replacePlaceholders(body, extractedVars) : null;
        
        const params = {
            headers: {
                'Content-Type': 'application/json',
                ...replacePlaceholders(${JSON.stringify(test.headers || {})}, extractedVars)
            },
        };

        // --- CORRECTED LINE ---
        // Use bracket notation to handle reserved keywords like 'delete'
        const res = http['${test.method.toLowerCase()}'](url, resolvedBody ? JSON.stringify(resolvedBody) : null, params);

        check(res, { 'status is 2xx': (r) => r.status >= 200 && r.status < 300 });

        const checksToRun = ${JSON.stringify(test.checks || {})};
        for (const name in checksToRun) {
            check(res, { [name]: (r) => {
                try {
                    const body = r.json();
                    return eval(checksToRun[name]);
                } catch(e) { return false; }
            }});
        }

        const extractRules = ${JSON.stringify(test.extract || {})};
        if (res.status < 300) {
            try {
                const jsonBody = res.json();
                for (const varName in extractRules) {
                    extractedVars[varName] = getJsonValue(jsonBody, extractRules[varName]);
                }
            } catch(e) {}
        }
    });
    sleep(1);
}
`;
}

export async function runTestsFromDataSource(
  dataSourcePath: string,
  outputDir?: string,
  summaryFormat: "json" | "csv" = "json",
  htmlReportPath?: string
) {
  console.log(`${logPrefix} Starting...`);
  const testCases = await parseDataSourceFile(dataSourcePath);
  console.log(
    `${logPrefix} Parsed and validated ${testCases.length} test cases.`
  );

  const templatePath = path.resolve(__dirname, "../templates/default.k6.js");
  const template = await fs.readFile(templatePath, "utf-8");

  const scenarios: { [key: string]: object } = {};
  const functions: string[] = [];
  const globalThresholds: { [key: string]: any } = {};

  for (const test of testCases) {
    const sanitizedTestName = (test.testName || `test_${Date.now()}`).replace(
      /[^a-zA-Z0-9_]/g,
      ""
    );
    scenarios[sanitizedTestName] = {
      exec: sanitizedTestName,
      ...(test.executorOptions || {
        executor: "per-vu-iterations",
        vus: 1,
        iterations: 1,
      }),
    };
    functions.push(generateTestFunction(test));
    if (test.thresholds) {
      Object.assign(globalThresholds, test.thresholds);
    }
  }

  const finalScript = template
    .replace("__SCENARIOS_OBJECT__", JSON.stringify(scenarios, null, 2))
    .replace("__THRESHOLDS_OBJECT__", JSON.stringify(globalThresholds, null, 2))
    .replace("__INJECTED_TEST_FUNCTIONS__", functions.join("\n"));

  const scriptPath = path.join(process.cwd(), `_generated_master_script.js`);
  await fs.writeFile(scriptPath, finalScript);
  console.log(`${logPrefix} Master script generated at ${scriptPath}`);

  // *** FIX: Ensure the output directory exists before running k6 ***
  if (outputDir) {
    try {
      await fs.mkdir(outputDir, { recursive: true });
      console.log(`${logPrefix} Ensured output directory exists: ${outputDir}`);
    } catch (e) {
      console.error(
        `${logPrefix} Failed to create output directory: ${outputDir}`
      );
      throw e;
    }
  }
  // *** END FIX ***

  const tempJsonForHtml = htmlReportPath
    ? path.join(process.cwd(), `_temp_report_${Date.now()}.json`)
    : undefined;

  try {
    let command = `k6 run ${scriptPath}`;
    if (outputDir) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `summary-${timestamp}.${summaryFormat}`;
      const summaryOutputPath = path.join(outputDir, fileName);
      if (summaryFormat === "json")
        command += ` --summary-export=${summaryOutputPath}`;
      if (summaryFormat === "csv") command += ` --out csv=${summaryOutputPath}`;
    }
    if (tempJsonForHtml) command += ` --out json=${tempJsonForHtml}`;

    await promisifiedExec(command);
    console.log(`--- [${logPrefix}] Test Run FINISHED ---`);
  } catch (error) {
    console.error(`--- [${logPrefix}] Test Run ERRORED ---`);
    throw error;
  } finally {
    await fs.unlink(scriptPath);
  }

  if (htmlReportPath && tempJsonForHtml) {
    try {
      await fs.access(tempJsonForHtml);
      console.log(`\n--- [${logPrefix}] Generating HTML report ---`);

      // --- FINAL FIX: Revert to npx, which is the standard and correct way ---
      const reportCommand = `npx k6-html-reporter ${tempJsonForHtml} --output ${htmlReportPath}`;

      await promisifiedExec(reportCommand);
      console.log(
        `${logPrefix} ✅ Successfully generated HTML report at: ${htmlReportPath}`
      );
    } catch (reportError) {
      console.error(
        `${logPrefix} ❌ Failed to generate HTML report. Error: ${reportError}`
      );
    } finally {
      try {
        await fs.unlink(tempJsonForHtml);
      } catch (e) {}
    }
  }
  console.log(`\n--- [${logPrefix}] Overall process complete. ---`);
}
