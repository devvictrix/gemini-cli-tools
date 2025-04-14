#!/usr/bin/env node
// src/index.ts
// Main application entry point. Delegates execution to the Gemini module's CLI.

import { runCli } from './gemini/cli/gemini.cli.js';

/**
 * Entry point for the Gemini CLI application.
 * Parses command-line arguments and executes the corresponding Gemini command.
 *
 * @param argv - An array of strings representing the command-line arguments passed to the application.
 *               Typically, this is `process.argv`.
 * @returns void - The function does not return a value directly but initiates the Gemini CLI process.
 */
runCli(process.argv); // Pass command line arguments