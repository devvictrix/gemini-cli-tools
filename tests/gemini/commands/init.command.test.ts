import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { execute } from '@/gemini/commands/init.command';
import { CliArguments } from '@shared/types/app.type';
import { EnhancementType } from '@/gemini/types/enhancement.type';
import * as fileIoUtils from '@shared/utils/file-io.utils';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock file-io.utils
jest.mock('@shared/utils/file-io.utils');
const mockedFileIoUtils = fileIoUtils as jest.Mocked<typeof fileIoUtils>;

describe('Init Command Execution', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    const baseArgs: Omit<CliArguments, 'command' | 'targetPath' | 'packageName'> = {
        $0: 'gemini-poc',
        _: ['init'],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        // Default mocks for fs
        mockedFs.existsSync.mockReturnValue(false); // Default: path does not exist
        mockedFs.statSync.mockImplementation((p) => {
            if (mockedFs.existsSync(p as string)) {
                // If existsSync was mocked to true for this path, pretend it's a dir
                return { isDirectory: () => true, isFile: () => false } as fs.Stats;
            }
            // Default: path does not exist, statSync throws
            throw new Error(`ENOENT: no such file or directory, stat '${p}'`);
        });
        mockedFs.mkdirSync.mockReturnValue(undefined);
        mockedFs.readdirSync.mockReturnValue([]); // Default: directory is empty

        // Default mock for writeOutputFile
        mockedFileIoUtils.writeOutputFile.mockReturnValue(true);

        // Mock path.resolve to just return the first arg for simplicity in tests
        jest.spyOn(path, 'resolve').mockImplementation((...paths: string[]) => paths[0]);
        jest.spyOn(path, 'relative').mockImplementation((from, to) => to); // Simple relative mock
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('TC1: should successfully initialize a new project in a non-existent directory', async () => {
        const args: CliArguments = {
            ...baseArgs,
            command: EnhancementType.Init,
            targetPath: 'new-project',
            packageName: 'my-app',
            description: 'A cool new app',
        };

        mockedFs.existsSync.mockReturnValue(false); // Ensure target does not exist

        await execute(args);

        expect(mockedFs.mkdirSync).toHaveBeenCalledWith(path.resolve('new-project'), { recursive: true });
        expect(mockedFs.mkdirSync).toHaveBeenCalledWith(path.join(path.resolve('new-project'), 'src'), { recursive: true });
        expect(mockedFs.mkdirSync).toHaveBeenCalledWith(path.join(path.resolve('new-project'), 'tests'), { recursive: true });
        expect(mockedFs.mkdirSync).toHaveBeenCalledWith(path.join(path.resolve('new-project'), 'docs'), { recursive: true });

        // Check that all 7 files are written
        expect(mockedFileIoUtils.writeOutputFile).toHaveBeenCalledTimes(7);

        // Verify package.json content
        const packageJsonCall = mockedFileIoUtils.writeOutputFile.mock.calls.find(call => call[0].endsWith('package.json'));
        expect(packageJsonCall).toBeDefined();
        if (packageJsonCall) {
            const pkgContent = JSON.parse(packageJsonCall[1] as string);
            expect(pkgContent.name).toBe('my-app');
            expect(pkgContent.version).toBe('0.1.0');
            expect(pkgContent.description).toBe('A cool new app');
        }

        // Verify README.md content
        const readmeCall = mockedFileIoUtils.writeOutputFile.mock.calls.find(call => call[0].endsWith('README.md'));
        expect(readmeCall).toBeDefined();
        if (readmeCall) {
            expect(readmeCall[1]).toContain('# my-app');
            expect(readmeCall[1]).toContain('A cool new app');
        }

        // Verify src/index.ts content
        const srcIndexTsCall = mockedFileIoUtils.writeOutputFile.mock.calls.find(call => call[0].endsWith(path.join('src', 'index.ts')));
        expect(srcIndexTsCall).toBeDefined();
        if (srcIndexTsCall) {
            expect(srcIndexTsCall[1]).toContain('// File: src/index.ts');
            expect(srcIndexTsCall[1]).toContain('Hello, my-app!');
        }

        // Verify tests/index.test.ts content
        const testIndexTestTsCall = mockedFileIoUtils.writeOutputFile.mock.calls.find(call => call[0].endsWith(path.join('tests', 'index.test.ts')));
        expect(testIndexTestTsCall).toBeDefined();
        if (testIndexTestTsCall) {
            expect(testIndexTestTsCall[1]).toContain('// File: tests/index.test.ts');
            expect(testIndexTestTsCall[1]).toContain("describe('my-app Initial Tests'");
        }


        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Project 'my-app' initialized successfully"));
    });

    it('TC2: should successfully initialize in an existing empty directory', async () => {
        const args: CliArguments = {
            ...baseArgs,
            command: EnhancementType.Init,
            targetPath: 'existing-empty-dir',
            packageName: 'empty-dir-app',
        };
        mockedFs.existsSync.mockReturnValue(true); // Target dir exists
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats); // It's a directory
        mockedFs.readdirSync.mockReturnValue([]); // It's empty

        await execute(args);
        expect(mockedFileIoUtils.writeOutputFile).toHaveBeenCalledTimes(7);
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Project 'empty-dir-app' initialized successfully"));
    });

    it('TC3: should initialize with --force in a non-empty directory and log warning', async () => {
        const args: CliArguments = {
            ...baseArgs,
            command: EnhancementType.Init,
            targetPath: 'non-empty-dir',
            packageName: 'forced-app',
            force: true,
        };
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedFs.readdirSync.mockReturnValue(['some-file.txt']); // Not empty

        await execute(args);

        expect(mockedFileIoUtils.writeOutputFile).toHaveBeenCalledTimes(7);
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Target directory 'non-empty-dir' is not empty. --force flag is used"));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Project 'forced-app' initialized successfully"));
    });

    it('TC4: should throw error if targetPath is an existing file', async () => {
        const args: CliArguments = {
            ...baseArgs,
            command: EnhancementType.Init,
            targetPath: 'existing-file.txt',
            packageName: 'file-target-app',
        };
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true } as fs.Stats); // It's a file

        await expect(execute(args)).rejects.toThrowError("Target path 'existing-file.txt' exists but is not a directory.");
    });

    it('TC5: should throw error if targetPath is non-empty and --force is not used', async () => {
        const args: CliArguments = {
            ...baseArgs,
            command: EnhancementType.Init,
            targetPath: 'non-empty-no-force',
            packageName: 'no-force-app',
            force: false, // Explicitly false or undefined
        };
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
        mockedFs.readdirSync.mockReturnValue(['another-file.txt']); // Not empty

        await expect(execute(args)).rejects.toThrowError("Target directory 'non-empty-no-force' is not empty. Use --force to proceed.");
    });

    it('TC6: should throw error if packageName is missing', async () => {
        const args: CliArguments = {
            ...baseArgs,
            command: EnhancementType.Init,
            targetPath: 'some-path',
            packageName: undefined, // Missing
        } as unknown as CliArguments; // Cast to bypass TS check for test

        await expect(execute(args)).rejects.toThrowError("--packageName option is required and cannot be empty.");
    });

    it('TC6b: should throw error if packageName is empty string', async () => {
        const args: CliArguments = {
            ...baseArgs,
            command: EnhancementType.Init,
            targetPath: 'some-path',
            packageName: "   ", // Empty after trim
        };

        await expect(execute(args)).rejects.toThrowError("--packageName option is required and cannot be empty.");
    });


    it('TC7: should handle missing description gracefully', async () => {
        const args: CliArguments = {
            ...baseArgs,
            command: EnhancementType.Init,
            targetPath: 'no-desc-proj',
            packageName: 'app-no-desc',
            description: undefined,
        };
        mockedFs.existsSync.mockReturnValue(false);

        await execute(args);

        const packageJsonCall = mockedFileIoUtils.writeOutputFile.mock.calls.find(call => call[0].endsWith('package.json'));
        expect(packageJsonCall).toBeDefined();
        if (packageJsonCall) {
            const pkgContent = JSON.parse(packageJsonCall[1] as string);
            expect(pkgContent.description).toBe(""); // Expect empty string if undefined
        }

        const readmeCall = mockedFileIoUtils.writeOutputFile.mock.calls.find(call => call[0].endsWith('README.md'));
        expect(readmeCall).toBeDefined();
        if (readmeCall) {
            // README should not contain an empty description line if not provided
            expect(readmeCall[1]).not.toContain("\n\n\n## Overview");
        }
    });

    it('should use path.resolve for projectRoot', async () => {
        const args: CliArguments = {
            ...baseArgs,
            command: EnhancementType.Init,
            targetPath: './relative-path',
            packageName: 'my-app',
        };
        mockedFs.existsSync.mockReturnValue(false);
        const resolveSpy = jest.spyOn(path, 'resolve');

        await execute(args);

        expect(resolveSpy).toHaveBeenCalledWith('./relative-path');
    });

    it('should correctly form FEATURE_ROADMAP.md content', async () => {
        const args: CliArguments = {
            ...baseArgs,
            command: EnhancementType.Init,
            targetPath: 'new-project',
            packageName: 'my-roadmap-app',
        };
        mockedFs.existsSync.mockReturnValue(false);
        await execute(args);

        const roadmapCall = mockedFileIoUtils.writeOutputFile.mock.calls.find(call => call[0].endsWith('FEATURE_ROADMAP.md'));
        expect(roadmapCall).toBeDefined();
        if (roadmapCall) {
            expect(roadmapCall[1]).toContain('# Project: my-roadmap-app - Roadmap & Status');
            expect(roadmapCall[1]).toContain('| v0.1.0  | Not Started | P0       | Initial Project Setup |');
        }
    });

    it('should correctly form .gitignore content', async () => {
        const args: CliArguments = {
            ...baseArgs,
            command: EnhancementType.Init,
            targetPath: 'new-project',
            packageName: 'my-gitignore-app',
        };
        mockedFs.existsSync.mockReturnValue(false);
        await execute(args);

        const gitignoreCall = mockedFileIoUtils.writeOutputFile.mock.calls.find(call => call[0].endsWith('.gitignore'));
        expect(gitignoreCall).toBeDefined();
        if (gitignoreCall) {
            expect(gitignoreCall[1]).toContain('/node_modules');
            expect(gitignoreCall[1]).toContain('/dist');
            expect(gitignoreCall[1]).toContain('.env');
        }
    });
});