```markdown
# commands Module

## Purpose/Responsibility

The `commands` module acts as a collection of command handlers for the Gemini CLI application. It's responsible for receiving parsed command-line arguments, delegating to specific command implementations (e.g., `add-comments`, `analyze`, `generate-docs`), and handling potential errors during command execution. Each command implementation leverages the Gemini AI service for code enhancement and analysis.

## Key Components/Features

*   **`add-comments.command.ts`:** Adds AI-generated comments to files.
*   **`add-path-comment.command.ts`:** Adds a "// File: <relativePath>" comment header to files.
*   **`analyze.command.ts`:** Analyzes code structure and quality using the Gemini AI service. Outputs the analysis to the console.
*   **`consolidate.command.ts`:** Consolidates code from a target directory into a single output file (`consolidated_output.txt`).
*   **`explain.command.ts`:** Explains what the code does using the Gemini AI service. Outputs the explanation to the console.
*   **`generate-docs.command.ts`:** Generates Markdown documentation for the project using the Gemini AI service. Saves the documentation to `README.md`.
*   **`generate-structure-doc.command.ts`:** Generates a Markdown file representing the project directory structure.
*   **`infer-from-data.command.ts`:** Infers a TypeScript interface from a JSON data file. Outputs the inferred interface to the console.
*   **`suggest-improvements.command.ts`:** Suggests improvements for the code using the Gemini AI service. Outputs the suggestions to the console.
*   **`analyze-architecture.command.ts`:** Generates an AI-driven analysis of the project architecture. Saves the analysis to a Markdown file (default: `AI_Architecture_Analyzed.md`).
*   **`generate-module-readme.command.ts`:** Generates a README.md for a specific module directory using AI.
*   **`ICommandHandler` interface:** Defines the structure all command handlers must adhere to with an `execute` method.

## Public API/Usage

Other modules interact with the `commands` module indirectly through the `runCommandLogic` function in `cli/gemini.handler.ts`. This function maps the command name (from `EnhancementType`) to the corresponding command handler's `execute` method. Each handler's `execute` function accepts a `CliArguments` object containing the command name, target path, and any additional command-specific options.

Example:

```typescript
// From cli/gemini.handler.ts:
import * as addCommentsCmd from '../commands/add-comments.command.js';

// ...

const commandHandlerMap: { [key in EnhancementType]: (args: CliArguments) => Promise<void> } = {
    [EnhancementType.AddComments]: addCommentsCmd.execute,
    // ... other commands
};
```

Each command handler (e.g., `addCommentsCmd`) exports an `execute` function that can be called with a `CliArguments` object.

## Dependencies

*   `axios`: For making requests to the Gemini AI service.
*   `fs`: For file system operations (reading, writing, and checking file/directory existence).
*   `path`: For manipulating file paths.
*   `p-limit`: For limiting concurrency in file processing (used in `add-comments.command.ts`).
*   Internal modules:
    *   `../gemini.service.ts`: Communicates with the Gemini AI service.
    *   `../../shared/utils/filesystem.utils.ts`: Provides utility functions for file system operations.
    *   `../../shared/utils/file-io.utils.ts`: Provides utility functions for file I/O operations.
    *   `../../shared/enums/enhancement.type.ts`: Defines the available enhancement types.
    *   `../../shared/helpers/type-inference.helper.ts`: Utility to infer types.

## Configuration

The module relies on the following configuration variables, defined in `config/app.config.js`:

*   `GEMINI_API_ENDPOINT`: The endpoint URL for the Gemini AI service.
*   `GEMINI_API_KEY`: The API key for authenticating with the Gemini AI service.
*   `GEMINI_MODEL_NAME`: The name of the Gemini model to use.
```