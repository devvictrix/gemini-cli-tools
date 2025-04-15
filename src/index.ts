// File: src/index.ts

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

// TODO: Consider adding error handling here. If `runCli` could potentially throw an error,
//       it would be good to catch it and log it to the console (or handle it in a more sophisticated way).
//       Example:
//       try {
//           runCli(process.argv);
//       } catch (error) {
//           console.error("An error occurred while running the Gemini CLI:", error);
//           process.exit(1); // Exit with a non-zero code to indicate an error.
//       }

// TODO: Add logging for successful execution.  This could be as simple as logging
//       when the CLI completes successfully, or logging the specific command that was executed.
//       Example:
//       runCli(process.argv).then(() => {
//           console.log("Gemini CLI completed successfully.");
//       });

// TODO:  Investigate if `runCli` returns a Promise. If it does, we should handle the promise correctly,
//        using `.then` and `.catch` for successful and error conditions respectively. This ensures
//        that unhandled promise rejections don't occur. The `TODO` above related to error handling
//        and successful execution would be best handled this way if `runCli` returns a Promise.

// TODO: Add more detailed JSDoc comments to clarify what the `runCli` function *does*.
//       While the current comment explains what the file does, adding more specific documentation
//       about the responsibilities of `runCli` (beyond just that it parses args and executes a command)
//       would be beneficial.  For example, what are the expected command-line arguments?
//       What are the possible errors that could occur?

// TODO: Consider adding a version flag or command. This would allow users to easily determine
//       the version of the Gemini CLI they are using.