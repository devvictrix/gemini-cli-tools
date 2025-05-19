# gemini-poc

An AI-powered CLI assistant for (automotive) software development, featuring a Test-Driven Development workflow with Google Gemini.

## Overview

`gemini-poc` is a Node.js & TypeScript based Command Line Interface (CLI) tool designed to accelerate software development, particularly in the automotive domain, by leveraging the capabilities of Google's Gemini AI. It automates and enhances various coding, documentation, and project management tasks.

A core feature is the `Develop` command, which guides developers through an AI-assisted Test-Driven Development (TDD) cycle using a project-specific `FEATURE_ROADMAP.md`, promoting code quality and faster iteration.

## Table of Contents

- [gemini-poc](#gemini-poc)
  - [Overview](#overview)
  - [Table of Contents](#table-of-contents)
  - [Key Features](#key-features)
  - [Tech Stack](#tech-stack)
  - [Prerequisites](#prerequisites)
  - [Installation \& Setup (for developing `gemini-poc`)](#installation--setup-for-developing-gemini-poc)
  - [Configuration](#configuration)
  - [Usage (Running `gemini-poc` CLI)](#usage-running-gemini-poc-cli)
    - [General Help](#general-help)
    - [Key Command Examples](#key-command-examples)
      - [Initializing a New Project (`Init`)](#initializing-a-new-project-init)
      - [AI-Assisted TDD (`Develop`)](#ai-assisted-tdd-develop)
    - [All Commands](#all-commands)
  - [Core Concepts for the `Develop` Command](#core-concepts-for-the-develop-command)
    - [Target Project's `FEATURE_ROADMAP.md`](#target-projects-feature_roadmapmd)
    - [TDD Flow (Red-Green)](#tdd-flow-red-green)
    - [AI File Output Protocol](#ai-file-output-protocol)
  - [Development (Contributing to `gemini-poc`)](#development-contributing-to-gemini-poc)
    - [Running in Development Mode](#running-in-development-mode)
    - [Building for Production](#building-for-production)
    - [Running Tests](#running-tests)
    - [AI Collaboration Workflow](#ai-collaboration-workflow)
  - [Project Documentation](#project-documentation)
  - [Non-Goals](#non-goals)
  - [License](#license)

## Key Features

*   **AI-Assisted TDD (`Develop` command):** Orchestrates a Red-Green TDD cycle. Uses AI to generate tests from roadmap features and then implement code to pass those tests.
*   **Project Scaffolding (`Init` command):** Quickly sets up new Node.js/TypeScript projects with a standard structure, including `package.json`, `tsconfig.json`, and a `FEATURE_ROADMAP.md` ready for the `Develop` command.
*   **AI-Powered Code Intelligence:**
    *   `AddComments`: Adds TSDoc/JSDoc and inline comments.
    *   `Analyze`: Analyzes code structure and quality.
    *   `Explain`: Explains code functionality.
    *   `SuggestImprovements`: Suggests code enhancements.
    *   `GenerateTests`: Generates unit tests for existing code (distinct from TDD flow).
*   **AI-Driven Documentation:**
    *   `GenerateDocs`: Generates project-level `README.md` (for the `gemini-poc` tool itself or a target project).
    *   `GenerateModuleReadme`: Creates `README.md` for specific modules.
    *   `AnalyzeArchitecture`: Provides an AI analysis of project architecture.
*   **Local Developer Utilities:**
    *   `Consolidate`: Combines multiple source files.
    *   `AddPathComment`: Adds `// File: ...` headers.
    *   `InferFromData`: Creates TypeScript interfaces from JSON.
    *   `GenerateStructureDoc`: Generates a Markdown project directory tree.
*   **Automated Reporting:**
    *   `GenerateProgressReport`: Creates progress reports from requirement checklists (for projects using a specific structure).

## Tech Stack

*   **Language:** TypeScript
*   **Platform:** Node.js
*   **CLI Framework:** `yargs`
*   **AI Service:** Google Gemini API
*   **Configuration:** `dotenv`, `schema-env`, `zod`
*   **Testing:** Jest
*   **Formatting:** Prettier
*   **Linting:** ESLint

## Prerequisites

*   Node.js (e.g., v18+ or v20+)
*   npm (or yarn/pnpm)
*   A Google Gemini API Key

## Installation & Setup (for developing `gemini-poc`)

If you want to contribute to `gemini-poc` or run it from source:

1.  **Clone the repository:**
    ```bash
    # Replace with the actual repository URL if applicable
    git clone https://your-repository-url/gemini-poc.git
    cd gemini-poc
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

`gemini-poc` requires a Google Gemini API key to interact with the AI.

1.  **Create a `.env` file** in the root of the `gemini-poc` project:
    ```bash
    cp .env.example .env # If you have an example file
    ```
    Or create it manually.

2.  **Add your API key** to the `.env` file:
    ```env
    GEMINI_API_KEY="YOUR_API_KEY_HERE"

    # Optional: Specify a Gemini model (defaults to 'gemini-1.5-flash-latest')
    # GEMINI_MODEL_NAME="gemini-1.5-pro-latest"
    ```
    The application uses `schema-env` with `zod` for validating environment variables (see `src/config/app.config.ts`). The default model used is `gemini-1.5-flash-latest`.

## Usage (Running `gemini-poc` CLI)

From within your cloned `gemini-poc` project directory, you can run the CLI using `tsx` for development or `node` after building.

### General Help

To see all available commands and general options:
```bash
npx tsx src/index.ts --help
```
After building (see [Building for Production](#building-for-production)):
```bash
node dist/index.js --help
```

### Key Command Examples

#### Initializing a New Project (`Init`)

The `Init` command scaffolds a new Node.js/TypeScript project, preparing it for development with `gemini-poc`, especially its TDD `Develop` command.

```bash
npx tsx src/index.ts Init ./my-new-vehicle-controller --packageName=my-vehicle-controller --description="Controls vehicle systems"
```

This command will:
1.  Create a directory named `my-new-vehicle-controller`.
2.  Inside, it will generate:
    *   `package.json` (with name `my-vehicle-controller`, description, and basic scripts)
    *   `tsconfig.json` (configured for TypeScript)
    *   `.gitignore` (standard Node.js/TypeScript ignores)
    *   `src/index.ts` (placeholder entry file)
    *   `tests/index.test.ts` (placeholder test file)
    *   `docs/` directory
    *   `FEATURE_ROADMAP.md` (pre-filled with columns like `Version`, `Status`, `Priority`, `Feature Name`, `Description`, `Responsible File(s)`, `Test File Path(s)` and an initial task).

After running `Init`, navigate to your new project and install its dependencies:
```bash
cd ./my-new-vehicle-controller
npm install
```
Your new project is now ready for AI-assisted TDD using `gemini-poc Develop`.

#### AI-Assisted TDD (`Develop`)

The `Develop` command orchestrates an AI-assisted Test-Driven Development cycle for a feature defined in the target project's `FEATURE_ROADMAP.md`.

**Prerequisites for the target project:**
*   It must have a `FEATURE_ROADMAP.md` at its root (the `Init` command creates this).
*   This roadmap should have tasks defined with `Status`, `Priority`, `Feature Name`, `Description`, `Responsible File(s)`, and `Test File Path(s)`.

**To run the `Develop` command on your target project (e.g., `my-new-vehicle-controller`):**

1.  **From the `gemini-poc` project root (if developing `gemini-poc`):**
    ```bash
    # Assuming my-new-vehicle-controller is a sibling directory
    npx tsx src/index.ts Develop ../my-new-vehicle-controller
    ```

2.  **If `gemini-poc` were installed globally (hypothetical, as not set up by default):**
    ```bash
    cd ../my-new-vehicle-controller
    gemini-poc Develop .
    ```

The `Develop` command will then:
1.  Parse `../my-new-vehicle-controller/FEATURE_ROADMAP.md`.
2.  Select the highest priority task that is 'Not Started' or 'In Progress'.
3.  Prompt you (as DevLead) to confirm the task.
4.  **Red Phase:** Guide you to use AI to generate unit tests for the feature. These tests are expected to fail initially.
5.  **Green Phase:** Guide you to use AI to generate the production code in the 'Responsible File(s)' to make the tests pass.
6.  Prompt you to manually run tests and update the roadmap status.

For more details on the flow, see [ADR-001: `Develop` Command TDD Flow Design](./docs/adrs/adr-001-develop-command-tdd-flow.md).

### All Commands

Here's a list of available commands (run `npx tsx src/index.ts <command> --help` for specific options):

*   **AI-Driven Enhancements & Generation:**
    *   `AddComments <targetPath> [--prefix <p>]`: Adds AI-generated TSDoc/JSDoc and inline comments.
    *   `Analyze <targetPath> [--prefix <p>]`: Analyzes code structure and quality (outputs to console).
    *   `Explain <targetPath> [--prefix <p>]`: Explains what the code does (outputs to console).
    *   `SuggestImprovements <targetPath> [--prefix <p>]`: Suggests improvements for the code (outputs to console).
    *   `GenerateDocs <targetPath> [--prefix <p>]`: Generates Markdown documentation for the project (saves to `README.md`).
    *   `AnalyzeArchitecture <targetPath> [--output <o>] [--prefix <p>]`: Generates AI-driven architecture analysis.
    *   `GenerateModuleReadme <targetPath> [--prefix <p>]`: Generates `README.md` for a specific module directory.
    *   `GenerateTests <targetPath> [--framework <f>] [--prefix <p>]`: Generates unit tests for existing source files (based on source, not TDD from roadmap).
*   **Local Code/File Manipulations:**
    *   `AddPathComment <targetPath> [--prefix <p>]`: Adds `// File: <relativePath>` comment header to files.
    *   `Consolidate <targetPath> [--prefix <p>] [--pattern <P>]`: Consolidates code into `consolidated_output.txt`. Pattern (`-P`) overrides prefix (`-p`).
    *   `InferFromData <targetPath> --interfaceName <name>`: Infers a TypeScript interface from a JSON data file.
    *   `GenerateStructureDoc [targetPath] [--output <o>] [--descriptions] [--depth <L>] [--exclude <e>]`: Generates a Markdown project directory structure.
*   **Auto Development Flow:**
    *   `Init <targetPath> --packageName <n> [--description <d>] [--force]`: Initializes a new target project with TDD structure.
    *   `Develop <targetPath>`: Orchestrates AI-assisted TDD for the next feature from the target project's `FEATURE_ROADMAP.md`.
    *   `GenerateProgressReport <targetPath> [--output <o>]`: Generates `PROGRESS-{date}.md` based on `REQUIREMENT.md` and `REQUIREMENTS_CHECKLIST.md` in the target project.

## Core Concepts for the `Develop` Command

Understanding these concepts is key to effectively using the `Develop` command:

### Target Project's `FEATURE_ROADMAP.md`

The `Develop` command operates on a *target project* (e.g., one created by `gemini-poc Init`). This target project **must** have a `FEATURE_ROADMAP.md` file at its root. This Markdown file defines the features to be built and typically includes columns such as:

*   `Version`
*   `Status` (e.g., 'Not Started', 'TDD - Test Generation', 'TDD - Code Implementation', 'Needs Review', 'Done')
*   `Priority` (e.g., P0, P1)
*   `Feature Name`
*   `Description` (Detailed, including acceptance criteria)
*   `Responsible File(s)`: Comma-separated list of source code file paths (relative to target project root) where the feature's code will live.
*   `Test File Path(s)`: Comma-separated list of test file paths (relative to target project root) where tests for the feature will be written.

### TDD Flow (Red-Green)

The `Develop` command facilitates a semi-automated TDD cycle:

1.  **Red Phase (Test Generation):** `gemini-poc` uses the feature description and context from existing files (if any) to prompt Gemini to generate unit tests. These tests are written to the `Test File Path(s)` and are expected to *fail* initially.
2.  **Green Phase (Code Implementation):** After DevLead confirms the failing tests, `gemini-poc` uses these tests and the feature description to prompt Gemini to write the minimal production code in the `Responsible File(s)` to make the tests pass.

### AI File Output Protocol

When Gemini (instructed by `gemini-poc`) generates file content (for tests or source code), its response **must** use a specific prefix line for each file block:
`// File: path/to/your/file.ext`
The `path/to/your/file.ext` must be relative to the target project's root. `gemini-poc` parses this header to correctly save or update files in the target project.

For the complete design of the `Develop` command, refer to **[ADR-001: `Develop` Command TDD Flow Design](./docs/adrs/adr-001-develop-command-tdd-flow.md)**.

## Development (Contributing to `gemini-poc`)

`gemini-poc` itself is developed with AI collaboration in mind, where the AI (you, the LLM) acts as a "Senior Software Engineer" peer to a human "DevLead".

**Key Development Principles:**
*   **Developer Productivity & Automation First:** Prioritize features that significantly enhance developer workflows.
*   **Command Performance & Efficiency:** Ensure commands are responsive.
*   **Leverage TypeScript & Node.js Best Practices.**
*   **Maintainability & DX:** Write clean, documented (TSDoc), and testable code.
*   **Context-Driven & Scope-Aligned:** Implement features strictly based on `docs/FEATURE_ROADMAP.md` for `gemini-poc`.

### Running in Development Mode

1.  Ensure you have [installed dependencies](#installation--setup-for-developing-gemini-poc) and [configured](#configuration) your `.env` file.
2.  Use `tsx` to run TypeScript files directly:
    ```bash
    npm run dev -- <command> [args...]
    ```
    Example:
    ```bash
    npm run dev -- Analyze ./src/gemini/cli --prefix=gemini.cli
    ```
    Or, to run the `Develop` command on the example `mini-npm-package`:
    ```bash
    npm run dev -- Develop ./examples/mini-npm-package
    ```

### Building for Production

To compile TypeScript to JavaScript (output to `dist/`):
```bash
npm run build
```
You can then run the compiled version:
```bash
node dist/index.js <command> [args...]
```
The `npm start` script also runs `node dist/index.js` but doesn't directly take CLI arguments in its default form; use `node dist/index.js ...` for specific commands.

### Running Tests

`gemini-poc` uses Jest for testing.
```bash
npm test
```
See `jest.config.ts` for the Jest configuration and `tests/` directory for existing tests.

### AI Collaboration Workflow

When contributing to `gemini-poc` (especially if you are an AI):

1.  **Understand Your Role:** You are a Senior Software Engineer. Your primary goal is to help develop `gemini-poc` according to its defined scope and practices.
2.  **Primary Context:** Your actions **must** be driven by:
    *   `docs/AI_INSTRUCTIONS.md` (these guidelines)
    *   `docs/FEATURE_ROADMAP.md` (for `gemini-poc`'s own features, especially "Summary & Next Steps")
    *   `docs/FUNCTIONAL_REQUIREMENTS.md`
    *   `docs/NON_FUNCTIONAL_REQUIREMENTS.md`
    *   `docs/adrs/`
    *   Existing source code (`src/`) and configuration (`package.json`, `tsconfig.json`).
3.  **TDD Cycle for `gemini-poc` features:** Development of `gemini-poc` often follows a TDD approach. If DevLead asks you to implement a feature for `gemini-poc` itself, you might be asked to generate tests first.
4.  **File Output Protocol:** If generating code for `gemini-poc` (e.g., new command, utility), and DevLead asks for file content, use the `// File: path/to/file.ext` header format in your response.
5.  **Roadmap Updates:** For significant changes or feature completion for `gemini-poc`, the `docs/FEATURE_ROADMAP.md` (for `gemini-poc`) must be updated, including its "Summary & Next Steps" section.

## Project Documentation

Key documents outlining the design, requirements, and development process of `gemini-poc` are located in the `docs/` directory:

*   **[AI Collaboration Guidelines](./docs/AI_INSTRUCTIONS.md):** Essential rules for AI participation in this project.
*   **[Roadmap & Status (for `gemini-poc` features)](./docs/FEATURE_ROADMAP.md):** Tracks features, progress, and next steps for `gemini-poc` itself.
*   **[Project Overview](./docs/PROJECT_OVERVIEW.md):** High-level vision, goals, and context for `gemini-poc`.
*   **[Functional Requirements](./docs/FUNCTIONAL_REQUIREMENTS.md):** Defines *what* `gemini-poc` and its commands do.
*   **[Non-Functional Requirements](./docs/NON_FUNCTIONAL_REQUIREMENTS.md):** Defines *how well* `gemini-poc` should perform (quality attributes).
*   **[Architectural Decision Records (ADRs)](./docs/adrs/):** Explains the *why* behind significant technical choices (e.g., `adr-001-develop-command-tdd-flow.md`).
*   **[Status Legend](./docs/STATUS_LEGEND.md):** Definitions for status values used in roadmaps.

## Non-Goals

As outlined in the [Project Overview](./docs/PROJECT_OVERVIEW.md):

*   A Graphical User Interface (GUI).
*   Direct real-time interaction or control of vehicle hardware or embedded systems.
*   Replacing comprehensive, domain-specific automotive engineering tools (e.g., full AUTOSAR configuration suites). `gemini-poc` aims to be an *assistant*.
*   Guaranteeing compliance with automotive safety standards (e.g., ISO 26262) for AI-generated code; human oversight and formal verification remain paramount.

## License

This project is licensed under the [ISC License](./LICENSE) (assuming one will be added, as per `package.json`).
