// File: src/k6/types/k6.schema.ts

import { z } from "zod";

/**
 * A robust pre-processing helper for Zod schemas. It safely handles values from
 * data sources like CSVs where complex objects are often stored as JSON strings.
 *
 * - Returns `undefined` for empty strings, null, or undefined, allowing Zod's `.optional()` to work correctly.
 * - If the value is a string that looks like a JSON object or array, it attempts to parse it.
 * - If parsing fails, it returns the original string for further validation.
 * - For all other types, it returns the value as is.
 *
 * @param val The raw value from the data source cell.
 * @returns The parsed object, the original value, or undefined.
 */
const safeJsonParse = (val: unknown) => {
  if (val === "" || val === null || val === undefined) {
    return undefined;
  }
  if (typeof val === "string" && val.trim()) {
    try {
      if (val.trim().startsWith('{') || val.trim().startsWith('[')) {
        return JSON.parse(val);
      }
    } catch {
      // If parsing fails, return original string for other validations (e.g., if it's just a plain string)
      return val;
    }
  }
  return val;
};

/**
 * Defines the schema for a single, declarative check to be performed on an HTTP response.
 * This provides a safe alternative to using `eval()`.
 *
 * @example
 * // In CSV/XLSX (as a JSON string):
 * // "[{ \"type\": \"statusCode\", \"expected\": 200 }, { \"type\": \"jsonPathValue\", \"path\": \"user.id\", \"expected\": 123 }]"
 */
export const CheckSchema = z.object({
  /** The type of check to perform. */
  type: z.enum(["statusCode", "bodyContains", "jsonPathValue"]),
  /** The dot-notation path to a value in the JSON response body. Required only for 'jsonPathValue' checks. */
  path: z.string().optional(),
  /** The expected value for the check. For statusCode, a number. For bodyContains, a string. For jsonPathValue, any JSON-compatible value. */
  expected: z.any(),
}).refine(data => !(data.type === 'jsonPathValue' && !data.path), {
  message: "Check of type 'jsonPathValue' must have a 'path' property.",
});

/**
 * Defines the schema for a rule to extract a value from a successful (2xx) JSON response body
 * and save it as a variable for use in subsequent steps of the same scenario.
 *
 * @example
 * // In CSV/XLSX (as a JSON string):
 * // "[{ \"variable\": \"authToken\", \"path\": \"data.token\" }]"
 */
export const ExtractRuleSchema = z.object({
  /** The name of the variable to store the extracted value in (e.g., "authToken"). */
  variable: z.string().min(1, "Variable name for extraction cannot be empty."),
  /** The dot-notation JSON path to the value to extract (e.g., "data.user.id"). */
  path: z.string().min(1, "JSON path for extraction cannot be empty."),
});

/**
 * Defines the canonical schema for a single test case row from the data source.
 * This is the single source of truth for validation and typing for EVERY column.
 */
export const TestCaseSchema = z.object({
  // --- Test Case Identification & Metadata ---

  /** (Optional) A name to group multiple test steps into a single sequential scenario. All rows with the same scenario name will be executed in order by a single Virtual User. */
  scenario: z.string().min(1, "Scenario name, if provided, cannot be empty.").optional(),
  /** (Required) The name of this specific test step. Will be used in k6 group names for reporting. */
  testName: z.string().min(1, "testName is a required field and cannot be empty."),
  /** (Optional) A longer description of the test step's purpose. */
  description: z.string().optional(),

  // --- HTTP Request Details ---

  /** (Required) The full URL for the HTTP request, including protocol and hostname. Query parameters can be included here. */
  url: z.string().url("A valid URL is required for the 'url' field."),
  /** (Required) The HTTP method to use for the request. */
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  /** (Optional) A JSON object representing the request body. Must be a valid JSON string in the data source. */
  body: z.preprocess(safeJsonParse, z.record(z.any()).optional()),
  /** (Optional) A JSON object of request headers. Values must be strings. Must be a valid JSON string in the data source. */
  headers: z.preprocess(safeJsonParse, z.record(z.string()).optional()),

  // --- Test Logic & Execution ---

  /** (Optional) An array of extraction rules to capture data from the response for use in later steps of the same scenario. */
  extract: z.preprocess(safeJsonParse, z.array(ExtractRuleSchema).optional()),
  /** (Optional) An array of checks to validate the response against. */
  checks: z.preprocess(safeJsonParse, z.array(CheckSchema).optional()),

  // --- k6-Specific Configuration ---

  /** (Optional) A JSON object of tags to attach to k6 metrics for this request, useful for filtering results. */
  tags: z.preprocess(safeJsonParse, z.record(z.string()).optional()),
  /** (Optional) k6 threshold definitions that apply to this test case. Applied only on the first step of a scenario. */
  thresholds: z.preprocess(safeJsonParse, z.record(z.array(z.string())).optional()),
  /**
   * (Optional) k6 executor options for this scenario. Applied only on the first step of a scenario.
   * If omitted, defaults to a single run (1 VU, 1 iteration).
   * @example
   * // In CSV/XLSX (as a JSON string):
   * // "{ \"executor\": \"ramping-vus\", \"startVUs\": 1, \"stages\": [{ \"duration\": \"10s\", \"target\": 5 }, { \"duration\": \"5s\", \"target\": 0 }] }"
   * @see https://k6.io/docs/using-k6/scenarios/executors/
   */
  executorOptions: z.preprocess(safeJsonParse, z.record(z.any()).optional()),
});

/**
 * The TypeScript type for a TestCase, automatically inferred from the Zod schema.
 * This provides full type safety and auto-completion when working with test case objects.
 */
export type TestCase = z.infer<typeof TestCaseSchema>;