// File: src/k6/services/k6.service.ts

import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import express, { Express, Request, Response } from "express";
import http from "http";
import { TestCase } from "@/k6/types/k6.schema";
import { parseDataSourceFile } from "@/k6/parsers/data-source.parser";
import { generateSummaryCsv } from "./results.service";

const logPrefix = "[K6Service]";

// --- Embedded k6 Script Template ---
const K6_SCRIPT_TEMPLATE = `
import http from "k6/http";
import { check, sleep, group } from "k6";
const SCENARIOS_OBJECT = __SCENARIOS_OBJECT__;
const THRESHOLDS_OBJECT = __THRESHOLDS_OBJECT__;
let extractedVars = {};
export const options = { scenarios: SCENARIOS_OBJECT, thresholds: THRESHOLDS_OBJECT };
function getJsonValue(obj, path) { if (!obj || typeof path !== 'string') return undefined; return path.split(".").reduce((o, k) => (o || {})[k], obj); }
function replacePlaceholders(target, vars) { if (target === null || target === undefined) return target; let jsonString = JSON.stringify(target); jsonString = jsonString.replace(/\\"{\\{\\$randomInt\\((\\d+),(\\d+)\\)\\}}\\"/g, (_, min, max) => Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) + parseInt(min)); jsonString = jsonString.replace(/\\{\\{(\\w+)\\}\\}/g, (_, varName) => vars[varName] || ""); return JSON.parse(jsonString); }
__INJECTED_TEST_SCENARIOS__
`;

class MockServer {
  private app: Express;
  private server: http.Server | null = null;
  private readonly port = 3333;

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.post("/auth/token/login/", (req: Request, res: Response) => {
      if (req.body.username === "devvi" && req.body.password === "secret") {
        res.json({ refresh: "mock_refresh_token", access: "valid-token" });
      } else {
        res.status(401).json({ detail: "Invalid Credentials" });
      }
    });

    this.app.get("/public/crocodiles/1/", (req: Request, res: Response) => {
      res.json([{ id: 1, name: "Mock Bert" }]);
    });

    this.app.get("/public/crocodiles/", (req: Request, res: Response) => {
      res.json([
        { id: 1, name: "Bert", sex: "M" },
        { id: 2, name: "Berta", sex: "F" },
      ]);
    });

    this.app.get("/my/crocodiles/", (req: Request, res: Response) => {
      if (req.headers.authorization === "Bearer valid-token") {
        res.json([{ id: 3, name: "Lyle (Protected)", sex: "M" }]);
      } else {
        res.status(403).json({ detail: "Forbidden" });
      }
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(
          `[MockServer] Mock server started on http://localhost:${this.port}`
        );
        resolve();
      });
    });
  }
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) return reject(err);
          console.log("[MockServer] Mock server stopped.");
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

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

function groupTestCasesByScenario(
  testCases: TestCase[]
): Map<string, TestCase[]> {
  const scenarios = new Map<string, TestCase[]>();
  testCases.forEach((test, index) => {
    const scenarioName =
      test.scenario || `_individual_test_${index}_${test.testName}`;
    if (!scenarios.has(scenarioName)) {
      scenarios.set(scenarioName, []);
    }
    scenarios.get(scenarioName)?.push(test);
  });
  return scenarios;
}

function generateScenarioFunction(
  scenarioName: string,
  steps: TestCase[]
): string {
  const sanitizedScenarioName = scenarioName.replace(/[^a-zA-Z0-9_]/g, "");
  const stepFunctions = steps
    .map(
      (step) => `
    group("${step.testName}", function() {
        const url = replacePlaceholders(${JSON.stringify(step.url)}, extractedVars);
        const body = ${step.body ? JSON.stringify(step.body) : "null"};
        const resolvedBody = body ? replacePlaceholders(body, extractedVars) : null;
        const headers = replacePlaceholders(${JSON.stringify(step.headers || {})}, extractedVars);
        const params = { headers: { 'Content-Type': 'application/json', ...headers }, tags: ${JSON.stringify(step.tags || {})} };
        const res = http['${step.method.toLowerCase()}'](url, resolvedBody ? JSON.stringify(resolvedBody) : undefined, params);
        const checksToRun = ${JSON.stringify(step.checks || [])};
        checksToRun.forEach(c => {
            let checkResult = false;
            let checkName = \`\${c.type} check\`;
            try {
                switch(c.type) {
                    case 'statusCode': checkResult = res.status === c.expected; checkName = \`status is \${c.expected}\`; break;
                    case 'bodyContains': checkResult = res.body && res.body.includes(c.expected); checkName = \`body contains "\${c.expected}"\`; break;
                    case 'jsonPathValue': checkResult = getJsonValue(res.json(), c.path) == c.expected; checkName = \`JSON '\${c.path}' is \${c.expected}\`; break;
                }
            } catch (e) {}
            check(res, { [checkName]: () => checkResult });
        });
        const extractRules = ${JSON.stringify(step.extract || [])};
        if (res.status >= 200 && res.status < 300) {
            try {
                const jsonBody = res.json();
                extractRules.forEach(rule => { extractedVars[rule.variable] = getJsonValue(jsonBody, rule.path); });
            } catch(e) {}
        }
    });
    sleep(1);
    `
    )
    .join("\n");
  return `
export function ${sanitizedScenarioName}() {
    extractedVars = {};
    ${stepFunctions}
}`;
}

