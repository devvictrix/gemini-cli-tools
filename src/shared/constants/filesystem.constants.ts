// File: src/shared/constants/filesystem.constants.ts

/**
 * Set of file extensions to include during inspection.
 * This set is used to filter files during directory traversal, ensuring that only files with these extensions are processed.
 * This helps focus the inspection on relevant source code and configuration files, improving efficiency.
 */
export const INCLUDE_EXTENSIONS: Set<string> = new Set([
    ".ts",
    ".js",
    ".json",
    ".env",
    ".yml",
    ".md",
    ".tsx",
]);

/**
 * Set of directory or file name patterns to exclude during inspection.
 * During directory traversal, any directory or file name matching these patterns will be skipped.
 * This helps to avoid processing unnecessary or irrelevant files such as dependencies, build artifacts, and version control metadata.
 * Excluding these patterns significantly reduces processing time and prevents potential errors.
 */
export const EXCLUDE_PATTERNS: Set<string> = new Set([
    "node_modules", // Exclude dependency directories as they are usually irrelevant for source code analysis.
    "dist", // Exclude distribution directories containing compiled/transpiled code.
    "build", // Exclude build directories containing compiled/transpiled code.
    ".git", // Exclude the Git repository directory, as it contains version control metadata.
    "coverage", // Exclude code coverage directories, as they are not part of the source code.
    ".nuxt",
    ".vscode",
    "public",
]);

/**
 * Set of specific filenames to exclude during inspection.
 * This set provides a way to exclude specific files from the inspection process, regardless of their location.
 * This can be useful for excluding configuration files, output files from previous runs, or other files that should not be processed.
 * This improves the accuracy of the analysis by preventing the inclusion of irrelevant data.
 */
export const EXCLUDE_FILENAMES: Set<string> = new Set([
    "package-lock.json", // Exclude the package-lock.json file, as it is not part of the source code.
    "consolidated_sources.ts", // Exclude potential consolidation output if run in src, to prevent analysis of generated code.
    "consolidated_output.txt", // Exclude consolidation output, which is the result of a previous analysis.
    "code.extractor.ts", // Exclude utility if present, to avoid analyzing the extraction tool itself.
    "README.md", // Exclude generated docs, as they are not source code.
    "docs.md", // Exclude previously generated docs just in case, to avoid redundant processing.
]);