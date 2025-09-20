/**
 * Enum representing the different types of code enhancement or utility actions
 * that can be performed by the CLI tool.
 *
 * @enum {string}
 */
export enum EnhancementType {
  AddComments = "AddComments",
  Analyze = "Analyze",
  Explain = "Explain",
  SuggestImprovements = "SuggestImprovements",
  GenerateDocs = "GenerateDocs",
  AnalyzeArchitecture = "AnalyzeArchitecture",
  GenerateModuleReadme = "GenerateModuleReadme",
  GenerateTests = "GenerateTests",
  AddPathComment = "AddPathComment",
  Consolidate = "Consolidate",
  InferFromData = "InferFromData",
  GenerateStructureDoc = "GenerateStructureDoc",
  Develop = "Develop",
  GenerateProgressReport = "GenerateProgressReport",
  Init = "Init",
  RunK6 = "run-k6",
}

/**
 * Type guard function to check if a given string is a valid EnhancementType value.
 * Useful for validating command inputs or data.
 *
 *  The use of a type guard provides runtime safety, ensuring that a string
 *  passed as an enhancement type is actually a valid member of the enum.
 *
 * @param value The string value to check.
 * @returns True if the value is a valid member of the EnhancementType enum, false otherwise.
 */
export function isValidEnhancementType(
  value: string
): value is EnhancementType {
  return Object.values(EnhancementType).includes(value as EnhancementType);
}
