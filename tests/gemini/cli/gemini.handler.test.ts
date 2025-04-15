import { describe, it, expect, jest } from '@jest/globals';
import { runCommandLogic } from '../src/gemini/cli/gemini.handler';
import { CliArguments } from '../src/shared/types/app.type';
import { EnhancementType } from '../src/gemini/types/enhancement.type';

// Mock command modules
jest.mock('../src/gemini/commands/add-comments.command', () => ({ execute: jest.fn() }));
jest.mock('../src/gemini/commands/add-path-comment.command', () => ({ execute: jest.fn() }));
jest.mock('../src/gemini/commands/analyze.command', () => ({ execute: jest.fn() }));
jest.mock('../src/gemini/commands/consolidate.command', () => ({ execute: jest.fn() }));
jest.mock('../src/gemini/commands/explain.command', () => ({ execute: jest.fn() }));
jest.mock('../src/gemini/commands/generate-docs.command', () => ({ execute: jest.fn() }));
jest.mock('../src/gemini/commands/generate-structure-doc.command', () => ({ execute: jest.fn() }));
jest.mock('../src/gemini/commands/infer-from-data.command', () => ({ execute: jest.fn() }));
jest.mock('../src/gemini/commands/suggest-improvements.command', () => ({ execute: jest.fn() }));
jest.mock('../src/gemini/commands/analyze-architecture.command', () => ({ execute: jest.fn() }));
jest.mock('../src/gemini/commands/generate-module-readme.command', () => ({ execute: jest.fn() }));
jest.mock('../src/gemini/commands/generate-tests.command', () => ({ execute: jest.fn() }));

import * as addCommentsCmd from '../src/gemini/commands/add-comments.command';
import * as addPathCommentCmd from '../src/gemini/commands/add-path-comment.command';
import * as analyzeCmd from '../src/gemini/commands/analyze.command';
import * as consolidateCmd from '../src/gemini/commands/consolidate.command';
import * as explainCmd from '../src/gemini/commands/explain.command';
import * as generateDocsCmd from '../src/gemini/commands/generate-docs.command';
import * as generateStructureDocCmd from '../src/gemini/commands/generate-structure-doc.command';
import * as inferFromDataCmd from '../src/gemini/commands/infer-from-data.command';
import * as suggestImprovementsCmd from '../src/gemini/commands/suggest-improvements.command';
import * as analyzeArchitectureCmd from '../src/gemini/commands/analyze-architecture.command';
import * as generateModuleReadmeCmd from '../src/gemini/commands/generate-module-readme.command';
import * as generateTestsCmd from '../src/gemini/commands/generate-tests.command';


