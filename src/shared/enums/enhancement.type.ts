// File: src/shared/types/enhancement.type.ts

/**
 * Enum representing the different types of enhancements that can be applied to code.
 */
export enum EnhancementType {
	/**
	 * Add comments to the code.
	 */
	AddComments = 'AddComments',
	/**
	 * Analyze the code.
	 */
	Analyze = 'Analyze',
	/**
	 * Explain the code.
	 */
	Explain = 'Explain',
	/**
	 * Add path comments to the code.
	 */
	AddPathComment = 'AddPathComment',
	/**
	 * Consolidate the code.
	 */
	Consolidate = 'Consolidate',
	/**
	 * Suggest improvements to the code.
	 */
	SuggestImprovements = 'SuggestImprovements',
	/**
	 * Generate documentation for the code.
	 */
	GenerateDocs = 'GenerateDocs',
	/**
	 * Infer types or structures from provided data.
	 */
	InferFromData = 'InferFromData',
	// Add more types here later
}

/**
 * Checks if a given string is a valid EnhancementType.
 *
 * @param value The string to check.
 * @returns True if the string is a valid EnhancementType, false otherwise.
 */
export function isValidEnhancementType(value: string): value is EnhancementType {
	// Check if the provided value exists in the EnhancementType enum values.
	return Object.values(EnhancementType).includes(value as EnhancementType);
}