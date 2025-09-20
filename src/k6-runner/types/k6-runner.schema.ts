// File: src/k6-runner/types/k6-runner.schema.ts

import { z } from "zod";

const safeJsonParse = (val: unknown) => {
  if (val === "") {
    return undefined;
  }
  if (typeof val === "string" && val.trim()) {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};

/**
 * Defines the canonical schema for a TestCase using Zod.
 * This is the single source of truth for validation and typing.
 */
export const TestCaseSchema = z.object({
  testName: z.string().min(1, "testName cannot be empty").optional(),
  description: z.string().optional(),
  tags: z.string().optional(),

  // REVERTED: Using a single, mandatory 'url' field.
  url: z.string().url("The provided URL is invalid"),

  method: z.enum(["GET", "POST", "PUT", "DELETE"]),

  queryParams: z.preprocess(safeJsonParse, z.record(z.any()).optional()),
  body: z.preprocess(safeJsonParse, z.record(z.any()).optional()),
  headers: z.preprocess(safeJsonParse, z.record(z.string()).optional()),

  extract: z.preprocess(safeJsonParse, z.record(z.string()).optional()),
  checks: z.preprocess(safeJsonParse, z.record(z.string()).optional()),

  thresholds: z.preprocess(
    safeJsonParse,
    z.record(z.array(z.string())).optional()
  ),
  executorOptions: z.preprocess(safeJsonParse, z.record(z.any()).optional()),
});

/**
 * The TypeScript type for a TestCase, automatically inferred from the Zod schema.
 */
export type TestCase = z.infer<typeof TestCaseSchema>;
