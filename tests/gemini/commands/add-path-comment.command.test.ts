import { describe, it, expect, jest } from '@jest/globals';
import { execute } from '../src/gemini/commands/add-path-comment.command';
import path from 'path';
import fs from 'fs';
import { getTargetFiles } from '../src/shared/utils/filesystem.utils';
import { readSingleFile, updateFileContent } from '../src/shared/utils/file-io.utils';
import { EnhancementType } from '../src/gemini/types/enhancement.type';
import { CliArguments } from '../src/shared/types/app.type';

jest.mock('fs');
jest.mock('../src/shared/utils/filesystem.utils');
jest.mock('../src/shared/utils/file-io.utils');
jest.mock('path');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedGetTargetFiles = getTargetFiles as jest.MockedFunction<typeof getTargetFiles>;
const mockedReadSingleFile = readSingleFile as jest.MockedFunction<typeof readSingleFile>;
const mockedUpdateFileContent = updateFileContent as jest.MockedFunction<typeof updateFileContent>;
const mockedPath = path as jest.Mocked<typeof path>;

describe('execute', () => {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    beforeEach(() => {
        console.log = jest.fn();
        console.error = jest.fn();
        mockedFs.statSync.mockReturnValue({} as fs.Stats);
        mockedGetTargetFiles.mockResolvedValue([]);
        mockedReadSingleFile.mockReturnValue('');
        mockedUpdateFileContent.mockReturnValue(true);
        mockedPath.relative.mockImplementation((from, to) => to);
        mockedPath.sep = '/';
        mockedPath.extname.mockReturnValue('.ts');
    });

    afterEach(() => {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        jest.clearAllMocks();
    });

    it('should throw an error if the command is not AddPathComment', async () => {
        const args: CliArguments = { command: 'wrongCommand' as EnhancementType, targetPath: 'testPath' };
        await expect(execute(args)).rejects.toThrowError("Handler mismatch: Expected AddPathComment command.");
    });

    it('should throw an error if the target path is inaccessible', async () => {
        const args: CliArguments = { command: EnhancementType.AddPathComment, targetPath: 'testPath' };
        mockedFs.statSync.mockImplementation(() => { throw new Error('Path not found'); });
        await expect(execute(args)).rejects.toThrowError("Cannot access target path: testPath. Please ensure it exists.");
    });

    it('should exit early if no files are found', async () => {
        const args: CliArguments = { command: EnhancementType.AddPathComment, targetPath: 'testPath' };
        mockedGetTargetFiles.mockResolvedValue([]);
        await execute(args);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("No relevant files found matching criteria. Exiting."));
        expect(mockedGetTargetFiles).toHaveBeenCalledWith('testPath', undefined);
    });

    it('should process files and add comments', async () => {
        const args: CliArguments = { command: EnhancementType.AddPathComment, targetPath: 'testPath' };
        mockedGetTargetFiles.mockResolvedValue(['testFile.ts']);
        mockedReadSingleFile.mockReturnValue('console.log("test");');
        mockedPath.extname.mockReturnValue('.ts');

        await execute(args);

        expect(mockedReadSingleFile).toHaveBeenCalledWith('testFile.ts');
        expect(mockedUpdateFileContent).toHaveBeenCalledWith('testFile.ts', '// File: testFile.ts\n\nconsole.log("test");');
    });

    it('should skip files with non-commentable extensions', async () => {
        const args: CliArguments = { command: EnhancementType.AddPathComment, targetPath: 'testPath' };
        mockedGetTargetFiles.mockResolvedValue(['testFile.json']);
        mockedPath.extname.mockReturnValue('.json');

        await execute(args);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Skipping non-commentable file type: testFile.json'));
        expect(mockedReadSingleFile).not.toHaveBeenCalled();
        expect(mockedUpdateFileContent).not.toHaveBeenCalled();
    });

    it('should not add comment if the file already has correct comment and blank line', async () => {
        const args: CliArguments = { command: EnhancementType.AddPathComment, targetPath: 'testPath' };
        mockedGetTargetFiles.mockResolvedValue(['testFile.ts']);
        mockedReadSingleFile.mockReturnValue('// File: testFile.ts\n\nconsole.log("test");');
        mockedPath.extname.mockReturnValue('.ts');

        await execute(args);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No update needed for testFile.ts (Correct header found)'));
        expect(mockedUpdateFileContent).not.toHaveBeenCalled();
    });

    it('should not add comment if the file already has correct comment and is a single line file', async () => {
        const args: CliArguments = { command: EnhancementType.AddPathComment, targetPath: 'testPath' };
        mockedGetTargetFiles.mockResolvedValue(['testFile.ts']);
        mockedReadSingleFile.mockReturnValue('// File: testFile.ts');
        mockedPath.extname.mockReturnValue('.ts');

        await execute(args);

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No update needed for testFile.ts (Correct header found)'));
        expect(mockedUpdateFileContent).not.toHaveBeenCalled();
    });

    it('should handle errors during file processing', async () => {
        const args: CliArguments = { command: EnhancementType.AddPathComment, targetPath: 'testPath' };
        mockedGetTargetFiles.mockResolvedValue(['testFile.ts']);
        mockedReadSingleFile.mockImplementation(() => { throw new Error('File read error'); });
        mockedPath.extname.mockReturnValue('.ts');
        await execute(args);

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error during processing for testFile.ts: File read error'));
    });

    it('should throw an error if errors occurred during processing', async () => {
        const args: CliArguments = { command: EnhancementType.AddPathComment, targetPath: 'testPath' };
        mockedGetTargetFiles.mockResolvedValue(['testFile.ts']);
        mockedReadSingleFile.mockImplementation(() => { throw new Error('File read error'); });
        mockedPath.extname.mockReturnValue('.ts');

        await expect(execute(args)).rejects.toThrowError('1 error(s) occurred during AddPathComment.');
    });

    it('should add comment even if there are existing comments at the start of file', async () => {
        const args: CliArguments = { command: EnhancementType.AddPathComment, targetPath: 'testPath' };
        mockedGetTargetFiles.mockResolvedValue(['testFile.ts']);
        mockedReadSingleFile.mockReturnValue('// Existing comment\n\nconsole.log("test");');
        mockedPath.extname.mockReturnValue('.ts');

        await execute(args);

        expect(mockedReadSingleFile).toHaveBeenCalledWith('testFile.ts');
        expect(mockedUpdateFileContent).toHaveBeenCalledWith('testFile.ts', '// File: testFile.ts\n\nconsole.log("test");');

    });

    it('should add comment and handle files with no content', async () => {
         const args: CliArguments = { command: EnhancementType.AddPathComment, targetPath: 'testPath' };
         mockedGetTargetFiles.mockResolvedValue(['testFile.ts']);
         mockedReadSingleFile.mockReturnValue('');
         mockedPath.extname.mockReturnValue('.ts');

         await execute(args);

         expect(mockedReadSingleFile).toHaveBeenCalledWith('testFile.ts');
         expect(mockedUpdateFileContent).toHaveBeenCalledWith('testFile.ts', '// File: testFile.ts\n\n');
    });
});