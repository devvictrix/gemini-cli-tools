// File: REQUIREMENT.md
# REQUIREMENT.md: Gemini Code Assistant CLI (gemini-poc) - v1.1

**Purpose:** This document defines the vision, target audience, development phases, guiding principles, and core functional requirements for the Gemini Code Assistant CLI tool (`gemini-poc`). It serves as the foundational blueprint for its development and enhancement.

**Project Vision:** To be a versatile and extensible Node.js command-line tool that leverages the Google Gemini API to perform various code enhancement, analysis, generation, and development assistance tasks, streamlining developer workflows.

**Target Audience:** Developers seeking to utilize Large Language Models (like Google Gemini) via a CLI for common code-related operations on their local projects.

**Monetization Strategy:** N/A (This is a Proof-of-Concept and developer tool).

**Project Status & Progress Tracking:**

*   **Current Focus:** Phase 5 - Refinement & DX (See Section II). Some features from earlier phases might still be refined.
*   **Detailed Feature Status:** The single source of truth for granular feature status, priority, relevant files, tests, and overall completion percentage is `REQUIREMENTS_CHECKLIST.md`.
*   **Periodic AI Context Snapshots:** To provide concise, up-to-date context for AI assistants (like Gemini) during development interactions on *this tool itself*, periodic progress snapshots can be generated using the `generate-progress-report` command.
    *   **Format:** These snapshots follow the structure defined in `PROGRESS_TEMPLATE.md`.
    *   **Naming:** Files are named `PROGRESS-{yyyy_mm_dd}.md` (e.g., `PROGRESS-2025_04_18.md`).
    *   **Purpose:** They summarize recent achievements, current focus, blockers, and key decisions based on the checklist and recent activity.
    *   **Usage:** The latest snapshot can be provided to an AI assistant along with relevant `gemini-poc` code/requirements for context-aware assistance on the tool's own development.

---

## I. Guiding Principles

*   **Modularity:** Implement features as distinct commands using the Command Pattern for easy extension.
*   **Clarity:** Maintain clear separation of concerns (CLI parsing, command handling, API service, file utilities).
*   **Extensibility:** Design for easy addition of new `EnhancementType` values and corresponding command logic.
*   **Usability:** Provide a clear and intuitive CLI interface using `yargs`, with helpful descriptions and validation.
*   **Robustness:** Handle potential errors gracefully (file system access, API errors, invalid input).
*   **Configuration:** Allow essential configuration (API Key, Model Name) via environment variables (`.env`).
*   **Safety (Development Cycle):** For commands that modify code or generate artifacts based on AI, prioritize review steps over fully automated application (e.g., `develop` command shows suggestions, `generate-tests` overwrites but warns).

---

## II. Development Phases

*(Phases represent logical groupings of functionality)*

1.  **Phase 1: Foundation & Core API Interaction (Mostly Done)**
    *   **Goal:** Establish CLI parsing, basic command structure, configuration, and core Gemini API communication.
    *   Implement CLI argument parsing (`yargs`).
    *   Set up configuration loading (`.env`, `app.config.ts`).
    *   Implement `gemini.service.ts` for basic API calls (`axios`).
    *   Implement initial commands focused on API interaction (e.g., `Analyze`, `Explain`).
    *   Basic error handling.

2.  **Phase 2: File System Interaction & Basic Output (Mostly Done)**
    *   **Goal:** Enable reading local files as input and writing results back to files or console.
    *   Implement file reading utilities (`file-io.utils.ts`).
    *   Implement file writing utilities, including directory creation (`file-io.utils.ts`).
    *   Implement file/directory scanning and filtering (`filesystem.utils.ts`, `filesystem.helper.ts`).
    *   Implement commands involving file output (e.g., `AddComments`, `GenerateDocs`, `Consolidate`).

