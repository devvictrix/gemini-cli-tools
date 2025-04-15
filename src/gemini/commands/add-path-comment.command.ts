// src/gemini/commands/add-path-comment.command.ts
import path from 'path';
import fs from 'fs'; // Needed for statSync if re-validating path
import { CliArguments } from '../../shared/types/app.type.js';
import { getTargetFiles } from '../../shared/utils/filesystem.utils.js';
import { readSingleFile, updateFileContent } from '../../shared/utils/file-io.utils.js';
import { EnhancementType } from '../../shared/enums/enhancement.type.js';

const logPrefix = "[AddPathComment]";

export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.AddPathComment) {
        throw new Error("Handler mismatch: Expected AddPathComment command.");
    }
    const { targetPath, prefix } = args;

    console.log(`\n${logPrefix} Finding files in: ${targetPath}${prefix ? ` with prefix '${prefix}'` : ''}`);

    // Optional: Re-validate targetPath exists and is accessible
    try {
        fs.statSync(targetPath);
    } catch (e) {
        throw new Error(`Cannot access target path: ${targetPath}. Please ensure it exists.`);
    }

    const targetFiles = await getTargetFiles(targetPath, prefix);

    if (targetFiles.length === 0) {
        console.log(`\n${logPrefix} No relevant files found matching criteria. Exiting.`);
        return;
    }

    console.log(`\n${logPrefix} Starting SEQUENTIAL action '${args.command}' on ${targetFiles.length} file(s)...`);
    let updatedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const nonCommentableExtensions = new Set(['.json', '.env']);
    const anyCommentRegex = /^\s*(\/\/.*|#.*)/; // Simple regex for JS/TS/Shell comments

    for (const absoluteFilePath of targetFiles) {
        const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).split(path.sep).join('/');
        const fileExtension = path.extname(absoluteFilePath).toLowerCase();

        if (nonCommentableExtensions.has(fileExtension)) {
            console.log(`    ${logPrefix} ⏩ Skipping non-commentable file type: ${relativeFilePath}`);
            skippedCount++;
            continue;
        }

        try {
            const pathComment = `// File: ${relativeFilePath}`;
            const originalCode = readSingleFile(absoluteFilePath);
            const lines = originalCode.split(/\r?\n/);

            // Check if file is already correctly formatted
            let firstNonBlankLineIndex = lines.findIndex(line => line.trim() !== '');
            if (firstNonBlankLineIndex === -1) firstNonBlankLineIndex = 0; // Handle empty file
            const firstNonBlankLine = lines[firstNonBlankLineIndex]?.trim() ?? '';

            let alreadyCorrect = false;
            if (firstNonBlankLineIndex === 0 && firstNonBlankLine === pathComment && (lines.length === 1 || (lines.length > 1 && lines[1].trim() === ''))) {
                alreadyCorrect = true;
            }

            if (alreadyCorrect) {
                console.log(`    ${logPrefix} ✅ No update needed for ${relativeFilePath} (Correct header found)`);
                unchangedCount++;
                continue;
            }

            // File needs changes
            console.log(`    ${logPrefix} 🔄 Updating header for ${relativeFilePath}...`);

            let firstCodeLineIndex = 0;
            while (firstCodeLineIndex < lines.length && (lines[firstCodeLineIndex].trim() === '' || anyCommentRegex.test(lines[firstCodeLineIndex].trim()))) {
                firstCodeLineIndex++;
            }

            const codeContentLines = lines.slice(firstCodeLineIndex);
            const codeContent = codeContentLines.length > 0 ? codeContentLines.join('\n') : '';
            const newCode = `${pathComment}\n\n${codeContent}`;

            const updated = updateFileContent(absoluteFilePath, newCode);
            if (updated) updatedCount++; else errorCount++;

        } catch (fileProcessingError) {
            console.error(`    ${logPrefix} ❌ Error during processing for ${relativeFilePath}: ${fileProcessingError instanceof Error ? fileProcessingError.message : fileProcessingError}`);
            errorCount++;
        }
    } // End for loop

    // --- Summarize Sequential Results ---
    console.log("\n--- Sequential Action Summary ---");
    console.log(`  Action:              ${args.command}`);
    console.log(`  Total Files Targeted:  ${targetFiles.length}`);
    console.log(`  Successfully Updated:  ${updatedCount}`);
    console.log(`  No Changes Needed:   ${unchangedCount}`);
    console.log(`  Skipped (Non-Comment): ${skippedCount}`);
    console.log(`  Errors Encountered:    ${errorCount}`);
    console.log("---------------------------------");

    if (errorCount > 0) {
        throw new Error(`${errorCount} error(s) occurred during ${args.command}.`);
    }
}