describe('runCommandLogic', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit() was called.'); });
    process.exitCode = 0; // Reset exit code
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('should execute the correct command handler', async () => {
    const argv: CliArguments = { command: EnhancementType.AddComments, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(addCommentsCmd.execute).toHaveBeenCalledWith(argv);
  });

  it('should handle errors during command execution', async () => {
    const errorMessage = 'Simulated error';
    (addCommentsCmd.execute as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const argv: CliArguments = { command: EnhancementType.AddComments, targetPath: 'test' };
    await expect(runCommandLogic(argv)).rejects.toThrowError('process.exit() was called.');

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error during execution of command"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
    expect(process.exitCode).toBe(1);
  });

    it('should handle errors during command execution and print stack trace when it is not a user input error', async () => {
    const errorMessage = 'Simulated internal error';
    const error = new Error(errorMessage);
    (addCommentsCmd.execute as jest.Mock).mockRejectedValue(error);

    const argv: CliArguments = { command: EnhancementType.AddComments, targetPath: 'test' };

    await expect(runCommandLogic(argv)).rejects.toThrowError('process.exit() was called.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error during execution of command"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
    expect(consoleErrorSpy).toHaveBeenCalledWith(error.stack);
    expect(process.exitCode).toBe(1);
  });

  it('should handle errors during command execution and not print stack trace when it is a user input error (Cannot access target path)', async () => {
    const errorMessage = 'Cannot access target path: invalid/path';
    const error = new Error(errorMessage);
    (addCommentsCmd.execute as jest.Mock).mockRejectedValue(error);

    const argv: CliArguments = { command: EnhancementType.AddComments, targetPath: 'test' };

     await expect(runCommandLogic(argv)).rejects.toThrowError('process.exit() was called.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error during execution of command"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(error.stack);
    expect(process.exitCode).toBe(1);
  });

  it('should handle errors during command execution and not print stack trace when it is a user input error (Target path for)', async () => {
    const errorMessage = 'Target path for something is invalid';
    const error = new Error(errorMessage);
    (addCommentsCmd.execute as jest.Mock).mockRejectedValue(error);

    const argv: CliArguments = { command: EnhancementType.AddComments, targetPath: 'test' };

     await expect(runCommandLogic(argv)).rejects.toThrowError('process.exit() was called.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error during execution of command"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(error.stack);
    expect(process.exitCode).toBe(1);
  });

  it('should handle errors during command execution and not print stack trace when it is a user input error (must be a directory)', async () => {
    const errorMessage = 'some path must be a directory';
    const error = new Error(errorMessage);
    (addCommentsCmd.execute as jest.Mock).mockRejectedValue(error);

    const argv: CliArguments = { command: EnhancementType.AddComments, targetPath: 'test' };

    await expect(runCommandLogic(argv)).rejects.toThrowError('process.exit() was called.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error during execution of command"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(error.stack);
    expect(process.exitCode).toBe(1);
  });

    it('should handle errors during command execution and not print stack trace when it is a user input error (must be a file)', async () => {
    const errorMessage = 'some path must be a file';
    const error = new Error(errorMessage);
    (addCommentsCmd.execute as jest.Mock).mockRejectedValue(error);

    const argv: CliArguments = { command: EnhancementType.AddComments, targetPath: 'test' };

    await expect(runCommandLogic(argv)).rejects.toThrowError('process.exit() was called.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error during execution of command"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(error.stack);
    expect(process.exitCode).toBe(1);
  });

  it('should handle errors that are not Error objects', async () => {
    const errorMessage = 'Simulated non-Error object';
    (addCommentsCmd.execute as jest.Mock).mockRejectedValue(errorMessage);

    const argv: CliArguments = { command: EnhancementType.AddComments, targetPath: 'test' };
    await expect(runCommandLogic(argv)).rejects.toThrowError('process.exit() was called.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error during execution of command"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Unknown error object"));
    expect(process.exitCode).toBe(1);
  });

  it('should handle missing command handler', async () => {
    const argv: CliArguments = { command: 'unknownCommand' as EnhancementType, targetPath: 'test' };

    await expect(runCommandLogic(argv)).rejects.toThrowError('process.exit() was called.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Internal Error: No handler found for command: unknownCommand"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should log a success message after command execution', async () => {
    (addCommentsCmd.execute as jest.Mock).mockResolvedValue(undefined);
    const argv: CliArguments = { command: EnhancementType.AddComments, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Command 'AddComments' finished."));
  });

  it('should execute addPathCommentCmd command', async () => {
    const argv: CliArguments = { command: EnhancementType.AddPathComment, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(addPathCommentCmd.execute).toHaveBeenCalledWith(argv);
  });

  it('should execute analyzeCmd command', async () => {
    const argv: CliArguments = { command: EnhancementType.Analyze, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(analyzeCmd.execute).toHaveBeenCalledWith(argv);
  });

  it('should execute consolidateCmd command', async () => {
    const argv: CliArguments = { command: EnhancementType.Consolidate, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(consolidateCmd.execute).toHaveBeenCalledWith(argv);
  });

  it('should execute explainCmd command', async () => {
    const argv: CliArguments = { command: EnhancementType.Explain, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(explainCmd.execute).toHaveBeenCalledWith(argv);
  });

  it('should execute generateDocsCmd command', async () => {
    const argv: CliArguments = { command: EnhancementType.GenerateDocs, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(generateDocsCmd.execute).toHaveBeenCalledWith(argv);
  });

  it('should execute generateStructureDocCmd command', async () => {
    const argv: CliArguments = { command: EnhancementType.GenerateStructureDoc, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(generateStructureDocCmd.execute).toHaveBeenCalledWith(argv);
  });

  it('should execute inferFromDataCmd command', async () => {
    const argv: CliArguments = { command: EnhancementType.InferFromData, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(inferFromDataCmd.execute).toHaveBeenCalledWith(argv);
  });

  it('should execute suggestImprovementsCmd command', async () => {
    const argv: CliArguments = { command: EnhancementType.SuggestImprovements, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(suggestImprovementsCmd.execute).toHaveBeenCalledWith(argv);
  });

    it('should execute analyzeArchitectureCmd command', async () => {
    const argv: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(analyzeArchitectureCmd.execute).toHaveBeenCalledWith(argv);
  });

  it('should execute generateModuleReadmeCmd command', async () => {
    const argv: CliArguments = { command: EnhancementType.GenerateModuleReadme, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(generateModuleReadmeCmd.execute).toHaveBeenCalledWith(argv);
  });

    it('should execute generateTestsCmd command', async () => {
    const argv: CliArguments = { command: EnhancementType.GenerateTests, targetPath: 'test' };
    await runCommandLogic(argv);
    expect(generateTestsCmd.execute).toHaveBeenCalledWith(argv);
  });
});