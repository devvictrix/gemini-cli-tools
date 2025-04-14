// src/shared/enums/enhancement.type.ts

/**
 * Enum representing the different types of code enhancement actions
 * that can be performed, primarily using the Gemini API.
 */
export enum EnhancementType {
	/** Add TSDoc/JSDoc and inline comments to the code. */
	AddComments = 'AddComments',
	/** Provide a high-level analysis of code structure and quality. */
	Analyze = 'Analyze',
	/** Explain what the code does in simple terms. */
	Explain = 'Explain',
	/** Add a '// File: <relativePath>' comment header to files (Local Action). */
	AddPathComment = 'AddPathComment',
	/** Consolidate multiple source files into a single output file (Local Action). */
	Consolidate = 'Consolidate',
	/** Suggest specific, actionable improvements for the code. */
	SuggestImprovements = 'SuggestImprovements',
	/** Generate Markdown documentation (e.g., for README). */
	GenerateDocs = 'GenerateDocs',
	/** Infer TypeScript interface from a JSON data file (Local Action). */
	InferFromData = 'InferFromData',
	// Add more enhancement types here in the future (e.g., GenerateTests, Refactor)
}

/**
 * Type guard function to check if a given string is a valid EnhancementType value.
 * Useful for validating command inputs or data.
 *
 * @param value The string value to check.
 * @returns True if the value is a valid member of the EnhancementType enum, false otherwise.
 */
export function isValidEnhancementType(value: string): value is EnhancementType {
	// Check if the provided value exists within the array of enum values.
	return Object.values(EnhancementType).includes(value as EnhancementType);
}