3.  **Phase 3: Advanced Generation & Local Utilities (Mostly Done)**
    *   **Goal:** Add more sophisticated generation tasks and local file manipulation utilities.
    *   Implement architecture analysis (`AnalyzeArchitecture`).
    *   Implement module README generation (`GenerateModuleReadme`).
    *   Implement test generation (`GenerateTests`).
    *   Implement local utilities (`AddPathComment`, `InferFromData`, `GenerateStructureDoc`).

4.  **Phase 4: Development Lifecycle Integration (Mostly Done)**
    *   **Goal:** Integrate commands that assist with the development lifecycle itself, using project metadata files.
    *   Implement reading/parsing of project-specific requirement files (`REQUIREMENT.md`, `REQUIREMENTS_CHECKLIST.md`).
    *   Implement the `Develop` command to suggest implementation for the next task. ⭐
    *   Implement the `GenerateProgressReport` command based on template and checklist. ⭐

5.  **Phase 5: Refinement & Developer Experience (DX) (Current Focus)**
    *   **Goal:** Improve robustness, testability, logging, error reporting, and overall developer experience.
    *   Enhance error handling and reporting consistency.
    *   Implement comprehensive unit and potentially integration tests.
    *   Integrate a proper logging library (e.g., Pino, Winston) instead of `console.log`.
    *   Refactor prompts for better clarity and reliability.
    *   Abstract API/File System interactions behind interfaces for testability.
    *   Improve documentation within the codebase and potentially generate user guides.

---

## III. Functional Requirements (v1.1)

**(Legend: ⭐ = New/Significantly Enhanced Requirement in v1.1)**

### A. Core AI Enhancement Commands

1.  **Add Comments (`AddComments`):**
    *   **Requirement:** Read target file(s), send code to Gemini, receive commented code, overwrite original file(s) with the result.
    *   **User Expectation:** Run `gemini-poc AddComments <path>`, files in `<path>` get AI-generated comments added.

2.  **Analyze Code (`Analyze`):**
    *   **Requirement:** Read/consolidate target file(s), send code to Gemini, receive analysis text, print analysis to console.
    *   **User Expectation:** Run `gemini-poc Analyze <path>`, see code quality/structure analysis in the terminal.

3.  **Explain Code (`Explain`):**
    *   **Requirement:** Read/consolidate target file(s), send code to Gemini, receive explanation text, print explanation to console.
    *   **User Expectation:** Run `gemini-poc Explain <path>`, see a plain-language explanation of the code in the terminal.

4.  **Suggest Improvements (`SuggestImprovements`):**
    *   **Requirement:** Read/consolidate target file(s), send code to Gemini, receive improvement suggestions text, print suggestions to console.
    *   **User Expectation:** Run `gemini-poc SuggestImprovements <path>`, see actionable code improvement suggestions in the terminal.

5.  **Generate Project Docs (`GenerateDocs`):**
    *   **Requirement:** Read/consolidate target file(s), send code to Gemini, receive project README content (Markdown), write content to `README.md` in the current working directory.
    *   **User Expectation:** Run `gemini-poc GenerateDocs <path>`, a `README.md` file is created/overwritten with generated documentation.

6.  **Analyze Architecture (`AnalyzeArchitecture`):**
    *   **Requirement:** Consolidate code from target directory, send to Gemini, receive architecture analysis (Markdown), write result to a specified or default `.md` file.
    *   **User Expectation:** Run `gemini-poc AnalyzeArchitecture <path> [-o output.md]`, an architecture analysis file is created/overwritten.

7.  **Generate Module README (`GenerateModuleReadme`):**
    *   **Requirement:** Consolidate code from target module directory, send to Gemini, receive module-specific README content (Markdown), write result to `README.md` *inside* the target module directory.
    *   **User Expectation:** Run `gemini-poc GenerateModuleReadme <module-path>`, a `README.md` is created/overwritten within `<module-path>`.

8.  **Generate Tests (`GenerateTests`):**
    *   **Requirement:** Read target source file(s), send code and framework hint to Gemini, receive unit test code, write test code to a corresponding `*.test.ts` file in a mirrored structure under `./tests/`.
    *   **User Expectation:** Run `gemini-poc GenerateTests <src-path>`, corresponding test files are created/overwritten in the `./tests` directory.

