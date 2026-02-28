import { describe, it, expect, jest } from '@jest/globals';
import { runCli } from '../src/gemini/cli/gemini.cli';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CliArguments } from '@shared/types/app.type';
import { ENHANCEMENT_TYPES } from '@/gemini/types/enhancement.type';
import { runCommandLogic } from '@/gemini/cli/gemini.handler';

// Mock necessary modules and functions to isolate the unit tests

jest.mock('yargs');
jest.mock('yargs/helpers', () => ({
    hideBin: jest.fn().mockImplementation((args) => args),
}));
jest.mock('@/gemini/cli/gemini.handler');

const mockedYargs = yargs as jest.Mocked<typeof yargs>;
const mockedHideBin = hideBin as jest.MockedFunction<typeof hideBin>;
const mockedRunCommandLogic = runCommandLogic as jest.MockedFunction<typeof runCommandLogic>;

describe('runCli', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Mock yargs chainable methods to create a testable environment
        const mockYargsInstance = {
            command: jest.fn().mockReturnThis(),
            demandCommand: jest.fn().mockReturnThis(),
            strict: jest.fn().mockReturnThis(),
            help: jest.fn().mockReturnThis(),
            alias: jest.fn().mockReturnThis(),
            wrap: jest.fn().mockReturnThis(),
            fail: jest.fn().mockReturnThis(),
            parseAsync: jest.fn().mockResolvedValue(undefined),
            options: jest.fn().mockReturnThis(),
            positional: jest.fn().mockReturnThis(),
        };

        mockedYargs.mockReturnValue(mockYargsInstance as any);
        mockedHideBin.mockImplementation((args: string[]) => args);
        mockedRunCommandLogic.mockResolvedValue(undefined);
    });

    it('should initialize and configure yargs with hideBin', async () => {
        const processArgs = ['node', 'script.js', 'addComments', 'target'];
        await runCli(processArgs);

        expect(mockedHideBin).toHaveBeenCalledWith(processArgs);
        expect(mockedYargs).toHaveBeenCalledWith(processArgs);
    });

    it('should define the "addComments" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'addComments', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.ADD_COMMENTS} <targetPath>`,
            'Add AI-generated comments to files.',
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should define the "analyze" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'analyze', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.ANALYZE} <targetPath>`,
            'Analyze code structure and quality (outputs to console).',
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should define the "explain" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'explain', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.EXPLAIN} <targetPath>`,
            'Explain what the code does (outputs to console).',
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should define the "suggestImprovements" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'suggestImprovements', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.SUGGEST_IMPROVEMENTS} <targetPath>`,
            'Suggest improvements for the code (outputs to console).',
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should define the "generateDocs" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'generateDocs', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.GENERATE_DOCS} <targetPath>`,
            'Generate Markdown documentation for the project (saves to README.md).',
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should define the "addPathComment" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'addPathComment', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.ADD_PATH_COMMENT} <targetPath>`,
            'Add "// File: <relativePath>" comment header to files.',
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should define the "consolidate" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'consolidate', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.CONSOLIDATE} <targetPath>`,
            'Consolidate code into a single output file (consolidated_output.txt).',
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should define the "inferFromData" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'inferFromData', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.INFER_FROM_DATA} <targetPath>`,
            'Infer TypeScript interface from a JSON data file (outputs to console).',
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should define the "generateStructureDoc" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'generateStructureDoc', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.GENERATE_STRUCTURE_DOC} [targetPath]`,
            'Generate a Markdown file representing the project directory structure.',
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should define the "analyzeArchitecture" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'analyzeArchitecture', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.ANALYZE_ARCHITECTURE} <targetPath>`,
            'Generate an AI-driven analysis of the project architecture (saves to file).',
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('should define the "generateModuleReadme" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'generateModuleReadme', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.GENERATE_MODULE_README} <targetPath>`,
            'Generate a README.md for a specific module directory using AI.',
            expect.any(Function),
            expect.any(Function)
        );
    });

     it('should define the "generateTests" command with the correct configuration', async () => {
        const processArgs = ['node', 'script.js', 'generateTests', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().command).toHaveBeenCalledWith(
            `${ENHANCEMENT_TYPES.GENERATE_TESTS} <targetPath>`,
            'Generate/update unit test file(s) for source file(s) using AI (output to tests/...).',
            expect.any(Function),
            expect.any(Function)
        );
    });


    it('should call runCommandLogic with the correct arguments when a command is executed', async () => {
        const processArgs = ['node', 'script.js', 'addComments', 'target'];
        const parsedArgv: any = { targetPath: 'target', command: ENHANCEMENT_TYPES.ADD_COMMENTS };
        (mockedYargs().parseAsync as jest.Mock).mockResolvedValue(parsedArgv);

        await runCli(processArgs);

        expect(mockedRunCommandLogic).toHaveBeenCalledWith({ ...parsedArgv, command: ENHANCEMENT_TYPES.ADD_COMMENTS });
    });

    it('should configure demandCommand, strict, help, alias, and wrap', async () => {
        const processArgs = ['node', 'script.js', 'addComments', 'target'];
        await runCli(processArgs);

        expect(mockedYargs().demandCommand).toHaveBeenCalledWith(1, 'Please specify a valid command (action).');
        expect(mockedYargs().strict).toHaveBeenCalled();
        expect(mockedYargs().help).toHaveBeenCalled();
        expect(mockedYargs().alias).toHaveBeenCalledWith('h', 'help');
        expect(mockedYargs().wrap).toHaveBeenCalledWith(null);
    });

    it('should handle argument parsing errors and exit the process', async () => {
        const processArgs = ['node', 'script.js', 'invalidCommand'];
        const mockYargsInstance = {
            command: jest.fn().mockReturnThis(),
            demandCommand: jest.fn().mockReturnThis(),
            strict: jest.fn().mockReturnThis(),
            help: jest.fn().mockReturnThis(),
            alias: jest.fn().mockReturnThis(),
            wrap: jest.fn().mockReturnThis(),
            fail: jest.fn().mockReturnThis(),
            parseAsync: jest.fn().mockResolvedValue(undefined),
            options: jest.fn().mockReturnThis(),
            positional: jest.fn().mockReturnThis(),
            showHelp: jest.fn(),
        };

        mockedYargs.mockReturnValue(mockYargsInstance as any);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit() was called.'); });
        (mockYargsInstance.fail as jest.Mock).mockImplementation((callback: (msg: string, err: Error | null, yargs: any) => void) => {
            callback('Test error message', null, mockYargsInstance);
            return mockYargsInstance;
        });
        try {
             await runCli(processArgs);
        } catch (error: any) {
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Test error message'));
            expect(mockYargsInstance.showHelp).toHaveBeenCalled();
            expect(processExitSpy).toHaveBeenCalledWith(1);
        }
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();

    });

    it('should handle command execution errors and exit the process', async () => {
        const processArgs = ['node', 'script.js', 'addComments', 'target'];
        const errorMessage = 'Command execution failed';
        (mockedYargs().parseAsync as jest.Mock).mockRejectedValue(new Error(errorMessage));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit() was called.'); });

        try {
            await runCli(processArgs);
        } catch (error: any) {
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('An unexpected critical error occurred during execution:'));
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
            expect(processExitSpy).toHaveBeenCalledWith(1);
        }
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
    });
});