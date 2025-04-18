// src/gemini/commands/develop.command.ts

import fs from 'fs';
import path from 'path';
import { glob } from 'glob'; // <<< Import glob
import { CliArguments } from '@shared/types/app.type';
import { readSingleFile, writeOutputFile } from '@shared/utils/file-io.utils';
import { parseChecklistTable, extractCurrentPhase, ChecklistItem } from '@shared/utils/markdown.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';

const logPrefix = "[Develop]";
const REQUIREMENT_FILENAME = 'REQUIREMENT.md';
const CHECKLIST_FILENAME = 'REQUIREMENTS_CHECKLIST.md';

// (generateDevelopmentPrompt function remains the same as before)
function generateDevelopmentPrompt(task: ChecklistItem, codeContext: string): string {
    let fileContextSection = "No specific code context provided. Implement based on the task description.";
    if (codeContext.trim()) {
        fileContextSection = `Here is the current content of the relevant file(s):\n\n${codeContext}\n`;
    }

    return `
You are an AI programming assistant. Your task is to implement the following requirement based on the provided code context.

**Requirement Details:**
- **Task ID:** ${task.id}
- **Description:** ${task.description}
- **Responsible File(s):** ${task.responsibleFiles.join(', ') || 'N/A'}

**Current Code Context:**
${fileContextSection}

**Instructions:**
1.  Carefully read the requirement description.
2.  Analyze the provided code context from the responsible file(s).
3.  Implement the required changes directly into the code.
4.  **CRITICAL:** Respond with the **ENTIRE modified content** for each file that was changed. If a file listed as responsible was NOT changed, do NOT include it in the response.
5.  **CRITICAL:** If you modify one or more files, you MUST precede the complete content of each modified file with a header comment line exactly like this: \`// File: path/to/the/file.ext\` (using the correct relative path).
6.  Ensure the returned code is complete and syntactically correct for the entire file.
7.  Do NOT include any explanations, introductions, summaries, or markdown formatting (like \`\`\`) outside the code content itself. Respond ONLY with the file header comments and the complete code for each modified file.

Implement the requirement and provide the full modified file content(s) now.
`;
}


