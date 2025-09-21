// File: src/k6-runner/parsers/dataSource.parser.ts

import * as fs from "fs/promises";
import * as path from "path";
import * as xlsx from "xlsx";
import { parse as parseCsv } from "csv-parse/sync";
import { TestCase, TestCaseSchema } from "@/k6/types/k6.schema";

const logPrefix = "[DataSourceParser]";

/**
 * Parses and VALIDATES a data source file (XLSX or CSV) into an array of TestCase objects.
 * This parser is specific to the k6-runner's domain.
 * @param filePath - The absolute path to the data file.
 * @returns A promise that resolves to a validated array of TestCase objects.
 * @throws An error if the file type is unsupported or if any record fails validation.
 */
export async function parseDataSourceFile(
  filePath: string
): Promise<TestCase[]> {
  console.log(`${logPrefix} Parsing data from: ${filePath}`);
  const extension = path.extname(filePath).toLowerCase();
  const fileContent = await fs.readFile(filePath);
  let records: unknown[];

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

  // Use Zod to validate and transform each record.
  return records.map((record, index) => {
    const validationResult = TestCaseSchema.safeParse(record);

    if (validationResult.success) {
      return validationResult.data;
    } else {
      const errorDetails = validationResult.error.errors
        .map((e) => `Field '${e.path.join(".")}': ${e.message}`)
        .join(", ");
      throw new Error(
        `Validation failed for record at row ${index + 2}: ${errorDetails}`
      );
    }
  });
}
