// src/gemini/commands/explain.command.ts
// (Very similar to analyze.command.ts, just uses a different EnhancementType)
import fs from 'fs';
import path from 'path';
import { CliArguments } from '../../shared/types/app.type.js';
import { getConsolidatedSources, getTargetFiles } from '../../shared/utils/filesystem.utils.js';
import { readSingleFile } from '../../shared/utils/file-io.utils.js';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '../gemini.service.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[Explain]";

export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.Explain) {
        throw new Error("Handler mismatch: Expected Explain command.");
    }
    const { targetPath, prefix } = args;
    console.log(`\n${logPrefix} Explaining code in: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    let stats: fs.Stats;
    try {
        stats = fs.statSync(targetPath);
    } catch (e) {
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    let codeToProcess: string;
    let targetFiles: string[] = [];

    if (stats.isDirectory()) {
        targetFiles = await getTargetFiles(targetPath, prefix);
        if (targetFiles.length === 0) {
            console.log(`\n${logPrefix} No relevant files found. Exiting.`);
            return;
        }
        console.log(`\n${logPrefix} Consolidating ${targetFiles.length} file(s)...`);
        codeToProcess = await getConsolidatedSources(targetPath, prefix);
    } else if (stats.isFile()) {
        targetFiles.push(path.resolve(targetPath));
        codeToProcess = readSingleFile(targetFiles[0]);
    } else {
        throw new Error(`Target path ${targetPath} is neither a file nor a directory.`);
    }

    if (codeToProcess.trim() === '') {
        console.warn(`${logPrefix} Warning: Content to explain is empty. Skipping API call.`);
        return;
    }

    console.log(`\n${logPrefix} Invoking Gemini service...`);
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.Explain, codeToProcess);

    if (result.type === 'text' && result.content !== null) {
        console.log(`\n--- Gemini ${args.command} Result ---`);
        console.log(result.content);
        console.log(`--- End ${args.command} Result ---\n`);
    } else if (result.type === 'error') {
        throw new Error(`Gemini service failed: ${result.content ?? 'No specific error message provided.'}`);
    } else {
        console.warn(`${logPrefix} ⚠️ Received unexpected result type '${result.type}' or null content (expected 'text').`);
        if (result.content) { /* Log unexpected content */ }
        throw new Error(`Received unexpected result type '${result.type}' from Gemini.`);
    }
}