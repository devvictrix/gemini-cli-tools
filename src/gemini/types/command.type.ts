// File: src/gemini/types/command.type.ts

import { CliArguments } from '@shared/types/app.type';

/**
 * Interface defining the contract for a command handler.
 * Each command module should implement this execute method.
 *
 * This interface ensures that all command handlers adhere to a consistent structure,
 * facilitating easier management and invocation of different commands within the application.
 *
 * @interface ICommandHandler
 * @method execute - Executes the command with the provided arguments.
 */
export interface ICommandHandler {
    /**
     * Executes the command.
     * This is the core method that performs the action associated with the command.
     *
     * @param {CliArguments} args - The command line arguments passed to the command.
     *                              These arguments contain the information needed to execute the command,
     *                              such as input files, output directories, and other configuration options.
     * @returns {Promise<void>} - A promise that resolves when the command execution is complete.
     *                             The promise allows for asynchronous command execution,
     *                             which is crucial for handling potentially long-running tasks without blocking the main thread.
     */
    execute(args: CliArguments): Promise<void>;
}