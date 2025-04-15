// File: src/gemini/commands/command.interface.ts

import { CliArguments } from '../../shared/types/app.type';

/**
 * Interface defining the contract for a command handler.
 * Each command module should implement this execute method.
 *
 * @interface ICommandHandler
 * @method execute - Executes the command with the provided arguments.
 */
export interface ICommandHandler {
    /**
     * Executes the command.
     *
     * @param {CliArguments} args - The command line arguments passed to the command.
     * @returns {Promise<void>} - A promise that resolves when the command execution is complete.
     */
    execute(args: CliArguments): Promise<void>;
}