// File: src/gemini/commands/develop.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '@shared/types/app.type';
import { readSingleFile, writeOutputFile } from '@shared/utils/file-io.utils';
import { parseChecklistTable, extractCurrentPhase, ChecklistItem } from '@shared/utils/markdown.utils'; // Use the new util
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';
import { extractCodeBlock } from '@/gemini/utils/code.extractor';

const logPrefix = "[Develop]";
const REQUIREMENT_FILENAME = 'REQUIREMENT.md';
const CHECKLIST_FILENAME = 'REQUIREMENTS_CHECKLIST.md';

/**
 * Executes the Develop command.
 * 1. Reads REQUIREMENT.md to find the current phase.
 * 2. Reads REQUIREMENTS_CHECKLIST.md to find the next task (In Progress or Not Started).
 * 3. Reads the content of files relevant to the task.
 * 4. Prompts Gemini to implement the task based on the code context.
 * 5. Displays the suggested code changes from Gemini.
 *
 * @param args - The command line arguments, expecting targetPath to be the project root.
 * @returns A promise that resolves when the process is complete.
 * @throws Error if files are missing, parsing fails, no task is found, or Gemini fails.
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
    try {
        if (!fs.statSync(projectRoot).isDirectory()) {
            throw new Error("Target path must be a directory.");
        }
        const requirementPath = path.join(projectRoot, REQUIREMENT_FILENAME);
        const checklistPath = path.join(projectRoot, CHECKLIST_FILENAME);

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
    if (nextTask.responsibleFiles.length === 0) {
        console.warn(`${logPrefix} ⚠️ No responsible files listed for task #${nextTask.id}. Proceeding without file context.`);
    } else {
        console.log(`${logPrefix} Reading content of relevant files...`);
        for (const relativeFilePath of nextTask.responsibleFiles) {
            if (!relativeFilePath) continue; // Skip empty entries
            const absoluteFilePath = path.resolve(projectRoot, relativeFilePath); // Resolve relative to project root
            const friendlyPath = relativeFilePath.split(path.sep).join('/'); // For comments
            try {
                const fileContent = readSingleFile(absoluteFilePath);
                // Add file path comments for Gemini context
                codeContext += `// File: ${friendlyPath}\n\n${fileContent}\n\n`;
            } catch (e) {
                console.warn(`${logPrefix} ⚠️ Could not read file: ${friendlyPath}. Skipping. Error: ${e instanceof Error ? e.message : e}`);
                // Decide if this should be a fatal error or just a warning
                // For now, warn and continue, Gemini might still work with partial context.
            }
        }
        if (!codeContext.trim()) {
            console.warn(`${logPrefix} ⚠️ All responsible files were unreadable or empty for task #${nextTask.id}. Proceeding without file context.`);
        }
    }


    // --- Generate Prompt for Gemini ---
    console.log(`${logPrefix} Generating prompt for Gemini...`);
    const prompt = generateDevelopmentPrompt(nextTask, codeContext);

    // --- Invoke Gemini Service ---
    console.log(`${logPrefix} Invoking Gemini service to implement task...`);
    const result: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.Develop, prompt); // Using Develop type, but service needs prompt

    // --- Handle Result ---
    if (result.type === 'error' || result.content === null) {
        throw new Error(`Gemini service failed for task #${nextTask.id}: ${result.content ?? 'No content returned'}`);
    }

    // --- Display Suggested Changes ---
    // We will NOT automatically apply changes. Display them for review.
    console.log(`\n${logPrefix} --- 💡 Gemini Suggestions for Task #${nextTask.id} ---`);
    console.log(`--- Task Description: ${nextTask.description}`);
    console.log(`--- NOTE: Review these changes carefully and apply them manually to the relevant files. ---`);

    // Attempt to extract code blocks - this might need refinement if Gemini returns
    // explanations mixed with multiple code blocks.
    // For now, try extracting the first block, or just show the whole response.
    const extractedCode = extractCodeBlock(result.content);

    if (extractedCode) {
        console.log("\n```typescript\n" + extractedCode + "\n```\n");
        console.log(`--- Gemini suggested the code block above. You may need to integrate parts of it into the correct file(s): ${nextTask.responsibleFiles.join(', ')} ---`);
        // Advanced: Try to parse "// File: ..." comments within the response to show file-specific changes.
    } else {
        console.log("\n--- Raw Gemini Response ---");
        console.log(result.content);
        console.log("\n--- End Raw Gemini Response ---");
        console.log(`--- Could not automatically extract a code block. Please review the raw response above and apply necessary changes to: ${nextTask.responsibleFiles.join(', ')} ---`);
    }
    console.log(`${logPrefix} --- End Suggestions ---`);

    // Reminder for manual update
    console.log(`\n${logPrefix} IMPORTANT: After applying changes, manually update the status of Task #${nextTask.id} in ${CHECKLIST_FILENAME}.`);

}


/**
 * Generates a detailed prompt for the Gemini API to implement a development task.
 *
 * @param task - The checklist item representing the task to implement.
 * @param codeContext - A string containing the code from relevant files, with file path headers.
 * @returns The generated prompt string.
 */
function generateDevelopmentPrompt(task: ChecklistItem, codeContext: string): string {
    let fileContextSection = "No code context provided.";
    if (codeContext.trim()) {
        fileContextSection = `Here is the current content of the relevant file(s):\n\`\`\`typescript\n${codeContext}\n\`\`\``;
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
3.  Implement the required changes or additions directly into the code.
4.  If modifying existing code, clearly show the changes. If adding new code (e.g., a new function or file content), provide the complete new code block.
5.  Ensure the generated code adheres to standard TypeScript/JavaScript best practices and maintains consistency with the existing code style (if discernible).
6.  **Respond ONLY with the modified or new code block(s).**
7.  If you modify multiple files, include the \`// File: path/to/your/file.ts\` header before each respective code block in your response.
8.  Do not include any explanations, introductions, or summaries outside the code blocks themselves (use comments within the code if explanation is needed).

Implement the requirement now.
`;
}