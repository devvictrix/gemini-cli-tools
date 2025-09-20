// File: src/k6-runner/types/k6-runner.type.ts

/**
 * Represents a single, data-driven test case to be executed by k6.
 * This is the core domain entity for the k6-runner tool.
 */
export interface TestCase {
  testName: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  queryParams?: Record<string, any>;
  body?: Record<string, any>;
  thresholds: Record<string, string[]>;
}