export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.Develop) {
        throw new Error("Handler mismatch: Expected Develop command.");
    }

    const { targetPath } = args;
    const projectRoot = path.resolve(targetPath);

    console.log(`\n${logPrefix} Starting development cycle for project at: ${projectRoot}`);

    // --- Validate Project Root and Files ---
    let requirementContent: string;
    let checklistContent: string;
    const requirementPath = path.join(projectRoot, REQUIREMENT_FILENAME);
    const checklistPath = path.join(projectRoot, CHECKLIST_FILENAME);

    try {
        if (!fs.statSync(projectRoot).isDirectory()) {
            throw new Error("Target path must be a directory.");
        }
        console.log(`${logPrefix} Reading requirement files...`);
        requirementContent = readSingleFile(requirementPath);
        checklistContent = readSingleFile(checklistPath);
    } catch (e) {
        throw new Error(`Failed to access project root or required files (${REQUIREMENT_FILENAME}, ${CHECKLIST_FILENAME}): ${e instanceof Error ? e.message : e}`);
    }

    // --- Determine Current Phase ---
    console.log(`${logPrefix} Determining current phase...`);
    const currentPhase = extractCurrentPhase(requirementContent);
    if (!currentPhase) {
        throw new Error(`Could not determine current phase from ${REQUIREMENT_FILENAME}. Ensure 'Current Focus: Phase X - Name' line exists.`);
    }
    const currentPhaseIdentifier = `P${currentPhase.number}`;
    console.log(`${logPrefix} Identified Current Phase: ${currentPhaseIdentifier} - ${currentPhase.name}`);

    // --- Parse Checklist and Find Next Task ---
    console.log(`${logPrefix} Parsing checklist and selecting next task...`);
    const checklistItems = parseChecklistTable(checklistContent);
    if (checklistItems.length === 0) {
        throw new Error(`Failed to parse any items from ${CHECKLIST_FILENAME}. Check table format.`);
    }

    const phaseTasks = checklistItems.filter(item => item.targetPhase === currentPhaseIdentifier);
    let nextTask = phaseTasks.find(item => item.status.toLowerCase() === 'in progress');
    if (!nextTask) {
        nextTask = phaseTasks.find(item => item.status.toLowerCase() === 'not started');
    }

    if (!nextTask) {
        console.log(`\n${logPrefix} ✅ No pending tasks found for the current phase (${currentPhaseIdentifier}). Check checklist or advance phase in ${REQUIREMENT_FILENAME}.`);
        return;
    }
    console.log(`${logPrefix} Selected Task #${nextTask.id}: ${nextTask.description}`);
    console.log(`${logPrefix}   Status: ${nextTask.status}, Files: ${nextTask.responsibleFiles.join(', ')}`);

    // --- Gather Context (Read Relevant Files) ---
    let codeContext = '';
    let readableFilesFound = false;
    const processedFilePaths = new Set<string>(); // To avoid reading the same file twice if listed explicitly and via glob

    // **MODIFIED FILE READING LOGIC**
    console.log(`${logPrefix} Reading content of relevant files...`);
    const rawFilesList = nextTask.responsibleFiles
        .map(f => f.trim().replace(/^`|`$/g, '')) // Clean backticks just in case
        .filter(f => f && f.toLowerCase() !== 'all files'); // Filter out empty strings and "All files"

    for (const fileOrPattern of rawFilesList) {
        let filesToProcess: string[] = [];

        // Check if it's a glob pattern
        if (fileOrPattern.includes('*')) {
            console.log(`  ${logPrefix} Expanding glob pattern: ${fileOrPattern}`);
            try {
                // Use glob.sync for simplicity here, async is also possible
                const matchedFiles = await glob(fileOrPattern, { cwd: projectRoot, nodir: true, absolute: true });
                filesToProcess = matchedFiles;
                console.log(`    ${logPrefix} Found ${matchedFiles.length} file(s) matching glob.`);
            } catch (globError) {
                console.warn(`${logPrefix} ⚠️ Error expanding glob pattern ${fileOrPattern}. Skipping. Error: ${globError instanceof Error ? globError.message : globError}`);
                continue; // Skip to the next pattern/file
            }
        } else {
            // Treat as a single file path
            filesToProcess.push(path.resolve(projectRoot, fileOrPattern)); // Resolve relative to project root
        }

        // Process the resolved file paths (either single or from glob)
        for (const absoluteFilePath of filesToProcess) {
            if (processedFilePaths.has(absoluteFilePath)) {
                continue; // Skip if already processed
            }
            processedFilePaths.add(absoluteFilePath);

            const friendlyPath = path.relative(projectRoot, absoluteFilePath).split(path.sep).join('/'); // For comments/logging

            try {
                const fileContent = readSingleFile(absoluteFilePath);
                codeContext += `// File: ${friendlyPath}\n\n${fileContent}\n\n---\n\n`; // Separator helps AI
                readableFilesFound = true;
                console.log(`    ${logPrefix} Read context from: ${friendlyPath}`);
            } catch (e) {
                // readSingleFile logs specific errors, just add a generic warning here
                console.warn(`${logPrefix} ⚠️ Failed to read ${friendlyPath}. Skipping context for this file.`);
            }
        }
    }
    // **END MODIFIED FILE READING LOGIC**

    if (!readableFilesFound && rawFilesList.length > 0) {
        console.warn(`${logPrefix} ⚠️ All specified responsible files/patterns were unreadable or yielded no files for task #${nextTask.id}. Proceeding without file context.`);
    } else if (rawFilesList.length === 0) {
        console.warn(`${logPrefix} ⚠️ No specific, valid responsible files listed for task #${nextTask.id}. Proceeding without specific file context.`);
    }


    // --- Generate Prompt for Gemini ---
    console.log(`${logPrefix} Generating prompt for Gemini...`);
    const prompt = generateDevelopmentPrompt(nextTask, codeContext);

    // --- Invoke Gemini Service ---
    console.log(`${logPrefix} Invoking Gemini service to implement task...`);
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.Develop, prompt);

    // --- Handle Result & Apply Changes ---
    if (result.type === 'error' || result.content === null) {
        throw new Error(`Gemini service failed for task #${nextTask.id}: ${result.content ?? 'No content returned'}`);
    }

    const geminiResponseContent = result.content;
    const fileHeaderRegex = /^\s*\/\/\s*File:\s*([^\s\n\r]+)\s*$/gm; // Global flag is important
    const fileMatches = Array.from(geminiResponseContent.matchAll(fileHeaderRegex));

    if (fileMatches.length === 0) {
        console.warn(`${logPrefix} ⚠️ Gemini response did not contain any recognizable '// File: ...' headers. Cannot apply changes automatically.`);
        console.log("\n--- Raw Gemini Response (Review Manually) ---");
        console.log(geminiResponseContent);
        console.log("--- End Raw Gemini Response ---");
        console.log(`\n${logPrefix} IMPORTANT: Apply changes manually and update the status of Task #${nextTask.id} in ${CHECKLIST_FILENAME}.`);
        return;
    }

    console.log(`\n${logPrefix} Attempting to apply changes to ${fileMatches.length} file(s)...`);
    let filesWritten = 0;
    let writeErrors = 0;

    for (let i = 0; i < fileMatches.length; i++) {
        const match = fileMatches[i];
        const relativeFilePath = match[1];
        const startIndex = match.index! + match[0].length;
        const endIndex = (i + 1 < fileMatches.length) ? fileMatches[i + 1].index! : geminiResponseContent.length;
        const codeContent = geminiResponseContent.substring(startIndex, endIndex).trim();

        if (!relativeFilePath || relativeFilePath.includes(' ') || !relativeFilePath.includes('/')) {
            console.warn(`${logPrefix} ⚠️ Skipping block due to potentially invalid file path extracted: ${relativeFilePath}`);
            continue;
        }

        const absoluteFilePath = path.resolve(projectRoot, relativeFilePath);

        if (!codeContent) {
            console.warn(`  ${logPrefix} ⚠️ Skipping empty content block for file: ${relativeFilePath}`);
            continue;
        }

        console.log(`  ${logPrefix} Writing changes to: ${relativeFilePath}`);
        try {
            const success = writeOutputFile(absoluteFilePath, codeContent);
            if (success) {
                filesWritten++;
            } else {
                console.error(`  ${logPrefix} ❌ Failed to write changes to ${relativeFilePath} (writeOutputFile returned false).`);
                writeErrors++;
            }
        } catch (e) {
            console.error(`  ${logPrefix} ❌ Error during file write operation for ${relativeFilePath}: ${e instanceof Error ? e.message : e}`);
            writeErrors++;
        }
    }

    console.log(`\n${logPrefix} --- Change Application Summary ---`);
    console.log(`  Files Identified in Response: ${fileMatches.length}`);
    console.log(`  Files Written Successfully:   ${filesWritten}`);
    console.log(`  Write Errors Encountered:     ${writeErrors}`);
    console.log(`----------------------------------`);

    console.log(`\n${logPrefix} IMPORTANT: Review the applied changes using 'git diff'. Manually update the status of Task #${nextTask.id} in ${CHECKLIST_FILENAME}.`);

    if (writeErrors > 0) {
        throw new Error(`${writeErrors} error(s) occurred while writing files during the Develop command.`);
    }
}