### B. Development Lifecycle Commands

9.  **⭐ Develop Next Task (`Develop`):**
    *   **Requirement:** Read `REQUIREMENT.md` and `REQUIREMENTS_CHECKLIST.md` from target project path. Identify current phase and next pending task. Read relevant source files. Send task description and code context to Gemini. Display Gemini's suggested implementation code to the console for manual review and application.
    *   **User Expectation:** Run `gemini-poc Develop <project-path>`, see AI-generated code suggestions for the next task in the terminal. User manually applies changes and updates checklist.

10. **⭐ Generate Progress Report (`GenerateProgressReport`):**
    *   **Requirement:** Read `REQUIREMENT.md`, `REQUIREMENTS_CHECKLIST.md`, and `PROGRESS_TEMPLATE.md` from target project path. Parse checklist status. Fill template placeholders (date, phase, completion %, sections based on status). Write the result to `PROGRESS-{date}.md` within the target project path.
    *   **User Expectation:** Run `gemini-poc GenerateProgressReport <project-path>`, a `PROGRESS-YYYY_MM_DD.md` file is created/overwritten in `<project-path>` summarizing current progress.

### C. Local Utility Commands

11. **Add Path Comment (`AddPathComment`):**
    *   **Requirement:** Scan target path, add `// File: <relativePath>` comment header to applicable files if not already present. Operates locally.
    *   **User Expectation:** Run `gemini-poc AddPathComment <path>`, relevant files are updated with a path comment header.

12. **Consolidate Code (`Consolidate`):**
    *   **Requirement:** Scan target path, read applicable files, concatenate content with headers into `consolidated_output.txt`. Operates locally.
    *   **User Expectation:** Run `gemini-poc Consolidate <path>`, `consolidated_output.txt` is created/overwritten with combined code.

13. **Infer From Data (`InferFromData`):**
    *   **Requirement:** Read target JSON file, infer TypeScript interface structure, print the interface definition to the console. Operates locally.
    *   **User Expectation:** Run `gemini-poc InferFromData <json-path> -i InterfaceName`, see a TypeScript interface definition in the terminal.

14. **Generate Structure Doc (`GenerateStructureDoc`):**
    *   **Requirement:** Scan target directory structure (respecting exclusions and depth), generate a Markdown tree representation, write to specified or default `.md` file. Operates locally.
    *   **User Expectation:** Run `gemini-poc GenerateStructureDoc [path] [-o output.md]`, a file is created/overwritten showing the directory tree.

### D. Core Application Requirements

15. **CLI Interface:** Provide a command-line interface using `yargs` for executing commands and passing options.
16. **Configuration:** Load API key and model name from `.env` file using `dotenv`. Exit gracefully if API key is missing.
17. **Error Handling:** Catch and report errors related to file access, API communication, and argument parsing. Provide informative error messages.

---

## IV. Key Concepts & Glossary

*   **EnhancementType:** Enum defining the different commands/actions the tool can perform.
*   **Command Pattern:** Architectural pattern used to encapsulate command logic.
*   **CLI:** Command-Line Interface.
*   **yargs:** Library used for parsing CLI arguments.
*   **axios:** Library used for making HTTP requests to the Gemini API.
*   **dotenv:** Library for loading environment variables.
*   **Consolidation:** Combining content from multiple files into one.
*   **Prompt Engineering:** Crafting effective text inputs for the Gemini API to elicit desired responses.
*   **Markdown Parsing:** Interpreting the structure (like tables) within `.md` files.

---

## V. Architecture & Design Decisions

*   Modular Monolith structure (see `Project Architecture.md`).
*   Command Pattern for extensibility.
*   Layered architecture (CLI, Handler, Command, Service, Utils).
*   Use of shared utilities for file system operations.
*   Configuration via `.env`.
*   Focus on sequential processing for file modification commands to simplify state management.
*   `Develop` command prioritizes displaying suggestions over automatic application for safety.

---