export async function runTestsFromDataSource(
  dataSourcePath: string,
  outputDir?: string,
  summaryFormat: "json" | "csv" = "json",
  htmlReportPath?: string,
  cloudToken?: string,
  useMockServer: boolean = false,
  summaryCsvPath?: string // <-- Add new parameter
) {
  console.log(`${logPrefix} Starting...`);
  const testCases = await parseDataSourceFile(dataSourcePath);
  console.log(
    `${logPrefix} Parsed and validated ${testCases.length} test cases.`
  );
  const mockServer = new MockServer();
  const scriptPath = path.join(process.cwd(), `_generated_master_script.js`);
  const tempJsonForHtml = htmlReportPath
    ? path.join(process.cwd(), `_temp_report_${Date.now()}.json`)
    : undefined;
  let summaryExportPath: string | undefined; // To store the path of the raw k6 output

  try {
    if (useMockServer) {
      await mockServer.start();
    }
    const scenariosMap = groupTestCasesByScenario(testCases);
    const k6Scenarios: { [key: string]: object } = {};
    const scenarioFunctions: string[] = [];
    const globalThresholds: { [key: string]: any } = {};
    scenariosMap.forEach((steps, scenarioName) => {
      const sanitizedScenarioName = scenarioName.replace(/[^a-zA-Z0-9_]/g, "");
      k6Scenarios[sanitizedScenarioName] = {
        exec: sanitizedScenarioName,
        ...(steps[0].executorOptions || {
          executor: "per-vu-iterations",
          vus: 1,
          iterations: 1,
        }),
      };
      scenarioFunctions.push(generateScenarioFunction(scenarioName, steps));
      if (steps[0].thresholds) {
        Object.assign(globalThresholds, steps[0].thresholds);
      }
    });
    const finalScript = K6_SCRIPT_TEMPLATE.replace(
      "__SCENARIOS_OBJECT__",
      JSON.stringify(k6Scenarios, null, 2)
    )
      .replace(
        "__THRESHOLDS_OBJECT__",
        JSON.stringify(globalThresholds, null, 2)
      )
      .replace("__INJECTED_TEST_SCENARIOS__", scenarioFunctions.join("\n"));
    await fs.writeFile(scriptPath, finalScript);
    console.log(`${logPrefix} Master script generated at ${scriptPath}`);
    if (outputDir) {
      await fs.mkdir(outputDir, { recursive: true });
    }
    let command: string;
    const runType = cloudToken ? "cloud" : "run";
    command = `k6 ${runType} ${scriptPath}`;
    if (cloudToken) {
      process.env.K6_CLOUD_TOKEN = cloudToken;
    }
    if (outputDir && !cloudToken) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `summary-${timestamp}.${summaryFormat}`;
      summaryExportPath = path.join(outputDir, fileName); // Capture the path
      command +=
        summaryFormat === "csv"
          ? ` --out csv=${summaryExportPath}`
          : ` --summary-export=${summaryExportPath}`;
    }
    if (tempJsonForHtml) {
      command += ` --out json=${tempJsonForHtml}`;
    }
    await promisifiedExec(command);
    console.log(`--- [${logPrefix}] Test Run FINISHED ---`);
  } catch (error) {
    console.error(`--- [${logPrefix}] Test Run ERRORED ---`);
    throw error;
  } finally {
    if (scriptPath) {
      try {
        await fs.unlink(scriptPath);
      } catch (e) {}
    }
    if (useMockServer) {
      await mockServer.stop();
    }
  }

  if (htmlReportPath && tempJsonForHtml) {
    try {
      await fs.access(tempJsonForHtml);
      console.log(`\n--- [${logPrefix}] Generating HTML report ---`);
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

  // --- NEW: Generate Powerful Summary CSV Report ---
  if (summaryCsvPath && summaryExportPath && summaryFormat === "csv") {
    try {
      await fs.access(summaryExportPath);
      console.log(
        `\n--- [${logPrefix}] Generating Powerful Summary CSV report ---`
      );
      await generateSummaryCsv(summaryExportPath, summaryCsvPath);
    } catch (summaryError) {
      console.error(
        `${logPrefix} ❌ Failed to generate powerful summary CSV report. Error: ${summaryError instanceof Error ? summaryError.message : summaryError}`
      );
    }
  } else if (summaryCsvPath && summaryFormat !== "csv") {
    console.warn(
      `${logPrefix} ⚠️ Cannot generate Powerful Summary CSV because raw output format was not 'csv'. Please use '--summaryFormat csv'.`
    );
  } else if (summaryCsvPath && !summaryExportPath) {
    console.warn(
      `${logPrefix} ⚠️ Cannot generate Powerful Summary CSV because no raw output path was specified. Please provide the '--output' directory option.`
    );
  }

  console.log(`\n--- [${logPrefix}] Overall process complete. ---`);
}
