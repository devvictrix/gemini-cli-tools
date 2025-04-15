import { describe, it, expect, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { execute } from '../src/gemini/commands/analyze.command';
import { CliArguments } from '../src/shared/types/app.type';
import { getConsolidatedSources, getTargetFiles } from '../src/shared/utils/filesystem.utils';
import { readSingleFile } from '../src/shared/utils/file-io.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../src/gemini/gemini.service';
import { EnhancementType } from '../src/gemini/types/enhancement.type';

jest.mock('fs');
jest.mock('path');
jest.mock('../src/shared/utils/filesystem.utils');
jest.mock('../src/shared/utils/file-io.utils');
jest.mock('../src/gemini/gemini.service');

describe('execute', () => {
    const mockedFs = fs as jest.Mocked<typeof fs>;
    const mockedPath = path as jest.Mocked<typeof path>;
    const mockedGetConsolidatedSources = getConsolidatedSources as jest.MockedFunction<typeof getConsolidatedSources>;
    const mockedGetTargetFiles = getTargetFiles as jest.MockedFunction<typeof getTargetFiles>;
    const mockedReadSingleFile = readSingleFile as jest.MockedFunction<typeof readSingleFile>;
    const mockedEnhanceCodeWithGemini = enhanceCodeWithGemini as jest.MockedFunction<typeof enhanceCodeWithGemini>;
    let consoleLogSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        jest.clearAllMocks();
    });

    it('should throw an error if the command is not Analyze', async () => {
        const args: CliArguments = { command: 'NotAnalyze' as EnhancementType, targetPath: 'test', prefix: '' };

        await expect(execute(args)).rejects.toThrowError("Handler mismatch: Expected Analyze command.");
    });

    it('should throw an error if the target path is inaccessible', async () => {
        const args: CliArguments = { command: EnhancementType.Analyze, targetPath: 'test', prefix: '' };
        mockedFs.statSync.mockImplementation(() => { throw new Error('File not found'); });

        await expect(execute(args)).rejects.toThrowError("Cannot access target path: test. Please ensure it exists.");
    });

    it('should log a message and exit if no relevant files are found in a directory', async () => {
        const args: CliArguments = { command: EnhancementType.Analyze, targetPath: 'test', prefix: '' };
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true, isFile: () => false } as fs.Stats);
        mockedGetTargetFiles.mockResolvedValue([]);

        await execute(args);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("No relevant files found. Exiting."));
    });

    it('should process a directory with relevant files', async () => {
        const args: CliArguments = { command: EnhancementType.Analyze, targetPath: 'test', prefix: '' };
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true, isFile: () => false } as fs.Stats);
        mockedGetTargetFiles.mockResolvedValue(['file1.ts', 'file2.ts']);
        mockedGetConsolidatedSources.mockResolvedValue('consolidated code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'text', content: 'Gemini analysis result' });

        await execute(args);

        expect(mockedGetConsolidatedSources).toHaveBeenCalledWith('test', '');
        expect(mockedEnhanceCodeWithGemini).toHaveBeenCalledWith(EnhancementType.Analyze, 'consolidated code');
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Gemini analysis result"));
    });

    it('should process a single file', async () => {
        const args: CliArguments = { command: EnhancementType.Analyze, targetPath: 'test.ts', prefix: '' };
        mockedFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);
        mockedPath.resolve.mockReturnValue('resolved/test.ts');
        mockedReadSingleFile.mockReturnValue('single file content');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'text', content: 'Gemini analysis result' });

        await execute(args);

        expect(mockedReadSingleFile).toHaveBeenCalledWith('resolved/test.ts');
        expect(mockedEnhanceCodeWithGemini).toHaveBeenCalledWith(EnhancementType.Analyze, 'single file content');
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Gemini analysis result"));
    });

    it('should throw an error if the target path is neither a file nor a directory', async () => {
        const args: CliArguments = { command: EnhancementType.Analyze, targetPath: 'test', prefix: '' };
        mockedFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => false } as fs.Stats);

        await expect(execute(args)).rejects.toThrowError("Target path test is neither a file nor a directory.");
    });

    it('should skip the Gemini service call if the code to process is empty', async () => {
        const args: CliArguments = { command: EnhancementType.Analyze, targetPath: 'test.ts', prefix: '' };
        mockedFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);
        mockedPath.resolve.mockReturnValue('resolved/test.ts');
        mockedReadSingleFile.mockReturnValue('   ');

        await execute(args);

        expect(mockedEnhanceCodeWithGemini).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Warning: Content to analyze is empty. Skipping API call."));
    });

    it('should throw an error if the Gemini service returns an error', async () => {
        const args: CliArguments = { command: EnhancementType.Analyze, targetPath: 'test.ts', prefix: '' };
        mockedFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);
        mockedPath.resolve.mockReturnValue('resolved/test.ts');
        mockedReadSingleFile.mockReturnValue('some code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'error', content: 'Gemini failed' });

        await expect(execute(args)).rejects.toThrowError("Gemini service failed: Gemini failed");
    });

    it('should throw an error if the Gemini service returns an unexpected result type', async () => {
        const args: CliArguments = { command: EnhancementType.Analyze, targetPath: 'test.ts', prefix: '' };
        mockedFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);
        mockedPath.resolve.mockReturnValue('resolved/test.ts');
        mockedReadSingleFile.mockReturnValue('some code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'unexpected', content: 'Some content' } as any);

        await expect(execute(args)).rejects.toThrowError("Received unexpected result type 'unexpected' from Gemini.");
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Received unexpected result type 'unexpected' or null content (expected 'text')."));
    });

    it('should handle null content from Gemini with unexpected result type', async () => {
         const args: CliArguments = { command: EnhancementType.Analyze, targetPath: 'test.ts', prefix: '' };
        mockedFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);
        mockedPath.resolve.mockReturnValue('resolved/test.ts');
        mockedReadSingleFile.mockReturnValue('some code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'unexpected', content: null } as any);

        await expect(execute(args)).rejects.toThrowError("Received unexpected result type 'unexpected' from Gemini.");
         expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Received unexpected result type 'unexpected' or null content (expected 'text')."));
    });

    it('should truncate long content when logging unexpected content', async () => {
        const longContent = 'A'.repeat(600);
         const args: CliArguments = { command: EnhancementType.Analyze, targetPath: 'test.ts', prefix: '' };
        mockedFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);
        mockedPath.resolve.mockReturnValue('resolved/test.ts');
        mockedReadSingleFile.mockReturnValue('some code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'unexpected', content: longContent } as any);

        try {
            await execute(args);
        } catch (e) {
            // Expected to throw an error
        }

        expect(consoleLogSpy).toHaveBeenCalledWith("--- Unexpected Content ---");
        expect(consoleLogSpy).toHaveBeenCalledWith(longContent.substring(0, 500) + "...");
        expect(consoleLogSpy).toHaveBeenCalledWith("-------------------------");
    });
});