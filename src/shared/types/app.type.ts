// File: src/shared/types/app.types.ts

import { EnhancementType } from './enhancement.type.js';

export interface AppArguments {
    command: EnhancementType;
    targetPath: string;
    prefix?: string;
    interfaceName?: string;
    [key: string]: unknown;
    _: (string | number)[];
    $0: string;
}

export interface FileProcessingResult {
    filePath: string;
    status: 'updated' | 'unchanged' | 'error' | 'processed';
    message?: string;
}