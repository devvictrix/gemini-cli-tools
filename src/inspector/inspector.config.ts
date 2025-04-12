// src/inspector/inspector.config.ts

/**
 * Set of file extensions to include during inspection.
 */
export const INSPECTOR_INCLUDE_EXTENSIONS: Set<string> = new Set([
	".ts",
	".js",
	".json",
	".env",
]);

/**
 * Set of directory or file name patterns to exclude during inspection.
 */
export const INSPECTOR_EXCLUDE_PATTERNS: Set<string> = new Set([
	"node_modules",
	"dist",
	"build",
	".git",
	"coverage",
]);

/**
 * Set of specific filenames to exclude during inspection.
 */
export const INSPECTOR_EXCLUDE_FILENAMES: Set<string> = new Set([
	"package-lock.json",
	"consolidated_sources.ts",
]);