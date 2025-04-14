#!/usr/bin/env node
// src/index.ts
// Main application entry point. Delegates execution to the Gemini module's CLI.

import { runCli } from './gemini/cli/gemini.cli.js';

// Immediately run the CLI setup and parsing
runCli(process.argv); // Pass command line arguments