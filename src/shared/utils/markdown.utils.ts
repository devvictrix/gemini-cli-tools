// File: src/shared/utils/markdown.utils.ts

const logPrefix = "[MarkdownUtil]";

export interface ChecklistItem {
    id: string; // The '#' column
    description: string;
    status: string;
    priority: string; // <<< Make sure this is extracted
    targetPhase: string; // Extracted P<Number>
    responsibleFiles: string[];
    // Add other columns if needed (Examples, Tests, etc.)
}

export function parseChecklistTable(markdownContent: string): ChecklistItem[] {
    const lines = markdownContent.split('\n');
    const items: ChecklistItem[] = [];
    let headerSkipped = false;
    let separatorSkipped = false;
    const columnIndices: { [key: string]: number } = {};

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith('|') || !trimmedLine.endsWith('|')) {
            continue;
        }

        const cells = trimmedLine.split('|').map(cell => cell.trim()).slice(1, -1);

        if (!headerSkipped) {
            cells.forEach((header, index) => {
                const lowerHeader = header.toLowerCase();
                if (lowerHeader.includes('#')) columnIndices.id = index;
                if (lowerHeader.includes('requirement description')) columnIndices.description = index;
                if (lowerHeader.includes('status')) columnIndices.status = index;
                if (lowerHeader.includes('priority')) columnIndices.priority = index; // <<< Ensure Priority is mapped
                if (lowerHeader.includes('target phase')) columnIndices.targetPhase = index;
                if (lowerHeader.includes('responsible files')) columnIndices.responsibleFiles = index;
            });
            // Check if essential columns were found
            if (columnIndices.id === undefined || columnIndices.status === undefined || columnIndices.targetPhase === undefined) {
                console.warn(`${logPrefix} Could not identify essential columns (ID, Status, Target Phase) in header row. Retrying on next row.`);
                // Don't skip header yet, maybe the first line wasn't the header
                continue;
            }
            headerSkipped = true;
            continue;
        }

        if (!separatorSkipped) {
            if (cells.every(cell => cell.includes('---'))) {
                separatorSkipped = true;
                continue;
            } else {
                // Tolerate if separator is missing, but log warning
                console.warn(`${logPrefix} Checklist table separator '---|---|...' not found or malformed after header. Proceeding with data rows.`);
                separatorSkipped = true; // Assume next line is data
                // Re-check essential columns from header detection before processing first data row
                if (columnIndices.id === undefined || columnIndices.status === undefined || columnIndices.targetPhase === undefined) {
                    console.error(`${logPrefix} Could not reliably identify essential columns (ID, Status, Target Phase) in the checklist header. Cannot parse table.`);
                    return [];
                }
            }
        }

        // Process data rows
        try {
            const phaseMatch = (cells[columnIndices.targetPhase] ?? '').match(/P(\d+)/i);
            const targetPhase = phaseMatch ? phaseMatch[0].toUpperCase() : 'Unknown';

            const filesString = cells[columnIndices.responsibleFiles] ?? '';
            const responsibleFiles = filesString
                .split(',')
                .map(f => f.trim().replace(/\[([^\]]+)\]\(.*?\)/g, '$1'))
                .filter(f => f && !f.startsWith('---') && !f.startsWith('*('));

            const item: ChecklistItem = {
                id: cells[columnIndices.id] ?? 'N/A',
                description: cells[columnIndices.description] ?? '',
                status: cells[columnIndices.status] ?? '',
                priority: cells[columnIndices.priority] ?? '', // <<< Extract priority
                targetPhase: targetPhase,
                responsibleFiles: responsibleFiles,
            };
            items.push(item);
        } catch (e) {
            console.warn(`${logPrefix} Skipping malformed checklist row: ${line}. Error: ${e instanceof Error ? e.message : e}`);
        }
    }

    if (items.length === 0 && headerSkipped) { // Check headerSkipped to avoid warning if header wasn't even found
        console.warn(`${logPrefix} Failed to parse any valid data rows from the checklist table.`);
    } else if (!headerSkipped) {
        console.error(`${logPrefix} Failed to identify a valid header row in the checklist table.`);
    }


    return items;
}

export function extractCurrentPhase(markdownContent: string): { number: number, name: string } | null {
    const phaseRegex = /Current Focus:\s*Phase\s+(\d+)\s*-\s*([^\(]+)/i;
    const match = markdownContent.match(phaseRegex);

    if (match && match[1] && match[2]) {
        try {
            const number = parseInt(match[1], 10);
            const name = match[2].trim();
            return { number, name };
        } catch (e) {
            console.error(`${logPrefix} Failed to parse phase number from REQUIREMENT.md: ${match[1]}`);
            return null;
        }
    }
    console.warn(`${logPrefix} Could not find 'Current Focus: Phase X - Name' line in REQUIREMENT.md`);
    return null;
}