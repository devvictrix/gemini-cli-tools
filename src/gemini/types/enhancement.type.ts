/**
 * Enum representing the different types of code enhancement or utility actions
 * that can be performed by the CLI tool.
 *
 * @enum {string}
 */
export enum EnhancementType {
	// --- AI-Driven Enhancements ---
	/** Add TSDoc/JSDoc and inline comments to the code.
	 *
	 *  This helps improve code readability and maintainability by providing
	 *  automatic documentation and explanations of code logic.
	 */
	AddComments = 'AddComments',
	/** Provide a high-level analysis of code structure and quality.
	 *
	 * This allows developers to quickly assess the overall health and organization
	 * of their codebase, identifying potential areas for improvement.
	 */
	Analyze = 'Analyze',
	/** Explain what the code does in simple terms.
	 *
	 *  This is useful for onboarding new team members or for quickly understanding
	 *  unfamiliar code. It translates complex code into plain language.
	 */
	Explain = 'Explain',
	/** Suggest specific, actionable improvements for the code.
	 *
	 *  This leverages AI to identify potential bugs, performance bottlenecks,
	 *  and style issues, offering concrete solutions to address them.
	 */
	SuggestImprovements = 'SuggestImprovements',
	/** Generate Markdown documentation (e.g., for project root README).
	 *
	 *  This automates the creation of project documentation, making it easier to
	 *  keep documentation up-to-date and accessible to users.
	 */
	GenerateDocs = 'GenerateDocs',
	/** Provide an AI-driven analysis of the project's architecture.
	 *
	 * This feature helps to understand the relationships between different parts
	 * of the project and identify potential architectural weaknesses.
	 */
	AnalyzeArchitecture = 'AnalyzeArchitecture',
	/** Generate a README.md file within a specific module directory.
	 *
	 * This creates module-specific documentation, detailing the purpose, usage, and
	 * dependencies of individual modules within the project.
	 */
	GenerateModuleReadme = 'GenerateModuleReadme',
	/** Generate unit tests for a specific file or module.
	 *
	 *  This feature enhances code reliability and maintainability by automatically
	 *  creating unit tests, reducing the risk of introducing regressions.
	 */
	GenerateTests = 'GenerateTests',

	// --- Local Code/File Manipulations ---
	/** Add a '// File: <relativePath>' comment header to files (Local Action).
	 *
	 *  This adds a comment at the top of each file indicating its relative path
	 *  within the project, aiding in file navigation and organization.  This is a local action that does not involve an external API.
	 */
	AddPathComment = 'AddPathComment',
	/** Consolidate multiple source files into a single output file (Local Action).
	 *
	 *  This combines several source files into a single file, which can be useful
	 *  for reducing the number of files in a project or for creating a single,
	 *  self-contained distribution. This is a local action that does not involve an external API.
	 */
	Consolidate = 'Consolidate',
	/** Infer TypeScript interface from a JSON data file (Local Action).
	 *
	 *  This automatically generates a TypeScript interface based on the structure
	 *  of a JSON data file, making it easier to work with JSON data in a type-safe
	 *  manner. This is a local action that does not involve an external API.
	 */
	InferFromData = 'InferFromData',
	/** Generate a Markdown file representing the project directory structure (Local Action).
	 *
	 *  This creates a Markdown document that visually represents the project's
	 *  directory structure, making it easier to understand the organization of
	 *  the codebase.  This is a local action that does not involve an external API.
	 */
	GenerateStructureDoc = 'GenerateStructureDoc',

    /**
     * Orchestrates AI-assisted TDD: selects task from FEATURE_ROADMAP.md,
     * AI generates tests, AI generates code to pass tests.
     */
	Develop = 'Develop',
    /**
     * Generates a PROGRESS-{date}.md file based on current project
     * REQUIREMENT.md and REQUIREMENTS_CHECKLIST.md.
     */
	GenerateProgressReport = 'GenerateProgressReport',
    /**
     * Initializes a new target project directory with basic structure and files
     * suitable for use with gemini-poc.
     */
    Init = 'Init',

	// Add more types here in the future
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
export function isValidEnhancementType(value: string): value is EnhancementType {
	// Check if the value exists in the EnhancementType enum values
	return Object.values(EnhancementType).includes(value as EnhancementType);
}