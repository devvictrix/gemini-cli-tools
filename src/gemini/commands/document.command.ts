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
import { writeOutputFile } from '@shared/utils/file-io.utils';
import { getDirectoryStructure } from '@shared/utils/dir-tree.utils';
import fs from 'fs';
import path from 'path';

const logPrefix = "[DocumentCommand]";

export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== ENHANCEMENT_TYPES.DOCUMENT) {
        throw new Error(`${logPrefix} Handler mismatch: Expected Document command.`);
    }

    const { targetPath, level = 'project', output, prefix, exclude, depth, descriptions } = args;

    if (!targetPath) {
        throw new Error(`${logPrefix} targetPath argument is required.`);
    }

    if (level === 'tree') {
         console.log(`\n${logPrefix} Generating directory structure tree for: ${targetPath}`);
         try {
             if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
                 throw new Error(`Target path '${targetPath}' must be a directory.`);
             }
         } catch (e: any) {
             throw new Error(`Invalid targetPath for tree visualization: ${e.message}`);
         }
         
         const excludePatterns = exclude ? String(exclude).split(',').map(s => s.trim()).filter(Boolean) : [];
         const maxDepth = depth ? parseInt(String(depth), 10) : undefined;
         const markdownContent = getDirectoryStructure(targetPath, {
             includeDescriptions: !!descriptions,
             maxDepth: maxDepth,
             additionalIgnores: excludePatterns
         });

         const outputFile = output ? String(output) : 'Project_Structure.md';
         console.log(`${logPrefix} Expected Output path => ${outputFile}`);
         if (writeOutputFile(outputFile, markdownContent)) {
             console.log(`${logPrefix} ✅ Directory structure successfully generated: ${outputFile}`);
         } else {
             console.error(`${logPrefix} ❌ Failed to write file: ${outputFile}`);
         }
         return; // Skip API integration for 'tree'
    }

    // Document types requiring API ('project' and 'module')
    console.log(`\n${logPrefix} Generating ${level} documentation for: ${targetPath}`);
    const filesArray = await getTargetFiles(targetPath, prefix);

    if (filesArray.length === 0) {
        throw new Error(`${logPrefix} Target path '${targetPath}' missing or no valid files found based on criteria.`);
    }

    const codeToProcess = await getConsolidatedSources(targetPath, prefix);
    if (!codeToProcess) {
        throw new Error(`${logPrefix} Failed to consolidate source files into a valid payload.`);
    }

    const options = { docLevel: String(level) };
    console.log(`${logPrefix} Invoking Gemini service...`);

    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(
        ENHANCEMENT_TYPES.DOCUMENT,
        codeToProcess,
        options
    );

    if (result.type === 'error') {
        console.error(`${logPrefix} ❌ Gemini service failed: ${result.content}`);
        throw new Error(`Gemini service failed: ${result.content}`);
    }

    const outputFile = output 
        ? String(output) 
        : (level === 'module' ? 'MODULE_README.md' : 'README.md');
    
    // Depending on model output, it might be wrapped in markdown
    let finalWriteContent = result.content || "";
    if (finalWriteContent.startsWith('```markdown')) {
        finalWriteContent = finalWriteContent.replace(/^```markdown[\r\n]+|[\r\n]+```$/g, '');
    } else if (finalWriteContent.startsWith('```')) {
        finalWriteContent = finalWriteContent.replace(/^```[\r\n]+|[\r\n]+```$/g, '');
    }
    
    console.log(`${logPrefix} Output file path => ${outputFile}`);
    if (writeOutputFile(outputFile, finalWriteContent)) {
        console.log(`${logPrefix} ✅ Documentation successfully generated: ${outputFile}`);
    } else {
        console.error(`${logPrefix} ❌ Failed to write file: ${outputFile}`);
    }
}
