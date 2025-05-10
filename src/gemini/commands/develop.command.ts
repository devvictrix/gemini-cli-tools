// File: src/gemini/commands/develop.command.ts

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { CliArguments } from '@shared/types/app.type';
import { readSingleFile, writeOutputFile } from '@shared/utils/file-io.utils';
import { parseRoadmapTable, RoadmapItem } from '@/shared/utils/feature-roadmap.utils';
import { enhanceCodeWithGemini, GeminiEnhancementResult } from '@/gemini/gemini.service';
import { EnhancementType } from '@/gemini/types/enhancement.type';
import { parseAiResponseWithFileHeaders, ExtractedFile } from '@/shared/utils/multi-file.parser'; // New import

const logPrefix = "[DevelopCmd]"; // Changed prefix for clarity
const ROADMAP_FILENAME = 'FEATURE_ROADMAP.md';

// Placeholder for actual user input mechanism (e.g., inquirer)
// For AI collaboration, we log the prompt and assume 'Y'
async function getUserConfirmation(promptMessage: string): Promise<boolean> {
    console.log(`${logPrefix} USER_PROMPT: ${promptMessage} [Y/n] (Assuming Y for now)`);
    return true; // Assume 'Yes' for automated flow
}

/**
 * Gathers content from specified files or glob patterns relative to a project root.
 *
 * @param projectRoot The absolute path to the project root.
 * @param filesAndPatterns An array of relative file paths or glob patterns.
 * @param fileTypeDescription Description of files being read (e.g., "responsible files", "test files").
 * @returns A promise that resolves to a string containing all file contents, each prefixed with "// File: <relativePath>".
 */
