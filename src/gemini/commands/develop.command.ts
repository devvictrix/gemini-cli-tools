// src/gemini/commands/develop.command.ts

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { CliArguments } from '@shared/types/app.type';
import { readSingleFile, writeOutputFile } from '@shared/utils/file-io.utils';
// Import the NEW roadmap parser (we'll define this next)
import { parseRoadmapTable, RoadmapItem } from '@shared/utils/roadmap.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';

const logPrefix = "[Develop]";
// Define the new roadmap filename constant
const ROADMAP_FILENAME = 'FEATURE_ROADMAP.md';

/**
 * Generates a detailed prompt for the Gemini API to implement a development task
 * using information from the RoadmapItem.
 *
 * @param task - The RoadmapItem representing the task to implement.
 * @param codeContext - A string containing the code from relevant files, with file path headers.
 * @returns The generated prompt string.
 */
function generateDevelopmentPrompt(task: RoadmapItem, codeContext: string): string {
    let fileContextSection = "No specific code context provided. Implement based on the task description.";
    if (codeContext.trim()) {
        fileContextSection = `Here is the current content of the relevant file(s):\n\n${codeContext}\n`;
    }

    // Using fields from RoadmapItem interface
    return `
You are an AI programming assistant. Your task is to implement the following feature/requirement based on the provided roadmap details and code context.

**Roadmap Item Details:**
- **Version:** ${task.version || 'N/A'}
- **Milestone:** ${task.milestone || 'N/A'}
- **Feature:** ${task.feature || 'N/A'}
- **Description:** ${task.description}
- **Responsible File(s):** ${task.responsibleFiles?.join(', ') || 'N/A (Tool assumes this column exists)'}
- **Priority:** ${task.priority || 'N/A'}
- **Status:** ${task.status}

**Current Code Context:**
${fileContextSection}

**Instructions:**
1.  Carefully read the feature description and acceptance criteria (if available in description).
2.  Analyze the provided code context from the responsible file(s) (if provided).
3.  Implement the required changes directly into the code.
4.  **CRITICAL:** Respond with the **ENTIRE modified content** for each file that was changed. If a file listed as responsible was NOT changed, do NOT include it in the response.
5.  **CRITICAL:** If you modify one or more files, you MUST precede the complete content of each modified file with a header comment line exactly like this: \`// File: path/to/the/file.ext\` (using the correct relative path).
6.  Ensure the returned code is complete and syntactically correct for the entire file.
7.  Do NOT include any explanations, introductions, summaries, or markdown formatting (like \`\`\`) outside the code content itself. Respond ONLY with the file header comments and the complete code for each modified file.

Implement the requirement and provide the full modified file content(s) now.
`;
}

/**
 * Selects the next task from the roadmap based on status and priority.
 * Priority Order: P0 > P1 > P2 ...
 * Status Order: In Progress > Not Started
 */
function selectNextTask(items: RoadmapItem[]): RoadmapItem | null {
    const pendingItems = items.filter(item =>
        item.status && /^(Not Started|In Progress)/i.test(item.status)
    );

    if (pendingItems.length === 0) {
        return null;
    }

    pendingItems.sort((a, b) => {
        // 1. Prioritize "In Progress" over "Not Started"
        const statusA = /In Progress/i.test(a.status) ? 0 : 1;
        const statusB = /In Progress/i.test(b.status) ? 0 : 1;
        if (statusA !== statusB) {
            return statusA - statusB;
        }

        // 2. Prioritize by P-level (lower number is higher priority)
        const priorityA = parseInt((a.priority || 'P99').replace('P', ''), 10);
        const priorityB = parseInt((b.priority || 'P99').replace('P', ''), 10);
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        // 3. Fallback to order in the file (approximated by index, though parse order isn't guaranteed)
        return 0; // Keep original order if priority and status are the same
    });

    return pendingItems[0];
}


