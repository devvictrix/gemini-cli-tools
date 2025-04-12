// src/inspector/inspector.config.ts

// Includes common source files
export const INSPECTOR_INCLUDE_EXTENSIONS: Set<string> = new Set([
	".ts",
	".js",
	".json",
	".env",
]);

// Excludes common build artifacts, dependencies, and Git data
export const INSPECTOR_EXCLUDE_PATTERNS: Set<string> = new Set([
	"node_modules",
	"dist",
	"build",
	".git",
	"coverage",
]);

// Excludes specific common lock files or potentially large config files
export const INSPECTOR_EXCLUDE_FILENAMES: Set<string> = new Set([
	"package-lock.json",
	"consolidated_sources.ts",
]);
