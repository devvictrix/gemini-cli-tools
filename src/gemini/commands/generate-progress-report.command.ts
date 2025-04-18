// File: src/gemini/commands/generate-progress-report.command.ts

import fs from 'fs';
import path from 'path';
import { CliArguments } from '@shared/types/app.type';
import { readSingleFile, writeOutputFile } from '@shared/utils/file-io.utils';
import { parseChecklistTable, extractCurrentPhase, ChecklistItem } from '@shared/utils/markdown.utils';
import { EnhancementType } from '@/gemini/types/enhancement.type';

const logPrefix = "[GenerateProgressReport]";
const REQUIREMENT_FILENAME = 'REQUIREMENT.md';
const CHECKLIST_FILENAME = 'REQUIREMENTS_CHECKLIST.md';
const TEMPLATE_FILENAME = 'PROGRESS_TEMPLATE.md'; // Assumes template exists in target

/**
 * Formats the date as YYYY_MM_DD.
 * @param date - The date object to format.
 * @returns The formatted date string.
 */
function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}_${month}_${day}`;
}

/**
 * Generates the PROGRESS-{date}.md file based on current project state.
 * Reads REQUIREMENT.md, REQUIREMENTS_CHECKLIST.md, and PROGRESS_TEMPLATE.md
 * from the target directory, fills the template, and writes the output.
 *
 * @param args - Command line arguments, expecting targetPath.
 * @returns Promise resolving when complete.
 * @throws Error on file access/parsing issues.
 */
export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.GenerateProgressReport) {
        throw new Error("Handler mismatch: Expected GenerateProgressReport command.");
    }

    const { targetPath, output } = args;
    const projectRoot = path.resolve(targetPath);

    console.log(`\n${logPrefix} Generating progress report for project at: ${projectRoot}`);

    // --- Read Input Files ---
    let requirementContent: string;
    let checklistContent: string;
    let templateContent: string;
    const requirementPath = path.join(projectRoot, REQUIREMENT_FILENAME);
    const checklistPath = path.join(projectRoot, CHECKLIST_FILENAME);
    const templatePath = path.join(projectRoot, TEMPLATE_FILENAME); // Assume template is in target root

    try {
        if (!fs.statSync(projectRoot).isDirectory()) {
            throw new Error("Target path must be a directory.");
        }
        console.log(`${logPrefix} Reading input files...`);
        requirementContent = readSingleFile(requirementPath);
        checklistContent = readSingleFile(checklistPath);
        templateContent = readSingleFile(templatePath);
    } catch (e) {
        throw new Error(`Failed to access project root or required files (${REQUIREMENT_FILENAME}, ${CHECKLIST_FILENAME}, ${TEMPLATE_FILENAME}): ${e instanceof Error ? e.message : e}`);
    }

    // --- Parse Data ---
    console.log(`${logPrefix} Parsing requirement and checklist data...`);
    const currentPhase = extractCurrentPhase(requirementContent);
    const checklistItems = parseChecklistTable(checklistContent);

    if (!currentPhase) {
        console.warn(`${logPrefix} ⚠️ Could not determine current phase from ${REQUIREMENT_FILENAME}. Report phase will be placeholder.`);
        // Allow continuation with placeholders, or throw error if phase is critical
        // throw new Error(`Could not determine current phase from ${REQUIREMENT_FILENAME}.`);
    }
    if (checklistItems.length === 0) {
        console.warn(`${logPrefix} ⚠️ Failed to parse any items from ${CHECKLIST_FILENAME}. Report sections will be empty.`);
        // Allow continuation, report will be mostly placeholders
    }

    // --- Calculate Progress & Gather Sections ---
    console.log(`${logPrefix} Calculating progress and gathering report sections...`);
    const totalItems = checklistItems.length;
    const doneItems = checklistItems.filter(item => item.status.toLowerCase() === 'done').length;
    const completionPercent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    const phaseIdentifier = currentPhase ? `P${currentPhase.number}` : 'Unknown';
    const currentPhaseName = currentPhase ? currentPhase.name : 'Unknown Phase';
    const currentPhaseTasks = checklistItems.filter(item => item.targetPhase === phaseIdentifier);

    // Recent Achievements: List 'Done' and 'Needs Review' items (Simplified approach)
    // A more complex approach would compare against a previous report.
    const recentAchievements = checklistItems
        .filter(item => ['done', 'needs review'].includes(item.status.toLowerCase()))
        .map(item => `*   **Requirement #[${item.id}]:** ${item.description} - Status: ${item.status}`)
        .join('\n') || '*   *(No items marked Done or Needs Review)*';

    // Current Focus & Next Steps: List 'In Progress', then top 'Not Started' in current phase
    const inProgressItems = currentPhaseTasks.filter(item => item.status.toLowerCase() === 'in progress');
    let nextStepsItems = currentPhaseTasks
        .filter(item => item.status.toLowerCase() === 'not started')
        // Optional: Sort by priority if available, otherwise by ID
        .sort((a, b) => (a.priority === 'Critical' ? -1 : 1) - (b.priority === 'Critical' ? -1 : 1) || a.id.localeCompare(b.id))
        .slice(0, 2); // Take top 1-2 'Not Started'

    const currentFocusList = inProgressItems
        .map(item => `*   **Requirement #[${item.id}]:** ${item.description} - Status: In Progress`)
        .join('\n');

    const nextStepsList = nextStepsItems
        .map(item => `*   **Requirement #[${item.id}]:** ${item.description} - Status: Not Started (Next Priority)`)
        .join('\n');

    let currentFocusContent = currentFocusList;
    if (currentFocusList && nextStepsList) {
        currentFocusContent += '\n' + nextStepsList;
    } else if (!currentFocusList && nextStepsList) {
        currentFocusContent = nextStepsList;
    } else if (!currentFocusList && !nextStepsList) {
        currentFocusContent = '*   *(No tasks In Progress or prioritized as Next)*';
    }


    // Blockers & Challenges: List items marked 'Blocked'
    const blockedItems = checklistItems
        .filter(item => item.status.toLowerCase() === 'blocked')
        .map(item => `*   **Blocker:** Item status is 'Blocked' - Affects: Requirement #[${item.id}] - ${item.description}`)
        .join('\n') || '*   *No major blockers identified in checklist.*';

    // Key Decisions / Design Notes (Placeholder - requires manual input or other sources)
    const keyDecisions = '*   *(Requires manual input or integration with ADRs/commit logs)*';

    // Areas for AI Assistance (Placeholder)
    const aiAssistance = '*   *(Specify areas where AI help might be needed, e.g., "Review error handling logic.")*';

    // --- Fill Template ---
    console.log(`${logPrefix} Filling progress report template...`);
    const today = new Date();
    const formattedDate = formatDate(today);
    const previousDatePlaceholder = '{yyyy_mm_dd_previous}'; // Placeholder for previous date

    let reportContent = templateContent;
    reportContent = reportContent.replace('{yyyy_mm_dd}', formattedDate);
    reportContent = reportContent.replace('{CurrentPhaseNumber}', currentPhase ? String(currentPhase.number) : 'N/A');
    reportContent = reportContent.replace('{Phase Name}', currentPhaseName);
    reportContent = reportContent.replace('XX%', `${completionPercent}%`); // Replace completion percentage
    reportContent = reportContent.replace('XX%', `${completionPercent}%`); // Replace again in summary line
    reportContent = reportContent.replace('{yyyy_mm_dd_previous}', `*Date of Last Report Not Automatically Determined*`); // Placeholder
    reportContent = reportContent.replace(/\{Requirement Description Snippet\}.*Done\/Needs Review.*?(\n|$)/g, recentAchievements + '\n'); // Replace achievements section
    reportContent = reportContent.replace(/\{Requirement Description Snippet\}.*In Progress.*?(\n|$)/g, ''); // Clear specific in-progress lines
    reportContent = reportContent.replace(/\{Requirement Description Snippet\}.*Not Started.*?(\n|$)/g, ''); // Clear specific not-started lines
    reportContent = reportContent.replace(/\{Task\}:.*?(\n|$)/g, ''); // Clear specific task lines
    // Add the combined current focus and next steps content (ensure placeholder removal handles multi-line)
    reportContent = reportContent.replace(/(\*   \*\*Requirement #\[Checklist #\]:.*?(\n|$))+(\*   \*\*Task\*\*:.*?(\n|$))?/, currentFocusContent + '\n');
    reportContent = reportContent.replace(/\{Description of blocker\}.*?(\n|$)/g, blockedItems + '\n'); // Replace blockers section
    reportContent = reportContent.replace(/\{Description, e\.g\..*?(\n|$)/g, keyDecisions + '\n'); // Replace decisions section
    reportContent = reportContent.replace(/\{Note, e\.g\..*?(\n|$)/g, ''); // Remove second decision line placeholder
    reportContent = reportContent.replace(/\*   \*Example:.*?(\n|$)/g, aiAssistance + '\n'); // Replace AI assistance section


    // --- Write Output File ---
    const defaultOutputFilename = `PROGRESS-${formattedDate}.md`;
    const outputFilename = typeof output === 'string' && output.trim() !== '' ? output : defaultOutputFilename;
    const outputFilePath = path.resolve(projectRoot, outputFilename); // Write to target project root

    console.log(`${logPrefix} Writing progress report to: ${outputFilename}`);
    const success = writeOutputFile(outputFilePath, reportContent);

    if (!success) {
        throw new Error(`Failed to write progress report file to ${outputFilename}.`);
    }

    console.log(`\n${logPrefix} ✅ Successfully generated progress report: ${outputFilename}`);
}