// src/shared/utils/feature-roadmap.utils.ts

const logPrefix = "[RoadmapUtil]";

// Interface representing a row parsed from FEATURE_ROADMAP.md
export interface RoadmapItem {
    version?: string;
    milestone?: string;
    releaseDate?: string;
    lastUpdated?: string;
    status: string; // Essential
    progressPercent?: string;
    priority?: string; // Important for task selection
    epic?: string;
    okrGoal?: string;
    category?: string;
    feature?: string; // Important
    description: string; // Essential
    responsibleFiles?: string[]; // CRITICAL
    testFilePaths?: string[]; // CRITICAL for TDD flow
    dependencies?: string;
    acceptanceCriteria?: string;
    designSpecLink?: string;
}

// Finds the index of columns based on header text (case-insensitive, flexible matching)
function findColumnIndices(headerCells: string[]): { [key in keyof RoadmapItem]?: number } {
    const indices: { [key in keyof RoadmapItem]?: number } = {};
    const mapping: { [key: string]: keyof RoadmapItem } = {
        'version': 'version',
        'milestone': 'milestone',
        'release date': 'releaseDate',
        'last updated': 'lastUpdated',
        'status': 'status',
        'progress': 'progressPercent',
        'priority': 'priority',
        'epic': 'epic',
        'okr': 'okrGoal',
        'category': 'category',
        'feature': 'feature',
        'description': 'description',
        'responsible file(s)': 'responsibleFiles', // More specific matching
        'responsible files': 'responsibleFiles',   // Alias
        'test file path(s)': 'testFilePaths',    // More specific matching for new column
        'test file paths': 'testFilePaths',      // Alias
        'dependencies': 'dependencies',
        'acceptance criteria': 'acceptanceCriteria',
        'design spec link': 'designSpecLink',
    };

    headerCells.forEach((header, index) => {
        const lowerHeader = header.toLowerCase().trim();
        for (const key in mapping) {
            // Use a more robust check: if the lowerHeader *is* the key or starts with the key + common delimiters
            if (lowerHeader === key || lowerHeader.startsWith(key + ' ') || lowerHeader.startsWith(key + ':')) {
                if (indices[mapping[key]] === undefined) {
                    indices[mapping[key]] = index;
                }
            } else if (lowerHeader.includes(key)) { // Fallback to includes, but prefer exact/prefix match
                if (indices[mapping[key]] === undefined) {
                    indices[mapping[key]] = index;
                }
            }
        }
    });

    // Basic validation
    if (indices.status === undefined) console.error(`${logPrefix} 'Status' column not found in FEATURE_ROADMAP header.`);
    if (indices.description === undefined) console.error(`${logPrefix} 'Description' column not found in FEATURE_ROADMAP header.`);
    if (indices.responsibleFiles === undefined) console.warn(`${logPrefix} 'Responsible File(s)' column not found in FEATURE_ROADMAP header. Context gathering for code implementation will be affected.`);
    if (indices.testFilePaths === undefined) console.warn(`${logPrefix} 'Test File Path(s)' column not found in FEATURE_ROADMAP header. Context gathering for test generation will be affected.`);


    return indices;
}


