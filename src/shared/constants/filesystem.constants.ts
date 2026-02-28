// File: src/shared/constants/filesystem.constants.ts

import { env } from '../../config/app.config';

/**
 * Set of file extensions to include during inspection.
 * This set is used to filter files during directory traversal, ensuring that only files with these extensions are processed.
 * This helps focus the inspection on relevant source code and configuration files, improving efficiency.
 */
export const INCLUDE_EXTENSIONS: Set<string> = env.INCLUDE_EXTENSIONS;

/**
 * @constant {Set<string>} EXCLUDE_PATTERNS - A set of regular expressions (used internally as strings) defining files and directories to exclude.
 * This is primarily intended for broad patterns like build output directories, dependencies, or source control metadata.
 */
export const EXCLUDE_PATTERNS: Set<string> = new Set([
  // Dependency directories
  "node_modules",
  "vendor",
  
  // Build output and cache directories
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".output",
  "__pycache__",
  ".venv",
  ".mypy_cache",
  ".expo",
  ".cache",
  
  // IDE and IDE metadata
  ".vscode",
  ".idea",

  // Version control
  ".git",

  // Typical project assets/logs
  "public",
  "logs",
  "storage",
]);

/**
 * Set of specific filenames to exclude during inspection.
 * This set provides a way to exclude specific files from the inspection process, regardless of their location.
 * This can be useful for excluding configuration files, output files from previous runs, or other files that should not be processed.
 * This improves the accuracy of the analysis by preventing the inclusion of irrelevant data.
 */
export const EXCLUDE_FILENAMES: Set<string> = env.EXCLUDE_FILENAMES;

/**
 * Set of wildcard filename patterns to exclude during inspection.
 * Files matching these patterns will be skipped.
 * This supports glob-like patterns for more flexible file exclusion.
 */
export const EXCLUDE_FILENAME_WILDCARDS: Set<string> = env.EXCLUDE_FILENAME_WILDCARDS;
