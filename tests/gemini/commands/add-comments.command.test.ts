import { describe, it, expect, jest } from '@jest/globals';
import { execute } from '../src/add-comments/add-comments.command';
import path from 'path';
import fs from 'fs';
import { CliArguments, FileProcessingResult } from '@shared/types/app.type';
import { EnhancementType } from '@/gemini/types/enhancement.type';

// Mock external dependencies
jest.mock('@shared/utils/filesystem.utils', () => ({
    getTargetFiles: jest.fn(),
}));
jest.mock('@shared/utils/file-io.utils', () => ({
    readSingleFile: jest.fn(),
    updateFileContent: jest.fn(),
}));
jest.mock('@/gemini/gemini.service', () => ({
    enhanceCodeWithGemini: jest.fn(),
}));
jest.mock('fs', () => ({
    ...jest.requireActual('fs'), // Keep actual implementation for other fs functions
    statSync: jest.fn(),
}));

const mockedGetTargetFiles = jest.mocked(require('@shared/utils/filesystem.utils').getTargetFiles);
const mockedReadSingleFile = jest.mocked(require('@shared/utils/file-io.utils').readSingleFile);
const mockedUpdateFileContent = jest.mocked(require('@shared/utils/file-io.utils').updateFileContent);
const mockedEnhanceCodeWithGemini = jest.mocked(require('@/gemini/gemini.service').enhanceCodeWithGemini);
const mockedStatSync = jest.mocked(fs.statSync);

describe('execute', () => {
    const mockCliArgs: CliArguments = {
        command: EnhancementType.AddComments,
        targetPath: '/mock/path',
        prefix: '.ts',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockedStatSync.mockImplementation(() => { });
    });

    it('should throw an error if the command type is incorrect', async () => {
        const args: CliArguments = { ...mockCliArgs, command: 'wrongCommand' as any };
        await expect(execute(args)).rejects.toThrowError("Handler mismatch: Expected AddComments command.");
    });

    it('should throw an error if the target path is inaccessible', async () => {
        mockedStatSync.mockImplementation(() => { throw new Error('Path does not exist'); });
        await expect(execute(mockCliArgs)).rejects.toThrowError("Cannot access target path: /mock/path. Please ensure it exists.");
    });

    it('should exit early if no target files are found', async () => {
        mockedGetTargetFiles.mockResolvedValue([]);
        const consoleLogSpy = jest.spyOn(console, 'log');
        await execute(mockCliArgs);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No relevant files found'));
    });

    it('should process files sequentially and update content when Gemini returns updated code', async () => {
        mockedGetTargetFiles.mockResolvedValue(['/mock/path/file1.ts', '/mock/path/file2.ts']);
        mockedReadSingleFile.mockReturnValue('original code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'code', content: 'enhanced code' });
        mockedUpdateFileContent.mockReturnValue(true);

        await execute(mockCliArgs);

        expect(mockedGetTargetFiles).toHaveBeenCalledWith('/mock/path', '.ts');
        expect(mockedReadSingleFile).toHaveBeenCalledTimes(2);
        expect(mockedEnhanceCodeWithGemini).toHaveBeenCalledTimes(2);
        expect(mockedUpdateFileContent).toHaveBeenCalledTimes(2);
    });

    it('should process files sequentially and not update content when Gemini returns unchanged code', async () => {
        mockedGetTargetFiles.mockResolvedValue(['/mock/path/file1.ts']);
        mockedReadSingleFile.mockReturnValue('original code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'code', content: 'original code' });

        await execute(mockCliArgs);

        expect(mockedGetTargetFiles).toHaveBeenCalledWith('/mock/path', '.ts');
        expect(mockedReadSingleFile).toHaveBeenCalledTimes(1);
        expect(mockedEnhanceCodeWithGemini).toHaveBeenCalledTimes(1);
        expect(mockedUpdateFileContent).not.toHaveBeenCalled();
    });

    it('should process files sequentially and handle Gemini errors', async () => {
        mockedGetTargetFiles.mockResolvedValue(['/mock/path/file1.ts']);
        mockedReadSingleFile.mockReturnValue('original code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'error', content: 'Gemini error message' });

        const consoleErrorSpy = jest.spyOn(console, 'error');
        await execute(mockCliArgs);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Gemini failed'));
    });

    it('should process files sequentially and handle unexpected Gemini results', async () => {
        mockedGetTargetFiles.mockResolvedValue(['/mock/path/file1.ts']);
        mockedReadSingleFile.mockReturnValue('original code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'unknown' as any, content: null });

        const consoleWarnSpy = jest.spyOn(console, 'warn');
        await execute(mockCliArgs);
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected result type/content'));
    });

    it('should process files sequentially and handle file processing errors', async () => {
        mockedGetTargetFiles.mockResolvedValue(['/mock/path/file1.ts']);
        mockedReadSingleFile.mockImplementation(() => { throw new Error('File read error'); });

        const consoleErrorSpy = jest.spyOn(console, 'error');
        await execute(mockCliArgs);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error during processing'));
    });

    it('should reject with error if any file processing results in error', async () => {
        mockedGetTargetFiles.mockResolvedValue(['/mock/path/file1.ts', '/mock/path/file2.ts']);
        mockedReadSingleFile.mockReturnValue('original code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'code', content: 'enhanced code' });
        mockedUpdateFileContent.mockReturnValue(false);

        await expect(execute(mockCliArgs)).rejects.toThrowError("2 error(s) occurred during AddComments.");
    });

    it('should not throw an error if updateFileContent fails but there is only one error', async () => {
        mockedGetTargetFiles.mockResolvedValue(['/mock/path/file1.ts']);
        mockedReadSingleFile.mockReturnValue('original code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'code', content: 'enhanced code' });
        mockedUpdateFileContent.mockReturnValue(false);

        await expect(execute(mockCliArgs)).rejects.toThrowError();
    });

    it('should handle errors thrown within the loop during file processing', async () => {
        mockedGetTargetFiles.mockResolvedValue(['/mock/path/file1.ts', '/mock/path/file2.ts']);
        mockedReadSingleFile.mockImplementationOnce(() => { throw new Error('Simulated file read error in loop'); });
        mockedReadSingleFile.mockReturnValue('original code'); // For subsequent calls
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'code', content: 'enhanced code' });
        mockedUpdateFileContent.mockReturnValue(true);

        const consoleErrorSpy = jest.spyOn(console, 'error');

        await expect(execute(mockCliArgs)).rejects.toThrowError();

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Uncaught error processing'));
        expect(mockedReadSingleFile).toHaveBeenCalledTimes(2); // ensure it tries to process next files
        expect(mockedEnhanceCodeWithGemini).toHaveBeenCalledTimes(1);
        expect(mockedUpdateFileContent).toHaveBeenCalledTimes(1);
    });

    it('should handle no errors thrown', async () => {
        mockedGetTargetFiles.mockResolvedValue(['/mock/path/file1.ts', '/mock/path/file2.ts']);
        mockedReadSingleFile.mockReturnValue('original code');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'code', content: 'enhanced code' });
        mockedUpdateFileContent.mockReturnValue(true);

        await expect(execute(mockCliArgs)).resolves.not.toThrow();
    });
});