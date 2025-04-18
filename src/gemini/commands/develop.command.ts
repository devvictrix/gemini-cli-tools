// src/gemini/commands/develop.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '@shared/types/app.type'; // Assuming this type includes command, targetPath etc.
import { readSingleFile, writeOutputFile } from '@shared/utils/file-io.utils';
import { parseChecklistTable, extractCurrentPhase, ChecklistItem } from '@shared/utils/markdown.utils'; // Use the markdown util
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';

const logPrefix = "[Develop]";
const REQUIREMENT_FILENAME = 'REQUIREMENT.md';
const CHECKLIST_FILENAME = 'REQUIREMENTS_CHECKLIST.md';

/**
 * Generates a detailed prompt for the Gemini API to implement a development task,
 * instructing it to return the full modified file content.
 *
 * @param task - The checklist item representing the task to implement.
 * @param codeContext - A string containing the code from relevant files, with file path headers.
 * @returns The generated prompt string.
 */
function generateDevelopmentPrompt(task: ChecklistItem, codeContext: string): string {
    let fileContextSection = "No specific code context provided. Implement based on the task description.";
    if (codeContext.trim()) {
        // Ensure context is wrapped correctly, even if it's multi-file
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

/**
 * Executes the Develop command.
 * 1. Reads REQUIREMENT.md to find the current phase.
 * 2. Reads REQUIREMENTS_CHECKLIST.md to find the next task (In Progress or Not Started).
 * 3. Reads the content of files relevant to the task.
 * 4. Prompts Gemini to implement the task and return the full modified file content(s).
 * 5. Parses Gemini's response based on '// File: ...' headers.
 * 6. Writes the modified content back to the respective files, overwriting them.
 *
 * @param args - The command line arguments, expecting targetPath to be the project root.
 * @returns A promise that resolves when the process is complete.
 * @throws Error if files are missing, parsing fails, no task is found, Gemini fails, or file writing fails.
 */
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
        requirementContent = readSingleFile(requirementPath); // Use shared util
        checklistContent = readSingleFile(checklistPath);   // Use shared util
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

    // Prioritize 'In Progress', then 'Not Started' within the current phase
    let nextTask = phaseTasks.find(item => item.status.toLowerCase() === 'in progress');
    if (!nextTask) {
        nextTask = phaseTasks.find(item => item.status.toLowerCase() === 'not started');
    }

    if (!nextTask) {
        console.log(`\n${logPrefix} ✅ No pending tasks found for the current phase (${currentPhaseIdentifier}). Check checklist or advance phase in ${REQUIREMENT_FILENAME}.`);
        return; // Nothing to do for this phase
    }
    console.log(`${logPrefix} Selected Task #${nextTask.id}: ${nextTask.description}`);
    console.log(`${logPrefix}   Status: ${nextTask.status}, Files: ${nextTask.responsibleFiles.join(', ')}`);

    // --- Gather Context (Read Relevant Files) ---
    let codeContext = '';
    let filesToRead = nextTask.responsibleFiles.filter(f => f && f.toLowerCase() !== 'all files'); // Filter out empty strings and "All files"

    if (nextTask.responsibleFiles.some(f => f && f.toLowerCase() === 'all files')) {
        console.warn(`${logPrefix} ⚠️ Task lists 'All files'. This is ambiguous. Proceeding based on task description only. Consider specifying files in the checklist.`);
        // Optionally: Add consolidation logic here if 'All files' should mean full project context
        // try {
        //    codeContext = await getConsolidatedSources(projectRoot); // Be careful with large projects
        // } catch (consolidationError) {
        //    console.error(`${logPrefix} Error consolidating project for 'All files' context:`, consolidationError);
        //    // Decide whether to proceed without context or throw error
        // }
        filesToRead = []; // Don't try to read specific files if 'All files' is present
    }

    if (filesToRead.length === 0 && !nextTask.responsibleFiles.some(f => f && f.toLowerCase() === 'all files')) {
        console.warn(`${logPrefix} ⚠️ No specific, valid responsible files listed for task #${nextTask.id}. Proceeding without specific file context.`);
    } else if (filesToRead.length > 0) {
        console.log(`${logPrefix} Reading content of relevant files...`);
        let readableFilesFound = false;
        for (const relativeFilePath of filesToRead) {
            const absoluteFilePath = path.resolve(projectRoot, relativeFilePath); // Resolve relative to project root
            const friendlyPath = relativeFilePath.split(path.sep).join('/'); // For comments/logging
            try {
                const fileContent = readSingleFile(absoluteFilePath);
                // Add file path comments for Gemini context
                codeContext += `// File: ${friendlyPath}\n\n${fileContent}\n\n---\n\n`; // Separator helps AI
                readableFilesFound = true;
            } catch (e) {
                // Log specific error from readSingleFile (which includes path)
                console.warn(`${logPrefix} ⚠️ Could not read file: ${friendlyPath}. Skipping. Error: ${e instanceof Error ? e.message : e}`);
                // Continue, Gemini might still work with partial context.
            }
        }
        if (!readableFilesFound) {
            console.warn(`${logPrefix} ⚠️ All specified responsible files were unreadable for task #${nextTask.id}. Proceeding without file context.`);
        }
    }

    // --- Generate Prompt for Gemini ---
    console.log(`${logPrefix} Generating prompt for Gemini...`);
    const prompt = generateDevelopmentPrompt(nextTask, codeContext);

    // --- Invoke Gemini Service ---
    console.log(`${logPrefix} Invoking Gemini service to implement task...`);
    // Use 'Develop' type conceptually, but pass the fully generated prompt
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.Develop, prompt);

    // --- Handle Result & Apply Changes ---
    if (result.type === 'error' || result.content === null) {
        throw new Error(`Gemini service failed for task #${nextTask.id}: ${result.content ?? 'No content returned'}`);
    }

    const geminiResponseContent = result.content;

    // Regex to find file headers. Use 'm' flag for multiline.
    // Matches "// File:", optional whitespace, the path, optional whitespace, newline.
    // Captures the path in group 1.
    const fileHeaderRegex = /^\s*\/\/\s*File:\s*([^\s\n\r]+)\s*$/m;

    // Split the response by the file header. `split` with a capturing group includes the delimiter
    // in the results, but it's complex. A simpler approach is to find all headers,
    // then extract content between them.
    const fileMatches = Array.from(geminiResponseContent.matchAll(fileHeaderRegex));

    if (fileMatches.length === 0) {
        console.warn(`${logPrefix} ⚠️ Gemini response did not contain any recognizable '// File: ...' headers. Cannot apply changes automatically.`);
        console.log("\n--- Raw Gemini Response (Review Manually) ---");
        console.log(geminiResponseContent);
        console.log("--- End Raw Gemini Response ---");
        // Reminder for manual update
        console.log(`\n${logPrefix} IMPORTANT: Apply changes manually and update the status of Task #${nextTask.id} in ${CHECKLIST_FILENAME}.`);
        return; // Exit without throwing error, but indicate manual action needed
    }

    console.log(`\n${logPrefix} Attempting to apply changes to ${fileMatches.length} file(s)...`);
    let filesWritten = 0;
    let writeErrors = 0;

    for (let i = 0; i < fileMatches.length; i++) {
        const match = fileMatches[i];
        const relativeFilePath = match[1]; // Captured path
        const startIndex = match.index! + match[0].length; // Start content after the header line
        const endIndex = (i + 1 < fileMatches.length) ? fileMatches[i + 1].index! : geminiResponseContent.length; // End before next header or at end of string

        const codeContent = geminiResponseContent.substring(startIndex, endIndex).trim(); // Extract and trim whitespace

        // Basic validation of the path extracted
        if (!relativeFilePath || relativeFilePath.includes(' ') || !relativeFilePath.includes('/')) {
            console.warn(`${logPrefix} ⚠️ Skipping block due to potentially invalid file path extracted: ${relativeFilePath}`);
            continue;
        }

        const absoluteFilePath = path.resolve(projectRoot, relativeFilePath); // Resolve against project root

        if (!codeContent) {
            console.warn(`  ${logPrefix} ⚠️ Skipping empty content block for file: ${relativeFilePath}`);
            continue;
        }

        console.log(`  ${logPrefix} Writing changes to: ${relativeFilePath}`);
        try {
            // Use writeOutputFile which handles dir creation and replaces the file content
            const success = writeOutputFile(absoluteFilePath, codeContent);
            if (success) {
                filesWritten++;
            } else {
                // writeOutputFile should log the specific error internally
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

    // Reminder for manual update
    console.log(`\n${logPrefix} IMPORTANT: Review the applied changes using 'git diff'. Manually update the status of Task #${nextTask.id} in ${CHECKLIST_FILENAME}.`);

    if (writeErrors > 0) {
        // Throw error if any file writing failed, indicating overall failure
        throw new Error(`${writeErrors} error(s) occurred while writing files during the Develop command.`);
    }
}