export function parseRoadmapTable(markdownContent: string): RoadmapItem[] {
    const lines = markdownContent.split('\n');
    const items: RoadmapItem[] = [];
    let headerCells: string[] = [];
    let columnIndices: { [key in keyof RoadmapItem]?: number } = {};
    let headerFound = false;
    let separatorFound = false;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith('|') || !trimmedLine.endsWith('|')) {
            continue; // Skip non-table lines
        }

        const cells = trimmedLine.split('|').map(cell => cell.trim()).slice(1, -1); // Extract cells

        if (!headerFound) {
            if (cells.length > 3 && cells.some(h => /^(Feature|Status|Description|Responsible File\(s\)|Priority|Test File Path\(s\))/i.test(h.trim()))) {
                headerCells = cells;
                columnIndices = findColumnIndices(headerCells);
                if (columnIndices.status === undefined || columnIndices.description === undefined) {
                    console.error(`${logPrefix} Failed to find essential columns (Status, Description) in potential header: ${line}. Cannot parse feature-roadmap.`);
                    columnIndices = {}; // Reset and try next line
                    continue;
                }
                headerFound = true;
                console.log(`${logPrefix} Identified header row for FEATURE_ROADMAP.md. Mapped columns:`, columnIndices);
            }
            continue;
        }

        if (!separatorFound) {
            if (cells.length >= headerCells.length && cells.every(cell => cell.replace(/[:\- ]/g, '').trim() === '')) {
                separatorFound = true;
                continue;
            } else {
                console.warn(`${logPrefix} Table separator '---|---|...' not found or malformed after header in FEATURE_ROADMAP.md. Assuming this line is data.`);
                separatorFound = true;
                if (columnIndices.status === undefined || columnIndices.description === undefined) {
                    console.error(`${logPrefix} Could not reliably identify essential columns from header before processing data in FEATURE_ROADMAP.md. Cannot parse table.`);
                    return [];
                }
            }
        }

        if (!headerFound || !separatorFound) continue;

        if (cells.length !== headerCells.length) {
            console.warn(`${logPrefix} Skipping row in FEATURE_ROADMAP.md - cell count (${cells.length}) does not match header count (${headerCells.length}): ${line}`);
            continue;
        }


        try {
            const parseFileList = (fileListString: string | undefined): string[] => {
                if (!fileListString) return [];
                return fileListString
                    .split(',')
                    .map(f => f.trim().replace(/\[([^\]]+)\]\(.*?\)/g, '$1')) // Handle markdown links
                    .filter(f => f); // Remove empty strings
            };

            const responsibleFiles = parseFileList(columnIndices.responsibleFiles !== undefined ? cells[columnIndices.responsibleFiles] : undefined);
            const testFilePaths = parseFileList(columnIndices.testFilePaths !== undefined ? cells[columnIndices.testFilePaths] : undefined);

            const item: RoadmapItem = {
                version: columnIndices.version !== undefined ? cells[columnIndices.version] : undefined,
                milestone: columnIndices.milestone !== undefined ? cells[columnIndices.milestone] : undefined,
                releaseDate: columnIndices.releaseDate !== undefined ? cells[columnIndices.releaseDate] : undefined,
                lastUpdated: columnIndices.lastUpdated !== undefined ? cells[columnIndices.lastUpdated] : undefined,
                status: columnIndices.status !== undefined ? cells[columnIndices.status] : 'Unknown',
                progressPercent: columnIndices.progressPercent !== undefined ? cells[columnIndices.progressPercent] : undefined,
                priority: columnIndices.priority !== undefined ? cells[columnIndices.priority] : undefined,
                epic: columnIndices.epic !== undefined ? cells[columnIndices.epic] : undefined,
                okrGoal: columnIndices.okrGoal !== undefined ? cells[columnIndices.okrGoal] : undefined,
                category: columnIndices.category !== undefined ? cells[columnIndices.category] : undefined,
                feature: columnIndices.feature !== undefined ? cells[columnIndices.feature] : undefined,
                description: columnIndices.description !== undefined ? cells[columnIndices.description] : 'No Description',
                responsibleFiles: responsibleFiles,
                testFilePaths: testFilePaths,
                dependencies: columnIndices.dependencies !== undefined ? cells[columnIndices.dependencies] : undefined,
                acceptanceCriteria: columnIndices.acceptanceCriteria !== undefined ? cells[columnIndices.acceptanceCriteria] : undefined,
                designSpecLink: columnIndices.designSpecLink !== undefined ? cells[columnIndices.designSpecLink] : undefined,
            };

            if (!item.status || !item.description) {
                console.warn(`${logPrefix} Skipping row in FEATURE_ROADMAP.md - missing essential status or description: ${line}`);
                continue;
            }
            // Warnings for missing file paths if columns were expected
            if (columnIndices.responsibleFiles === undefined && responsibleFiles.length === 0) {
                // This warning is already covered by findColumnIndices
            }
            if (columnIndices.testFilePaths === undefined && testFilePaths.length === 0) {
                // This warning is already covered by findColumnIndices
            }

            items.push(item);
        } catch (e) {
            console.warn(`${logPrefix} Skipping potentially malformed feature-roadmap row in FEATURE_ROADMAP.md: ${line}. Error: ${e instanceof Error ? e.message : e}`);
        }
    }

    if (items.length === 0 && headerFound) {
        console.error(`${logPrefix} No valid feature-roadmap items parsed from FEATURE_ROADMAP.md. Check header, separator, and data rows.`);
    } else if (!headerFound) {
        console.error(`${logPrefix} Failed to identify a valid header row in FEATURE_ROADMAP.md.`);
    } else {
        console.log(`${logPrefix} Successfully parsed ${items.length} feature-roadmap items from FEATURE_ROADMAP.md.`);
    }

    return items;
}