// src/gemini/commands/command.interface.ts
import { CliArguments } from '../../shared/types/app.type.js';

/**
 * Interface defining the contract for a command handler.
 * Each command module should implement this execute method.
 */
export interface ICommandHandler {
    execute(args: CliArguments): Promise<void>;
}