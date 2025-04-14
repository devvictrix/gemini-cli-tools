// src/shared/types/app.type.ts

import { EnhancementType } from '../enums/enhancement.type.js'; // Use the enum from its new location

// Renamed AppArguments -> CliArguments for clarity
export interface CliArguments {
    command: EnhancementType;
    targetPath: string;
    prefix?: string;
    interfaceName?: string; // Specific to InferFromData command
    [key: string]: unknown; // Allow other yargs properties
    _: (string | number)[]; // Positional args
    $0: string;             // Script name
}

// FileProcessingResult remains relevant for summarizing operations
export interface FileProcessingResult {
    filePath: string;
    status: 'updated' | 'unchanged' | 'error' | 'processed'; // 'processed' could be for non-modification tasks
    message?: string;
}