import fs from 'fs';
import path from 'path';
import { EXCLUDE_PATTERNS } from '../constants/filesystem.constants';

export interface StructureOptions {
    includeDescriptions?: boolean;
    maxDepth?: number;
    additionalIgnores?: string[];
}

export function getDirectoryStructure(dirPath: string, options: StructureOptions = {}, currentDepth: number = 0): string {
    if (options.maxDepth !== undefined && currentDepth > options.maxDepth) {
        return '';
    }

    let markdown = '';
    const items = fs.readdirSync(dirPath);

    const mergedIgnores = [...EXCLUDE_PATTERNS, ...(options.additionalIgnores || [])];

    items.sort().forEach((item, index) => {
        if (mergedIgnores.includes(item)) return;

        const fullPath = path.join(dirPath, item);
        const stats = fs.statSync(fullPath);
        const isDirectory = stats.isDirectory();
        const prefix = currentDepth === 0 ? '' : '│   '.repeat(currentDepth - 1) + (index === items.length - 1 ? '└── ' : '├── ');

        if (isDirectory) {
            markdown += `${prefix}📂 **${item}/**\n`;
            markdown += getDirectoryStructure(fullPath, options, currentDepth + 1);
        } else {
            markdown += `${prefix}📄 ${item}\n`;
        }
    });

    return markdown;
}
