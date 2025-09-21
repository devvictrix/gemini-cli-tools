import * as fs from "fs/promises";
import * as path from "path";
import * as xlsx from "xlsx";
import papaparse from "papaparse";
import { TestCase, TestCaseSchema } from "@/k6/types/k6.schema";

const logPrefix = "[DataSourceParser]";

/**
 * Parses and VALIDATES a data source file (XLSX or CSV) into an array of TestCase objects.
 * This has been upgraded to use the robust Papaparse library for CSV handling and dynamic typing.
 *
 * @param filePath - The absolute path to the data file.
 * @returns A promise that resolves to a validated array of TestCase objects.
 * @throws An error if the file type is unsupported or if any record fails Zod validation.
 */
export async function parseDataSourceFile(
  filePath: string
): Promise<TestCase[]> {
  console.log(`${logPrefix} Parsing data from: ${filePath}`);
  const extension = path.extname(filePath).toLowerCase();
  let records: unknown[];

  if (extension === ".xlsx") {
    const fileContent = await fs.readFile(filePath);
    const workbook = xlsx.read(fileContent, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rawJson = xlsx.utils.sheet_to_json<Record<string, any>>(
      workbook.Sheets[sheetName]
    );

    records = rawJson.map((row) => {
      const newRow: { [key: string]: any } = {};
      for (const key in row) {
        const value = row[key];
        if (
          typeof value === "string" &&
          (value.trim().startsWith("{") || value.trim().startsWith("["))
        ) {
          try {
            newRow[key] = JSON.parse(value);
          } catch {
            newRow[key] = value;
          }
        } else {
          newRow[key] = value;
        }
      }
      return newRow;
    });
  } else if (extension === ".csv") {
    const fileContent = await fs.readFile(filePath, "utf-8");
    const parseResult = papaparse.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    if (parseResult.errors.length > 0) {
      console.error(
        `${logPrefix} Errors encountered during CSV parsing:`,
        parseResult.errors
      );
      throw new Error(
        `Failed to parse CSV file: ${parseResult.errors[0].message}`
      );
    }
    records = parseResult.data;
  } else {
    throw new Error(`Unsupported data source file type: ${extension}`);
  }

  return records
    .map((record, index) => {
      if (
        record === null ||
        typeof record !== "object" ||
        Object.keys(record).length === 0
      ) {
        return null;
      }
      const hasValues = Object.values(record).some(
        (val) => val !== null && val !== ""
      );
      if (!hasValues) {
        return null;
      }

      const validationResult = TestCaseSchema.safeParse(record);

      if (validationResult.success) {
        return validationResult.data;
      } else {
        const errorDetails = validationResult.error.errors
          .map((e) => `Field '${e.path.join(".")}': ${e.message}`)
          .join(" | ");
        throw new Error(
          `Validation failed for data row ${index + 2}: ${errorDetails}`
        );
      }
    })
    .filter((item): item is TestCase => item !== null);
}
