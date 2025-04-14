```markdown
## Module Documentation

### Overview

This project is a proof-of-concept (POC) tool using the Google Gemini API to perform various code-related tasks, such as adding comments, analyzing code, explaining code, suggesting improvements, generating documentation, consolidating code, and inferring TypeScript interfaces from JSON data. It's built with TypeScript and leverages libraries like `axios`, `dotenv`, `p-limit`, and `yargs`.

### Key Components

1.  **`package.json`**:
    *   Defines the project's metadata, dependencies, and scripts for building, running, and testing.
    *   Dependencies include `axios` for making HTTP requests to the Gemini API, `dotenv` for managing environment variables, `p-limit` for concurrency control, and `yargs` for command-line argument parsing.

2.  **`src/config/app.config.ts`**:
    *   **Purpose:** Handles application configuration, including loading environment variables and constructing the Gemini API endpoint.
    *   **Key Variables:**
        *   `GEMINI_API_KEY`:  The Gemini API key loaded from the `.env` file. The application will exit if this is not provided.
        *   `GEMINI_MODEL_NAME`: The name of the Gemini model to use. Defaults to `gemini-1.5-flash-latest` if not set in the environment.
        *   `GEMINI_API_ENDPOINT`: The full URL for the Gemini API endpoint, dynamically constructed from the base URL and model name.

3.  **`src/gemini/cli/gemini.cli.ts`**:
    *   **Purpose:**  Parses command-line arguments using `yargs` and dispatches execution to the appropriate handler.
    *   **`runCli(processArgs: string[]): Promise<void>`:**
        *   **Description:** Configures and runs the `yargs` CLI parser, defining commands, options, and logic for the Gemini CLI.
        *   **Inputs:** `processArgs`: An array of strings representing command-line arguments (usually `process.argv`).
        *   **Outputs:**  A Promise that resolves when CLI execution is complete. Exits the process with an error code if argument parsing or command execution fails.
        *   **Commands:** Defines various commands using `yargs`, corresponding to different code enhancement tasks:
            *   `AddComments`: Adds AI-generated comments to files.
            *   `Analyze`: Analyzes code structure and quality.
            *   `Explain`: Explains what the code does.
            *   `AddPathComment`: Adds a "// File: <relativePath>" comment header to files.
            *   `Consolidate`: Consolidates code into a single output file.
            *   `SuggestImprovements`: Suggests improvements for the code.
            *   `GenerateDocs`: Generates Markdown documentation (saves to README.md).
            *   `InferFromData`: Infers a TypeScript interface from a JSON data file. Requires an `interfaceName` option.

4.  **`src/gemini/cli/gemini.handler.ts`**:
    *   **Purpose:** Contains the core application logic for processing files and interacting with the Gemini API.
    *   **`runCommandLogic(argv: CliArguments): Promise<void>`:**
        *   **Description:** Parses arguments, identifies target files, and executes the requested action (local or via Gemini API).
        *   **Inputs:** `argv`: The parsed arguments object from `yargs` (`CliArguments` interface).
        *   **Outputs:** A Promise that resolves when the command logic is complete.
        *   **Functionality:**
            *   Validates the target path.
            *   Identifies target files based on whether the path is a file or a directory, considering file extensions and exclusion patterns.
            *   Handles different actions: modification actions (e.g., `AddComments`), Gemini API actions (e.g., `Analyze`, `Explain`), and local processing actions (e.g., `Consolidate`, `InferFromData`).
            *   Uses `p-limit` to control concurrency for file modification actions.
            *   Calls `enhanceCodeWithGemini` to interact with the Gemini API.
            *   Writes output to files or the console.

5.  **`src/gemini/gemini.service.ts`**:
    *   **Purpose:** Handles communication with the Google Gemini API.
    *   **`enhanceCodeWithGemini(enhancementType: EnhancementType, code: string): Promise<GeminiEnhancementResult>`:**
        *   **Description:** Enhances code using the Gemini API based on the specified `enhancementType`.
        *   **Inputs:**
            *   `enhancementType`: The type of enhancement to apply (e.g., `AddComments`, `Analyze`).
            *   `code`: The code to be enhanced.
        *   **Outputs:**  A Promise that resolves with a `GeminiEnhancementResult` object, indicating the success or failure of the operation and providing the enhanced code or error message.
        *   **Functionality:**
            *   Generates a prompt for the Gemini API using `generatePrompt()`.
            *   Calls the Gemini API using `callGeminiApi()`.
            *   Extracts the relevant content from the API response (code or text).
            *   Returns a `GeminiEnhancementResult` with the extracted content or an error message.
    *   **`callGeminiApi(promptText: string): Promise<string | null>`:**
        *   **Description:** Calls the Gemini API with the given prompt.
        *   **Inputs:** `promptText`: The prompt text to send to the Gemini API.
        *   **Outputs:** A Promise that resolves with the response text, or `null` if an error occurred.

6.  **`src/index.ts`**:
    *   The main entry point of the application.
    *   Calls `runCli` to start the command-line interface and process user input.

7.  **`src/shared/constants/filesystem.constants.ts`**:
    *   Defines constants related to file system operations.
    *   `INCLUDE_EXTENSIONS`: A set of file extensions to include during inspection (e.g., `.ts`, `.js`).
    *   `EXCLUDE_PATTERNS`: A set of directory or file name patterns to exclude during inspection (e.g., `node_modules`, `dist`).
    *   `EXCLUDE_FILENAMES`: A set of specific filenames to exclude during inspection (e.g., `package-lock.json`, `README.md`).

8.  **`src/shared/enums/enhancement.type.ts`**:
    *   Defines the `EnhancementType` enum, which represents the different types of enhancements that can be applied to code.  Values include `AddComments`, `Analyze`, `Explain`, `AddPathComment`, `Consolidate`, `SuggestImprovements`, `GenerateDocs`, and `InferFromData`.

9.  **`src/shared/helpers/filesystem.helper.ts`**:
    *   **Purpose:**  Provides helper functions for file system operations.
    *   **`getAllFiles(dir: string, excludePatterns: Set<string>, excludeFilenames: Set<string>): Promise<string[]>`:** Recursively traverses a directory and returns all file paths, respecting exclusion patterns.
    *   **`filterLines(lines: string[], friendlyPath: string): string[]`:** Removes leading blank lines and specific comment markers, filters duplicate consecutive lines.

10. **`src/shared/helpers/type-inference.helper.ts`**:
    *   **Purpose:** Provides functionality to infer TypeScript interface definitions from data, typically JSON.
    *   **`inferTypesFromData(interfaceName: string, data: any): string`:**
        *   **Description:**  Infers a TypeScript interface from sample data (object or array of objects).
        *   **Inputs:**
            *   `interfaceName`: The desired name for the root TypeScript interface.
            *   `data`: The sample data to analyze.
        *   **Outputs:**  A formatted string representing the generated TypeScript interface.
        *   **Throws:** An error if the input data is not a single object or an array of objects.

11. **`src/shared/types/app.type.ts`**:
    *   Defines TypeScript interfaces for application-specific data structures.
    *   `CliArguments`: Represents the command-line arguments passed to the application.
    *   `FileProcessingResult`: Represents the result of processing a single file.

12. **`src/shared/utils/file-io.utils.ts`**:
    *   **Purpose:** Provides utility functions for file input/output operations.
    *   **`readSingleFile(filePath: string): string`:** Reads the content of a single file synchronously.
    *   **`updateFileContent(filePath: string, newContent: string): boolean`:** Updates the content of a file synchronously. Creates parent directory if needed.
    *   **`writeOutputFile(outputFilePath: string, content: string): boolean`:** Writes content to a specified output file. Creates parent directory if needed.

13. **`src/shared/utils/filesystem.utils.ts`**:
    *   **Purpose:** Provides utility functions for file system operations specific to this application.
    *   **`getTargetFiles(rootDir: string, filePrefix?: string): Promise<string[]>`:** Finds all relevant source files within a directory based on include extensions, exclude patterns and an optional file prefix.
    *   **`getConsolidatedSources(rootDir: string, filePrefix?: string): Promise<string>`:** Consolidates source files from a directory into a single string, adding headers and removing duplicates.

### Usage Examples (CLI)

**Add comments to all TypeScript files in the `src` directory:**

```bash
node dist/index.js AddComments src
```

**Analyze the code in a specific file:**

```bash
node dist/index.js Analyze src/index.ts
```

**Explain the code in the `app.config.ts` file:**

```bash
node dist/index.js Explain src/config/app.config.ts
```

**Generate documentation for all files in the `src` directory:**

```bash
node dist/index.js GenerateDocs src
```

**Consolidate all `.ts` files in the `src` directory into a single output file:**

```bash
node dist/index.js Consolidate src
```

**Infer a TypeScript interface from a JSON file:**

```bash
node dist/index.js InferFromData data.json -i MyDataInterface
```

### Inputs/Outputs

*   **CLI Commands:**  Each CLI command takes a `targetPath` as input, specifying the file or directory to process.  Some commands accept optional parameters like `prefix` (for filtering files in a directory) and `interfaceName` (for the `InferFromData` command).
*   **`enhanceCodeWithGemini` function:** Takes an `EnhancementType` and `code` string as input and returns a `Promise<GeminiEnhancementResult>`. The `GeminiEnhancementResult` contains either the enhanced code/text or an error message.
*   **`inferTypesFromData` function:** Takes an `interfaceName` string and a `data` object (or array of objects) as input and returns a string representing the inferred TypeScript interface.