// src/inspector/inspector.config.ts

// Define which file extensions the inspector should include
export const INSPECTOR_INCLUDE_EXTENSIONS: Set<string> = new Set([
    ".ts",
    ".js",
    ".json",
    ".env",
    // Add other relevant extensions if needed (e.g., .md, .yaml)
]);

// Define patterns/directories the inspector should exclude
export const INSPECTOR_EXCLUDE_PATTERNS: Set<string> = new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    "coverage",
    "package-lock.json",
    // Maybe exclude the output file itself if it lives within the project root?
    // "consolidated_sources.ts",
    // Add other patterns like test directories if desired
    // "__tests__",
]);

// Define specific file names to always exclude
export const INSPECTOR_EXCLUDE_FILENAMES: Set<string> = new Set([
    "package-lock.json",
    // Add other specific files if needed
]);