async function gatherFileContext(projectRoot: string, filesAndPatterns: string[], fileTypeDescription: string): Promise<string> {
    let context = '';
    const processedFilePaths = new Set<string>();

    if (!filesAndPatterns || filesAndPatterns.length === 0) {
        console.warn(`${logPrefix} No ${fileTypeDescription} listed. Proceeding without this specific file context.`);
        return context;
    }

    console.log(`${logPrefix} Reading content of ${fileTypeDescription}...`);
    for (const fileOrPattern of filesAndPatterns) {
        let filesToProcess: string[] = [];
        const resolvedFileOrPattern = path.isAbsolute(fileOrPattern) ? fileOrPattern : path.join(projectRoot, fileOrPattern);

        if (fileOrPattern.includes('*')) {
            console.log(`  ${logPrefix} Expanding glob pattern: ${fileOrPattern} (from root: ${projectRoot})`);
            try {
                // Glob expects patterns relative to cwd option if specified, or absolute
                filesToProcess = await glob(fileOrPattern, { cwd: projectRoot, nodir: true, absolute: true });
                console.log(`    ${logPrefix} Found ${filesToProcess.length} file(s) matching glob: ${filesToProcess.map(f => path.relative(projectRoot, f)).join(', ')}`);
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

            const relativePath = path.relative(projectRoot, absoluteFilePath).split(path.sep).join('/');
            try {
                if (fs.existsSync(absoluteFilePath) && fs.statSync(absoluteFilePath).isFile()) {
                    const fileContent = readSingleFile(absoluteFilePath);
                    context += `// File: ${relativePath}\n\n${fileContent}\n\n---\n\n`;
                    console.log(`    ${logPrefix} Read context from: ${relativePath}`);
                } else {
                    console.log(`    ${logPrefix} File not found or not a file (will be created if AI generates it): ${relativePath}`);
                    context += `// File: ${relativePath}\n\n// This file does not exist yet or is not a regular file.\n\n---\n\n`;
                }
            } catch (e) {
                // If readSingleFile throws (e.g. permission issues, or it's a dir mistaken for a file)
                console.warn(`${logPrefix} ⚠️ Failed to read ${relativePath}. Will treat as non-existent for context. Error: ${e instanceof Error ? e.message : String(e)}`);
                context += `// File: ${relativePath}\n\n// This file could not be read.\n\n---\n\n`;
            }
        }
    }
    return context;
}

/**
 * Generates a prompt for the Gemini API to create unit tests for a feature. (ADR-001)
 */
function generateTestGenerationPrompt(task: RoadmapItem, responsibleFileContext: string, existingTestFileContext: string, targetTestingFramework: string = 'Jest'): string {
    return `
You are an AI programming assistant. Your task is to generate comprehensive unit tests for the following feature.

**Feature Details:**
- Feature: ${task.feature || 'N/A'}
- Description: ${task.description}
- Responsible File(s) for implementation: ${task.responsibleFiles?.join(', ') || 'N/A'}
- Target Test File(s): ${task.testFilePaths?.join(', ') || 'N/A. Infer path based on responsible files if possible (e.g., src/math.ts -> tests/math.test.ts).'}

**Existing Code Context (Responsible Files - for reference):**
${responsibleFileContext.trim() || '// No existing code provided for responsible files.'}

**Existing Test Context (Test Files - if any to supplement):**
${existingTestFileContext.trim() || '// No existing test code provided.'}

**Instructions for Test Generation:**
1.  Generate comprehensive unit tests for the feature: "${task.feature}".
2.  The tests should be written for the ${targetTestingFramework} framework.
3.  Ensure tests cover main success paths, edge cases, and error conditions described or implied by the feature.
4.  The primary goal is to create tests that will initially FAIL because the feature code is not yet written or is incomplete.
5.  **CRITICAL:** Output the complete test code.
    - If generating code for multiple test files, or modifying existing ones, ensure each file's content is preceded by a \`// File: path/to/test/file.ext\` header.
    - The 'path/to/test/file.ext' MUST be relative to the project root.
    - Base the test file paths on the "Target Test File(s)" listed above. If a specific path is not listed but implied (e.g., for a new feature), create a standard test path (e.g., \`tests/module/feature.test.ts\`).
6.  Do NOT include any explanations, introductions, summaries, or markdown formatting (like \`\`\`) outside the code content itself. Respond ONLY with the file header comments and the complete code for each test file.

Generate the unit tests now.
`;
}

/**
 * Generates a prompt for the Gemini API to implement code to pass given tests. (ADR-001)
 */
function generateCodeImplementationPrompt(task: RoadmapItem, failingTestData: string, responsibleFileContext: string): string {
    return `
You are an AI programming assistant. Your task is to write the minimal production code to make the provided (and currently failing) unit tests pass for the following feature.

**Feature Details:**
- Feature: ${task.feature || 'N/A'}
- Description: ${task.description}
- Responsible File(s) for implementation: ${task.responsibleFiles?.join(', ') || 'N/A. Write code in these files.'}

**Failing Test Code (and potentially test output/errors):**
${failingTestData.trim()}

**Existing Code Context (Responsible Files - to be modified/added to):**
${responsibleFileContext.trim() || '// No existing code provided for responsible files. Implement the feature in the specified file(s).'}

**Instructions for Code Implementation:**
1.  Analyze the feature description and the provided failing test code.
2.  Write the minimal production code in the "Responsible File(s)" (listed above) to make these tests pass.
3.  Focus on fulfilling the requirements explicitly shown in the tests and the feature description.
4.  If a "Responsible File" does not exist, create it with the necessary code.
5.  **CRITICAL:** Output the complete modified code for each responsible file.
    - Each file's content MUST be preceded by a \`// File: path/to/source/file.ext\` header.
    - The 'path/to/source/file.ext' MUST be relative to the project root. These should match the "Responsible File(s)" from the feature details.
6.  Do NOT include any explanations, introductions, summaries, or markdown formatting (like \`\`\`) outside the code content itself. Respond ONLY with the file header comments and the complete code for each modified source file.

Implement the production code now.
`;
}


/**
 * Selects the next task from the roadmap based on status and priority.
 * Priority Order: P0 > P1 > P2 ...
 * Status Order: In Progress > Not Started
 */
function selectNextTask(items: RoadmapItem[]): RoadmapItem | null {
    const pendingItems = items.filter(item =>
        item.status && /^(Not Started|In Progress|TDD - Test Generation|TDD - Code Implementation)/i.test(item.status) // Added TDD states
    );

    if (pendingItems.length === 0) {
        return null;
    }

    pendingItems.sort((a, b) => {
        // Define order for TDD states
        const statusOrder: { [key: string]: number } = {
            "TDD - Code Implementation": 0, // Highest priority among pending
            "TDD - Test Generation": 1,
            "In Progress": 2, // General In Progress
            "Not Started": 3,
        };

        const getStatusOrder = (status: string): number => {
            for (const key in statusOrder) {
                if (status.toLowerCase().includes(key.toLowerCase())) return statusOrder[key];
            }
            return 99; // Should not happen if filtered correctly
        };

        const statusAOrder = getStatusOrder(a.status);
        const statusBOrder = getStatusOrder(b.status);

        if (statusAOrder !== statusBOrder) {
            return statusAOrder - statusBOrder;
        }

        const priorityA = parseInt((a.priority || 'P99').replace('P', ''), 10);
        const priorityB = parseInt((b.priority || 'P99').replace('P', ''), 10);
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        return 0; // Keep original order if all else is equal
    });

    return pendingItems[0];
}

async function processAndWriteFiles(
    projectRoot: string,
    aiResponseContent: string,
    expectedFilePaths: string[], // From roadmap (testFilePaths or responsibleFiles)
    fileTypeDescription: "test" | "source"
): Promise<{ success: boolean, writtenFiles: string[], actualFileContext: string }> {
    const parsedFiles = parseAiResponseWithFileHeaders(aiResponseContent);
    let allWritesSuccessful = true;
    const writtenFilesPaths: string[] = [];
    let actualFileContext = ""; // To capture the content of files AI actually produced

    if (parsedFiles.length === 0) {
        console.warn(`${logPrefix} ⚠️ AI response did not contain any recognizable '// File: ...' headers for ${fileTypeDescription} files. Cannot apply changes automatically.`);
        console.log("\n--- Raw Gemini Response (Review Manually) ---");
        console.log(aiResponseContent.substring(0, 1000) + (aiResponseContent.length > 1000 ? "..." : ""));
        console.log("--- End Raw Gemini Response ---");
        return { success: false, writtenFiles: [], actualFileContext };
    }

    console.log(`\n${logPrefix} Attempting to apply changes to ${parsedFiles.length} ${fileTypeDescription} file(s) from AI response...`);

    // Create a set of expected absolute paths for quick lookup
    const expectedAbsolutePaths = new Set(
        expectedFilePaths.map(p => path.resolve(projectRoot, p.trim()))
    );

    for (const extractedFile of parsedFiles) {
        const { filePath: relativeFilePathFromAI, content } = extractedFile;
        const absoluteFilePath = path.resolve(projectRoot, relativeFilePathFromAI);

        // Validate if the AI-provided path is among the expected paths (more crucial for source files)
        // For test files, AI might create a new one if not specified, which could be acceptable.
        // ADR-001: "Validate that AI-provided file paths match the Test File Path(s) from the roadmap."
        // ADR-001: "Validate that AI-provided file paths match the Responsible File(s) from the roadmap."
        let pathIsValid = false;
        if (expectedFilePaths.length > 0) {
            // Check if the AI path (relative to projectRoot) is in the expected list (also relative)
            const normalizedAiPath = path.normalize(relativeFilePathFromAI).split(path.sep).join('/');
            pathIsValid = expectedFilePaths.some(expectedRelPath => {
                const normalizedExpectedPath = path.normalize(expectedRelPath.trim()).split(path.sep).join('/');
                return normalizedAiPath === normalizedExpectedPath;
            });

            if (!pathIsValid) {
                // Check if any glob pattern in expectedFilePaths matches the AI path
                for (const pattern of expectedFilePaths) {
                    if (pattern.includes('*')) {
                        // This is a simplified glob check, for more complex globs, a library might be better
                        const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
                        if (regex.test(normalizedAiPath)) {
                            pathIsValid = true;
                            break;
                        }
                    }
                }
            }

            if (!pathIsValid) {
                console.warn(`${logPrefix} ⚠️ AI proposed writing to ${fileTypeDescription} file '${relativeFilePathFromAI}', which was not explicitly listed in roadmap's ${fileTypeDescription} files or matched by a glob. Expected: ${expectedFilePaths.join(', ')}. Skipping this file.`);
                allWritesSuccessful = false; // Consider this a failure in strict mode
                continue;
            }
        } else if (fileTypeDescription === "source") {
            // If expectedFilePaths is empty for source, it's an issue.
            console.warn(`${logPrefix} ⚠️ No 'Responsible File(s)' listed in roadmap, but AI attempted to write to '${relativeFilePathFromAI}'. Skipping.`);
            allWritesSuccessful = false;
            continue;
        } else {
            // For test files, if expectedFilePaths is empty, AI might be inferring path; allow for now.
            console.log(`${logPrefix} Info: No explicit 'Test File Path(s)' in roadmap. AI generated test for '${relativeFilePathFromAI}'.`);
            pathIsValid = true; // Allow it
        }


        if (!content.trim()) {
            console.warn(`  ${logPrefix} ⚠️ Skipping empty content block for ${fileTypeDescription} file: ${relativeFilePathFromAI}`);
            continue;
        }

        console.log(`  ${logPrefix} Writing ${fileTypeDescription} changes to: ${relativeFilePathFromAI}`);
        try {
            const success = writeOutputFile(absoluteFilePath, content);
            if (success) {
                writtenFilesPaths.push(relativeFilePathFromAI);
                actualFileContext += `// File: ${relativeFilePathFromAI}\n\n${content}\n\n---\n\n`;
            } else {
                console.error(`  ${logPrefix} ❌ Failed to write ${fileTypeDescription} changes to ${relativeFilePathFromAI} (writeOutputFile returned false).`);
                allWritesSuccessful = false;
            }
        } catch (e) {
            console.error(`  ${logPrefix} ❌ Error during file write operation for ${relativeFilePathFromAI}: ${e instanceof Error ? e.message : e}`);
            allWritesSuccessful = false;
        }
    }
    return { success: allWritesSuccessful, writtenFiles: writtenFilesPaths, actualFileContext };
}


export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.Develop) {
        throw new Error(`${logPrefix} Handler mismatch: Expected Develop command.`);
    }

    const { targetPath } = args;
    const projectRoot = path.resolve(targetPath);
    console.log(`\n${logPrefix} Starting TDD development cycle for project at: ${projectRoot}`);

    // --- 1. Initialization & Task Identification ---
    const roadmapPath = path.join(projectRoot, ROADMAP_FILENAME);
    let roadmapContent: string;
    try {
        if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
            throw new Error("Target path must be a directory and exist.");
        }
        console.log(`${logPrefix} Reading roadmap file: ${roadmapPath}...`);
        roadmapContent = readSingleFile(roadmapPath);
    } catch (e) {
        throw new Error(`${logPrefix} Failed to access project root or ${ROADMAP_FILENAME}: ${e instanceof Error ? e.message : e}`);
    }

    const roadmapItems = parseRoadmapTable(roadmapContent);
    if (roadmapItems.length === 0) {
        throw new Error(`${logPrefix} Failed to parse any valid items from ${ROADMAP_FILENAME}. Check table format and column headers like 'Status', 'Description', 'Responsible File(s)', 'Test File Path(s)'.`);
    }

    const currentTask = selectNextTask(roadmapItems);
    if (!currentTask) {
        console.log(`\n${logPrefix} ✅ No actionable tasks (Not Started, In Progress, or TDD states) found in ${ROADMAP_FILENAME}.`);
        return;
    }

    console.log(`${logPrefix} Selected Task -> Feature: ${currentTask.feature || 'N/A'} (Priority: ${currentTask.priority || 'N/A'}, Status: ${currentTask.status})`);
    console.log(`${logPrefix}   Description: ${currentTask.description}`);
    const responsibleFilesList = currentTask.responsibleFiles || [];
    const testFilePathsList = currentTask.testFilePaths || [];
    console.log(`${logPrefix}   Responsible File(s): ${responsibleFilesList.join(', ') || 'None Specified (Required for code implementation)'}`);
    console.log(`${logPrefix}   Test File Path(s): ${testFilePathsList.join(', ') || 'None Specified (Required for test generation)'}`);

    if (!await getUserConfirmation(`Develop this task: "${currentTask.feature || currentTask.description}"?`)) {
        console.log(`${logPrefix} Task development declined by user.`);
        return;
    }

    // --- 2. Test Generation (Red Phase) ---
    console.log(`\n${logPrefix} --- Entering Test Generation (Red) Phase ---`);
    if (!await getUserConfirmation(`Proceed to generate tests for '${currentTask.feature}'?`)) {
        console.log(`${logPrefix} Test generation skipped by user.`);
        return;
    }
    if (testFilePathsList.length === 0) {
        console.warn(`${logPrefix} ⚠️ No 'Test File Path(s)' specified in ${ROADMAP_FILENAME} for task '${currentTask.feature}'. Cannot automatically generate tests to specific files. AI will be asked to infer paths.`);
        // Proceed, but AI might create tests in unexpected places if not guided well.
    }

    const responsibleFileContext = await gatherFileContext(projectRoot, responsibleFilesList, "responsible files (for test context)");
    const existingTestFileContext = await gatherFileContext(projectRoot, testFilePathsList, "existing test files");

    const testGenPrompt = generateTestGenerationPrompt(currentTask, responsibleFileContext, existingTestFileContext);
    console.log(`${logPrefix} Invoking Gemini for test generation...`);
    const testGenResult: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.Develop, testGenPrompt); // Develop type uses full prompt

    if (testGenResult.type === 'error' || testGenResult.content === null) {
        throw new Error(`${logPrefix} Gemini service failed during test generation for task "${currentTask.feature}": ${testGenResult.content ?? 'No content returned'}`);
    }

    const { success: testsWrittenSuccess, writtenFiles: writtenTestFiles, actualFileContext: actualTestFileContext } = await processAndWriteFiles(
        projectRoot,
        testGenResult.content,
        testFilePathsList,
        "test"
    );

    if (!testsWrittenSuccess || writtenTestFiles.length === 0) {
        console.error(`${logPrefix} ❌ Test generation phase failed to write files or AI response was unparsable. Please review AI output and roadmap. Aborting.`);
        // ADR-001 implies DevLead runs tests. Here, if AI can't produce parsable tests, we should stop.
        return;
    }
    console.log(`${logPrefix} ✅ ${writtenTestFiles.length} test file(s) written: ${writtenTestFiles.join(', ')}`);
    console.log(`${logPrefix} IMPORTANT: Please run these tests. They are expected to FAIL. Confirm this before proceeding.`);

    // --- 3. Code Implementation (Green Phase) ---
    console.log(`\n${logPrefix} --- Entering Code Implementation (Green) Phase ---`);
    if (!await getUserConfirmation(`Tests written. Assuming they are failing as expected. Proceed to generate implementation for '${currentTask.feature}'?`)) {
        console.log(`${logPrefix} Code implementation skipped by user.`);
        return;
    }
    if (responsibleFilesList.length === 0) {
        console.error(`${logPrefix} ❌ No 'Responsible File(s)' specified in ${ROADMAP_FILENAME} for task '${currentTask.feature}'. Cannot proceed with code implementation. Update the roadmap.`);
        return;
    }

    // Context for code gen: feature desc, *actual content of generated tests*, existing responsible file content
    const codeGenPrompt = generateCodeImplementationPrompt(currentTask, actualTestFileContext, responsibleFileContext);
    console.log(`${logPrefix} Invoking Gemini for code implementation...`);
    const codeGenResult: GeminiEnhancementResult = await enhanceCodeWithGemini(EnhancementType.Develop, codeGenPrompt);

    if (codeGenResult.type === 'error' || codeGenResult.content === null) {
        throw new Error(`${logPrefix} Gemini service failed during code implementation for task "${currentTask.feature}": ${codeGenResult.content ?? 'No content returned'}`);
    }

    const { success: codeWrittenSuccess, writtenFiles: writtenSourceFiles } = await processAndWriteFiles(
        projectRoot,
        codeGenResult.content,
        responsibleFilesList,
        "source"
    );

    if (!codeWrittenSuccess || writtenSourceFiles.length === 0) {
        console.error(`${logPrefix} ❌ Code implementation phase failed to write files or AI response was unparsable. Please review AI output, roadmap, and test results.`);
        return;
    }
    console.log(`${logPrefix} ✅ ${writtenSourceFiles.length} source file(s) written: ${writtenSourceFiles.join(', ')}`);

    // --- 4. Conclusion ---
    console.log(`\n${logPrefix} --- TDD Cycle Concluded for Task: ${currentTask.feature} ---`);
    console.log(`${logPrefix} Files Modified/Created:`);
    writtenTestFiles.forEach(f => console.log(`  - Test: ${f}`));
    writtenSourceFiles.forEach(f => console.log(`  - Source: ${f}`));
    console.log(`\n${logPrefix} IMPORTANT:`);
    console.log(`  1. Run all tests for '${currentTask.feature}' again. They should now PASS.`);
    console.log(`  2. Review the generated code and tests carefully.`);
    console.log(`  3. Manually refactor if necessary.`);
    console.log(`  4. Manually update the status of "${currentTask.feature}" in ${ROADMAP_FILENAME} (e.g., to 'Needs Review' or 'Done').`);
    console.log(`${logPrefix} 'develop' command finished.`);
}