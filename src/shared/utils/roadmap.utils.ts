// src/shared/utils/roadmap.utils.ts

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
    responsibleFiles?: string[]; // CRITICAL - Assumes you add this column
    dependencies?: string;
    // Add other relevant columns if needed
    // Example: Add columns you might want the AI to see
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
        'responsible files': 'responsibleFiles', // <<< CRITICAL
        'dependencies': 'dependencies',
        'acceptance criteria': 'acceptanceCriteria', // Example added column
        'design spec link': 'designSpecLink',       // Example added column
        // Add mappings for other columns you need
    };

    headerCells.forEach((header, index) => {
        const lowerHeader = header.toLowerCase().trim();
        for (const key in mapping) {
            if (lowerHeader.includes(key)) {
                // Avoid overwriting if a more specific match was already found (e.g., "Status" vs "Last Updated Status")
                if (indices[mapping[key]] === undefined) {
                    indices[mapping[key]] = index;
                }
                // Optional: Allow more specific matches to override less specific ones if needed
                // indices[mapping[key]] = index;
                // break; // Consider removing break if multiple headers might contain the same keyword partially
            }
        }
    });

    // Basic validation
    if (indices.status === undefined) console.error(`${logPrefix} 'Status' column not found in ROADMAP header.`);
    if (indices.description === undefined) console.error(`${logPrefix} 'Description' column not found in ROADMAP header.`);
    if (indices.responsibleFiles === undefined) console.warn(`${logPrefix} 'Responsible Files' column not found in ROADMAP header. Context gathering will fail.`);

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
            // Try to identify header - look for key columns like "Feature", "Status", "Description"
            // Using a slightly more robust check for potential header rows
            if (cells.length > 3 && cells.some(h => /^(Feature|Status|Description|Responsible Files|Priority)/i.test(h.trim()))) {
                headerCells = cells;
                columnIndices = findColumnIndices(headerCells);
                // Check if essential columns were mapped
                // --- THIS IS THE CORRECTED LINE ---
                if (columnIndices.status === undefined || columnIndices.description === undefined) {
                    // --- END CORRECTION ---
                    console.error(`${logPrefix} Failed to find essential columns (Status, Description) in potential header: ${line}. Cannot parse roadmap.`);
                    // Don't return yet, maybe this wasn't the real header
                    // Reset and try the next line
                    columnIndices = {};
                    continue;
                }
                headerFound = true;
                console.log(`${logPrefix} Identified header row. Mapped columns:`, columnIndices);
            }
            continue; // Move to next line whether header found or not
        }

        if (!separatorFound) {
            // Check for the separator line (e.g., |---|---|...)
            // Make the separator check more robust (allowing variations like :---: or ---)
            if (cells.length >= headerCells.length && cells.every(cell => cell.replace(/[:\- ]/g, '').trim() === '')) {
                separatorFound = true;
                continue; // Found separator, move to the next line (actual data)
            } else {
                // Only warn if we are sure we already found the header
                console.warn(`${logPrefix} Table separator '---|---|...' not found or malformed after header. Assuming this line is data.`);
                separatorFound = true; // Assume it's data now
                // Re-validate essential columns before processing first data row
                if (columnIndices.status === undefined || columnIndices.description === undefined) {
                    console.error(`${logPrefix} Could not reliably identify essential columns from header before processing data. Cannot parse table.`);
                    return [];
                }
                // If separator was missing, *this current line* IS the first data row
                // Fall through to process it below
            }
            // If it was the separator, we continued. If not, fall through.
        }

        // --- Process Data Row ---
        // Ensure we have header and separator before processing row data
        if (!headerFound || !separatorFound) continue;

        // Check if the number of cells matches the header to avoid errors on malformed rows
        if (cells.length !== headerCells.length) {
            console.warn(`${logPrefix} Skipping row - cell count (${cells.length}) does not match header count (${headerCells.length}): ${line}`);
            continue;
        }


        try {
            // Map cells to RoadmapItem properties using columnIndices
            const filesString = columnIndices.responsibleFiles !== undefined ? cells[columnIndices.responsibleFiles] : '';
            const responsibleFiles = filesString
                .split(',')
                .map(f => f.trim().replace(/\[([^\]]+)\]\(.*?\)/g, '$1')) // Handle markdown links
                .filter(f => f); // Remove empty strings

            const item: RoadmapItem = {
                version: columnIndices.version !== undefined ? cells[columnIndices.version] : undefined,
                milestone: columnIndices.milestone !== undefined ? cells[columnIndices.milestone] : undefined,
                releaseDate: columnIndices.releaseDate !== undefined ? cells[columnIndices.releaseDate] : undefined,
                lastUpdated: columnIndices.lastUpdated !== undefined ? cells[columnIndices.lastUpdated] : undefined,
                status: columnIndices.status !== undefined ? cells[columnIndices.status] : 'Unknown', // Essential
                progressPercent: columnIndices.progressPercent !== undefined ? cells[columnIndices.progressPercent] : undefined,
                priority: columnIndices.priority !== undefined ? cells[columnIndices.priority] : undefined, // Important
                epic: columnIndices.epic !== undefined ? cells[columnIndices.epic] : undefined,
                okrGoal: columnIndices.okrGoal !== undefined ? cells[columnIndices.okrGoal] : undefined,
                category: columnIndices.category !== undefined ? cells[columnIndices.category] : undefined,
                feature: columnIndices.feature !== undefined ? cells[columnIndices.feature] : undefined, // Important
                description: columnIndices.description !== undefined ? cells[columnIndices.description] : 'No Description', // Essential
                responsibleFiles: responsibleFiles, // CRITICAL
                dependencies: columnIndices.dependencies !== undefined ? cells[columnIndices.dependencies] : undefined,
                acceptanceCriteria: columnIndices.acceptanceCriteria !== undefined ? cells[columnIndices.acceptanceCriteria] : undefined, // Example added
                designSpecLink: columnIndices.designSpecLink !== undefined ? cells[columnIndices.designSpecLink] : undefined,     // Example added
                // Add mappings for other extracted columns
            };

            if (!item.status || !item.description) {
                console.warn(`${logPrefix} Skipping row - missing essential status or description: ${line}`);
                continue;
            }
            if (columnIndices.responsibleFiles !== undefined && item.responsibleFiles?.length === 0) {
                // It's okay for responsible files to be empty sometimes, maybe just log debug level
                // console.debug(`${logPrefix} Row for "${item.feature || item.description}" has empty 'Responsible Files' column.`);
            } else if (columnIndices.responsibleFiles === undefined && !items.some(i => i.responsibleFiles === undefined)) {
                console.warn(`${logPrefix} 'Responsible Files' column missing, cannot gather context for tasks.`);
                item.responsibleFiles = [];
            } else if (columnIndices.responsibleFiles === undefined) {
                item.responsibleFiles = []; // Ensure it exists even if column is missing
            }


            items.push(item);
        } catch (e) {
            console.warn(`${logPrefix} Skipping potentially malformed roadmap row: ${line}. Error: ${e instanceof Error ? e.message : e}`);
        }
    } // End of loop through lines

    if (items.length === 0) {
        console.error(`${logPrefix} No valid roadmap items parsed. Check header, separator, and data rows.`);
    } else {
        console.log(`${logPrefix} Successfully parsed ${items.length} roadmap items.`);
    }


    return items;
}