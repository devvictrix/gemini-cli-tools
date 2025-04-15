// File: src/shared/enums/enhancement.type.ts
// Status: Updated

/**
 * Enum representing the different types of code enhancement or utility actions
 * that can be performed by the CLI tool.
 */
export enum EnhancementType {
	// --- AI-Driven Enhancements ---
	/** Add TSDoc/JSDoc and inline comments to the code. */
	AddComments = 'AddComments',
	/** Provide a high-level analysis of code structure and quality. */
	Analyze = 'Analyze',
	/** Explain what the code does in simple terms. */
	Explain = 'Explain',
	/** Suggest specific, actionable improvements for the code. */
	SuggestImprovements = 'SuggestImprovements',
	/** Generate Markdown documentation (e.g., for project root README). */
	GenerateDocs = 'GenerateDocs',
	/** Provide an AI-driven analysis of the project's architecture. */
	AnalyzeArchitecture = 'AnalyzeArchitecture',
	/** Generate a README.md file within a specific module directory. */
	GenerateModuleReadme = 'GenerateModuleReadme', // <<< Added Here
	// DescribeComponent = 'DescribeComponent', // Deferred

	// --- Local Code/File Manipulations ---
	/** Add a '// File: <relativePath>' comment header to files (Local Action). */
	AddPathComment = 'AddPathComment',
	/** Consolidate multiple source files into a single output file (Local Action). */
	Consolidate = 'Consolidate',
	/** Infer TypeScript interface from a JSON data file (Local Action). */
	InferFromData = 'InferFromData',
	/** Generate a Markdown file representing the project directory structure (Local Action). */
	GenerateStructureDoc = 'GenerateStructureDoc',

	// Add more types here in the future (e.g., GenerateTests, Refactor)
}

/**
 * Type guard function to check if a given string is a valid EnhancementType value.
 * Useful for validating command inputs or data.
 *
 * @param value The string value to check.
 * @returns True if the value is a valid member of the EnhancementType enum, false otherwise.
 */
export function isValidEnhancementType(value: string): value is EnhancementType {
	return Object.values(EnhancementType).includes(value as EnhancementType);
}