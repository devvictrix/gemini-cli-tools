import { describe, it, expect, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { execute } from '../src/gemini/commands/analyze-architecture.command';
import { CliArguments } from '@shared/types/app.type';
import { EnhancementType } from '@/gemini/types/enhancement.type';

// Mock external dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('@shared/utils/filesystem.utils');
jest.mock('@shared/utils/file-io.utils');
jest.mock('@/gemini/gemini.service');

import { getConsolidatedSources } from '@shared/utils/filesystem.utils';
import { writeOutputFile } from '@shared/utils/file-io.utils';
import { enhanceCodeWithGemini } from '@/gemini/gemini.service';

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedPath = path as jest.Mocked<typeof path>;
const mockedGetConsolidatedSources = getConsolidatedSources as jest.Mock;
const mockedWriteOutputFile = writeOutputFile as jest.Mock;
const mockedEnhanceCodeWithGemini = enhanceCodeWithGemini as jest.Mock;

describe('AnalyzeArchitecture Command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should throw an error if the command is not AnalyzeArchitecture', async () => {
        const args: CliArguments = { command: 'wrong-command' as EnhancementType, targetPath: 'some/path' };
        await expect(execute(args)).rejects.toThrowError("Handler mismatch: Expected AnalyzeArchitecture command.");
    });

    it('should throw an error if the target path is not a directory', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);

        await expect(execute(args)).rejects.toThrowError(`Target path for '${EnhancementType.AnalyzeArchitecture}' must be a directory.`);
        expect(mockedFs.statSync).toHaveBeenCalledWith('resolved/path');
    });

    it('should throw an error if the target path does not exist', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockImplementation(() => { throw new Error('File not found'); });

        await expect(execute(args)).rejects.toThrowError(`Cannot access target path: 'some/path'. Please ensure it exists and is a directory. File not found`);
        expect(mockedFs.statSync).toHaveBeenCalledWith('resolved/path');
    });

    it('should use the provided output filename if provided', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path', output: 'custom_output.md' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('// Header\n// Header\n// Header\n// Header\n// Header\n// Header\n// Header\nconst a = 1;');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'text', content: 'Analysis Result' });
        mockedWriteOutputFile.mockReturnValue(true);

        await execute(args);

        expect(mockedWriteOutputFile).toHaveBeenCalledWith(expect.any(String), 'Analysis Result');
        expect(mockedWriteOutputFile).toHaveBeenCalledWith(path.resolve(process.cwd(), 'custom_output.md'), 'Analysis Result');
    });

    it('should use the default output filename if no output is provided', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('// Header\n// Header\n// Header\n// Header\n// Header\n// Header\n// Header\nconst a = 1;');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'text', content: 'Analysis Result' });
        mockedWriteOutputFile.mockReturnValue(true);

        await execute(args);

        expect(mockedWriteOutputFile).toHaveBeenCalledWith(path.resolve(process.cwd(), 'AI_Architecture_Analyzed.md'), 'Analysis Result');
    });

    it('should consolidate code from the target path', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('// Header\n// Header\n// Header\n// Header\n// Header\n// Header\n// Header\nconst a = 1;');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'text', content: 'Analysis Result' });
        mockedWriteOutputFile.mockReturnValue(true);

        await execute(args);

        expect(mockedGetConsolidatedSources).toHaveBeenCalledWith('resolved/path', undefined);
    });

    it('should invoke the Gemini service with the consolidated code', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('// Header\n// Header\n// Header\n// Header\n// Header\n// Header\n// Header\nconst a = 1;');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'text', content: 'Analysis Result' });
        mockedWriteOutputFile.mockReturnValue(true);

        await execute(args);

        expect(mockedEnhanceCodeWithGemini).toHaveBeenCalledWith(EnhancementType.AnalyzeArchitecture, '// Header\n// Header\n// Header\n// Header\n// Header\n// Header\n// Header\nconst a = 1;');
    });

    it('should write the analysis result to a file', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('// Header\n// Header\n// Header\n// Header\n// Header\n// Header\n// Header\nconst a = 1;');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'text', content: 'Analysis Result' });
        mockedWriteOutputFile.mockReturnValue(true);

        await execute(args);

        expect(mockedWriteOutputFile).toHaveBeenCalledWith(expect.any(String), 'Analysis Result');
    });

    it('should throw an error if writing the output file fails', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('// Header\n// Header\n// Header\n// Header\n// Header\n// Header\n// Header\nconst a = 1;');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'text', content: 'Analysis Result' });
        mockedWriteOutputFile.mockReturnValue(false);

        await expect(execute(args)).rejects.toThrowError(`Failed to write architecture analysis file to AI_Architecture_Analyzed.md.`);
    });

    it('should throw an error if the Gemini service returns an error', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('// Header\n// Header\n// Header\n// Header\n// Header\n// Header\n// Header\nconst a = 1;');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'error', content: 'Gemini Error' });

        await expect(execute(args)).rejects.toThrowError(`Gemini service failed during architecture analysis: Gemini Error`);
    });

    it('should handle unexpected result types from Gemini', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('// Header\n// Header\n// Header\n// Header\n// Header\n// Header\n// Header\nconst a = 1;');
        mockedEnhanceCodeWithGemini.mockResolvedValue({ type: 'unknown' as any, content: 'Unknown Result' });

        await expect(execute(args)).rejects.toThrowError("Received unexpected result type 'unknown' from Gemini during architecture analysis.");
    });

    it('should exit gracefully when no relevant source files are found', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('// Header\n// Header\n// Header\n// Header\n// Header\n// Header\n// Header');
        const consoleWarnSpy = jest.spyOn(console, 'warn');
        await execute(args);
        expect(mockedEnhanceCodeWithGemini).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("No relevant source files found"));
    });

	it('should exit gracefully when no relevant source files are found and prefix provided', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path', prefix: 'test' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('// Header\n// Header\n// Header\n// Header\n// Header\n// Header\n// Header');
        const consoleWarnSpy = jest.spyOn(console, 'warn');
        await execute(args);
        expect(mockedEnhanceCodeWithGemini).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("No relevant source files found"));
    });

    it('should handle empty consolidated code', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('');
        const consoleWarnSpy = jest.spyOn(console, 'warn');
        await execute(args);
        expect(mockedEnhanceCodeWithGemini).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Warning: Consolidated code is empty. Skipping API call."));
    });

    it('should handle whitespace-only consolidated code', async () => {
        const args: CliArguments = { command: EnhancementType.AnalyzeArchitecture, targetPath: 'some/path' };
        mockedPath.resolve.mockReturnValue('resolved/path');
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedGetConsolidatedSources.mockResolvedValue('   ');
        const consoleWarnSpy = jest.spyOn(console, 'warn');
        await execute(args);
        expect(mockedEnhanceCodeWithGemini).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Warning: Consolidated code is empty. Skipping API call."));
    });
});