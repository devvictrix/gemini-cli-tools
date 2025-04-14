// File: src/shared/constants/filesystem.constants.ts

/**
 * Set of file extensions to include during inspection.
 * This set is used to filter files during directory traversal, ensuring that only files with these extensions are processed.
 */
export const INCLUDE_EXTENSIONS: Set<string> = new Set([
    ".ts",
    ".js",
    ".json",
    ".env",
]);

/**
 * Set of directory or file name patterns to exclude during inspection.
 * During directory traversal, any directory or file name matching these patterns will be skipped.
 * This helps to avoid processing unnecessary or irrelevant files.
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
 * This set provides a way to exclude specific files from the inspection process, regardless of their location.
 * This can be useful for excluding configuration files or other files that should not be processed.
 */
export const EXCLUDE_FILENAMES: Set<string> = new Set([
    "package-lock.json",
    "consolidated_sources.ts", // Exclude potential consolidation output if run in src
    "consolidated_output.txt", // Exclude consolidation output
    "code.extractor.ts", // Exclude utility if present
    "README.md", // Exclude generated docs
    "docs.md", // Exclude previously generated docs just in case
]);