export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.Develop) {
        throw new Error("Handler mismatch: Expected Develop command.");
    }

    const { targetPath } = args;
    const projectRoot = path.resolve(targetPath);

    console.log(`\n${logPrefix} Starting development cycle for project at: ${projectRoot}`);

    // --- Read and Parse ROADMAP.md ---
    let roadmapContent: string;
    const roadmapPath = path.join(projectRoot, ROADMAP_FILENAME);

    try {
        if (!fs.statSync(projectRoot).isDirectory()) {
            throw new Error("Target path must be a directory.");
        }
        console.log(`${logPrefix} Reading roadmap file: ${ROADMAP_FILENAME}...`);
        roadmapContent = readSingleFile(roadmapPath);
    } catch (e) {
        throw new Error(`Failed to access project root or required file (${ROADMAP_FILENAME}): ${e instanceof Error ? e.message : e}`);
    }

    console.log(`${logPrefix} Parsing roadmap table...`);
    // Use the NEW roadmap parser function
    const roadmapItems = parseRoadmapTable(roadmapContent);
    if (roadmapItems.length === 0) {
        // The parser should log specific errors
        throw new Error(`Failed to parse any valid items from ${ROADMAP_FILENAME}. Check table format and column headers.`);
    }

    // --- Find Next Task ---
    console.log(`${logPrefix} Selecting next task from roadmap...`);
    const nextTask = selectNextTask(roadmapItems);

    if (!nextTask) {
        console.log(`\n${logPrefix} ✅ No actionable tasks (Not Started or In Progress) found in ${ROADMAP_FILENAME}.`);
        return; // Nothing to do
    }
    console.log(`${logPrefix} Selected Task -> Feature: ${nextTask.feature || 'N/A'} (Priority: ${nextTask.priority || 'N/A'}, Status: ${nextTask.status})`);
    console.log(`${logPrefix}   Description: ${nextTask.description}`);
    // Ensure responsibleFiles exists (needs to be added to RoadmapItem and parsed)
    const responsibleFilesList = nextTask.responsibleFiles || [];
    console.log(`${logPrefix}   Responsible Files: ${responsibleFilesList.join(', ') || '⚠️ None Specified!'}`);

    // --- Gather Context (Read Relevant Files) ---
    let codeContext = '';
    let readableFilesFound = false;
    const processedFilePaths = new Set<string>();

    // Use the responsibleFilesList from the parsed roadmap item
    const filesAndPatterns = responsibleFilesList
        .map(f => f.trim()) // Basic trim
        .filter(f => f);    // Filter empty entries

    if (filesAndPatterns.length === 0) {
        console.warn(`${logPrefix} ⚠️ No responsible files listed for the selected task in ${ROADMAP_FILENAME}. Proceeding without specific file context.`);
    } else {
        console.log(`${logPrefix} Reading content of relevant files/patterns...`);
        for (const fileOrPattern of filesAndPatterns) {
            let filesToProcess: string[] = [];
            if (fileOrPattern.includes('*')) {
                console.log(`  ${logPrefix} Expanding glob pattern: ${fileOrPattern}`);
                try {
                    filesToProcess = await glob(fileOrPattern, { cwd: projectRoot, nodir: true, absolute: true });
                    console.log(`    ${logPrefix} Found ${filesToProcess.length} file(s) matching glob.`);
                } catch (globError) {
                    console.warn(`${logPrefix} ⚠️ Error expanding glob pattern ${fileOrPattern}. Skipping. Error: ${globError instanceof Error ? globError.message : globError}`);
                    continue;
                }
            } else {
                filesToProcess.push(path.resolve(projectRoot, fileOrPattern));
            }

            for (const absoluteFilePath of filesToProcess) {
                if (processedFilePaths.has(absoluteFilePath)) continue;
                processedFilePaths.add(absoluteFilePath);
                const friendlyPath = path.relative(projectRoot, absoluteFilePath).split(path.sep).join('/');
                try {
                    const fileContent = readSingleFile(absoluteFilePath);
                    codeContext += `// File: ${friendlyPath}\n\n${fileContent}\n\n---\n\n`;
                    readableFilesFound = true;
                    console.log(`    ${logPrefix} Read context from: ${friendlyPath}`);
                } catch (e) {
                    console.warn(`${logPrefix} ⚠️ Failed to read ${friendlyPath}. Skipping context for this file.`);
                }
            }
        }

        if (!readableFilesFound && filesAndPatterns.length > 0) {
            console.warn(`${logPrefix} ⚠️ All specified responsible files/patterns were unreadable or yielded no files. Proceeding without file context.`);
        }
    }

    // --- Generate Prompt for Gemini ---
    console.log(`${logPrefix} Generating prompt for Gemini...`);
    const prompt = generateDevelopmentPrompt(nextTask, codeContext);

    // --- Invoke Gemini Service ---
    console.log(`${logPrefix} Invoking Gemini service to implement task...`);
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.Develop, prompt);

    // --- Handle Result & Apply Changes ---
    if (result.type === 'error' || result.content === null) {
        throw new Error(`Gemini service failed for task "${nextTask.feature || nextTask.description}": ${result.content ?? 'No content returned'}`);
    }

    const geminiResponseContent = result.content;
    const fileHeaderRegex = /^\s*\/\/\s*File:\s*([^\s\n\r]+)\s*$/gm;
    const fileMatches = Array.from(geminiResponseContent.matchAll(fileHeaderRegex));

    if (fileMatches.length === 0) {
        console.warn(`${logPrefix} ⚠️ Gemini response did not contain any recognizable '// File: ...' headers. Cannot apply changes automatically.`);
        console.log("\n--- Raw Gemini Response (Review Manually) ---");
        console.log(geminiResponseContent);
        console.log("--- End Raw Gemini Response ---");
        console.log(`\n${logPrefix} IMPORTANT: Apply changes manually and update the status for "${nextTask.feature || nextTask.description}" in ${ROADMAP_FILENAME}.`);
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

        if (!relativeFilePath || !relativeFilePath.includes('/')) {
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

    console.log(`\n${logPrefix} IMPORTANT: Review the applied changes using 'git diff'. Manually update the status for "${nextTask.feature || nextTask.description}" in ${ROADMAP_FILENAME}.`);

    if (writeErrors > 0) {
        throw new Error(`${writeErrors} error(s) occurred while writing files during the Develop command.`);
    }
}