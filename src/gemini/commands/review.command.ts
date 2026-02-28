import { CliArguments } from '@shared/types/app.type';
import { ENHANCEMENT_TYPES } from '@/gemini/types/enhancement.type';
import {
    enhanceCodeWithGemini,
    GeminiEnhancementResult,
} from '@/gemini/gemini.service';
import {
    getConsolidatedSources,
    getTargetFiles,
} from '@shared/utils/filesystem.utils';
import { readSingleFile, writeOutputFile } from '@shared/utils/file-io.utils';

const logPrefix = "[ReviewCommand]";

export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== ENHANCEMENT_TYPES.REVIEW) {
        throw new Error(`${logPrefix} Handler mismatch: Expected Review command.`);
    }

    const targetPath = args.targetPath;
    const mode = args.mode || 'quality'; // architecture | quality | explain

    if (!targetPath) {
        throw new Error(`${logPrefix} targetPath argument is required.`);
    }

    console.log(`\n${logPrefix} Running code review in mode [${mode}] for: ${targetPath}`);
    const filesArray = await getTargetFiles(targetPath, args.prefix);

    if (filesArray.length === 0) {
        throw new Error(`${logPrefix} Target path '${targetPath}' missing or no valid files found based on criteria.`);
    }

    let codeToProcess = '';
    
    // Attempt consolidation for architecture mode always, or for multi-file targets normally
    if (filesArray.length > 1 || mode === 'architecture') {
         console.log(`${logPrefix} Target is a directory/multiple files. Consolidating sources...`);
         codeToProcess = await getConsolidatedSources(targetPath, args.prefix);
         if (!codeToProcess) {
             throw new Error(`${logPrefix} Failed to consolidate source files into a valid payload.`);
         }
    } else {
         const singleFilePath = filesArray[0];
         console.log(`${logPrefix} Processing single file: ${singleFilePath}`);
         const content = readSingleFile(singleFilePath);
         if (!content) {
              throw new Error(`${logPrefix} Target file '${singleFilePath}' could not be read or is empty.`);
         }
         codeToProcess = `// File: ${singleFilePath}\n${content}`;
    }

    console.log(`${logPrefix} Invoking Gemini service...`);
    const options = { reviewMode: String(mode) };

    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(
        ENHANCEMENT_TYPES.REVIEW,
        codeToProcess,
        options
    );

    if (result.type === 'error') {
        console.error(`${logPrefix} ❌ Gemini service failed: ${result.content}`);
        throw new Error(`Gemini service failed: ${result.content}`);
    }

    console.log(`\n--- Gemini Response ---\n`);
    console.log(result.content);
    console.log(`\n-----------------------\n`);
}
