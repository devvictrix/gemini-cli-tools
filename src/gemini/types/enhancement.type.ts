/**
 * Enum representing the different types of code enhancement or utility actions
 * that can be performed by the CLI tool.
 *
 * @enum {string}
 */
export enum ENHANCEMENT_TYPES {
  REVIEW = "review",
  DOCUMENT = "document",
  CONSOLIDATE = "consolidate",
  GENERATE_TESTS = "generate-tests",
  DEVELOP = "Develop",
  GENERATE_PROGRESS_REPORT = "GenerateProgressReport",
  INIT = "Init",
}

/**
 * Type guard function to check if a given string is a valid ENHANCEMENT_TYPES value.
 * Useful for validating command inputs or data.
 *
 *  The use of a type guard provides runtime safety, ensuring that a string
 *  passed as an enhancement type is actually a valid member of the enum.
 *
 * @param value The string value to check.
 * @returns True if the value is a valid member of the ENHANCEMENT_TYPES enum, false otherwise.
 */
export function isValidEnhancementType(
  value: string
): value is ENHANCEMENT_TYPES {
  return Object.values(ENHANCEMENT_TYPES).includes(value as ENHANCEMENT_TYPES);
}
