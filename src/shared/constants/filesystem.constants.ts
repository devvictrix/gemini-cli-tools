// File: src/shared/constants/filesystem.constants.ts

// File: src/shared/constants/filesystem.constants.ts // New Path

/**
 * Set of file extensions to include during inspection.
 */
export const INCLUDE_EXTENSIONS: Set<string> = new Set([
    ".ts",
    ".js",
    ".json",
    ".env",
]);

/**
 * Set of directory or file name patterns to exclude during inspection.
 */
export const EXCLUDE_PATTERNS: Set<string> = new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    "coverage",
]);

/**
 * Set of specific filenames to exclude during inspection.
 */
export const EXCLUDE_FILENAMES: Set<string> = new Set([
    "package-lock.json",
    "consolidated_sources.ts", // Exclude potential consolidation output if run in src
    "consolidated_output.txt", // Exclude consolidation output
    "code.extractor.ts", // Exclude utility if present
    "README.md", // Exclude generated docs
    "docs.md", // Exclude previously generated docs just in case
]);