// File: src/shared/parsers/dataSource.parser.ts

import * as fs from "fs/promises";
import * as path from "path";
import * as xlsx from "xlsx";
import { parse as parseCsv } from "csv-parse/sync";
import { TestCase } from "@/k6-runner/types/k6-runner.type";

const logPrefix = "[DataSourceParser]";

/**
 * Parses a data source file (XLSX or CSV) into a structured array of objects.
 * This is a generic utility that can be reused across different modules.
 * @param filePath - The absolute path to the data file.
 * @returns A promise that resolves to an array of TestCase objects.
 * @throws An error if the file type is unsupported or if a record is malformed.
 */
export async function parseDataSourceFile(
  filePath: string
): Promise<TestCase[]> {
  console.log(`${logPrefix} Parsing data from: ${filePath}`);
  const extension = path.extname(filePath).toLowerCase();
  const fileContent = await fs.readFile(filePath);

  let records: any[];

  if (extension === ".xlsx") {
    const workbook = xlsx.read(fileContent, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    records = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  } else if (extension === ".csv") {
    records = parseCsv(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });
  } else {
    throw new Error(`Unsupported data source file type: ${extension}`);
  }

  // Transform raw records into strongly-typed TestCase objects
  return records.map((record, index) => {
    try {
      // Validate required fields
      if (!record.method || !record.url) {
        throw new Error(`Missing required 'method' or 'url' field.`);
      }

      return {
        testName: record.testName || `Test Case #${index + 1}`,
        method: record.method.toUpperCase(),
        url: record.url,
        queryParams: record.queryParams
          ? JSON.parse(record.queryParams)
          : undefined,
        body: record.body ? JSON.parse(record.body) : undefined,
        thresholds: record.thresholds
          ? JSON.parse(record.thresholds)
          : { http_req_failed: ["rate<0.01"] },
      };
    } catch (e) {
      throw new Error(
        `Error parsing record at row ${index + 2}: ${e instanceof Error ? e.message : "Unknown error"}`
      );
    }
  });
}
