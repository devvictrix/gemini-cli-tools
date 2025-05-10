// File: src/gemini/utils/multi-file.parser.ts

const logPrefix = "[MultiFileParser]";

/**
 * Represents a single file extracted from a larger text block.
 */
export interface ExtractedFile {
    /**
     * The relative path to the file, as specified in the `// File: path/to/file.ext` header.
     */
    filePath: string;
    /**
     * The content of the file.
     */
    content: string;
}

/**
 * Parses a text response from an AI that is expected to contain one or more
 * file blocks, each demarcated by a `// File: path/to/file.ext` header.
 * It also attempts to strip Markdown code block fences if they wrap the content of a file segment.
 *
 * @param responseText The raw text response from the AI.
 * @returns An array of ExtractedFile objects. If no valid file headers are found,
 *          an empty array is returned.
 */
export function parseAiResponseWithFileHeaders(responseText: string): ExtractedFile[] {
    const extractedFiles: ExtractedFile[] = [];
    if (!responseText || responseText.trim() === '') {
        console.warn(`${logPrefix} Received empty or whitespace-only responseText. Cannot parse files.`);
        return extractedFiles;
    }

    const fileHeaderRegex = /^\s*\/\/\s*File:\s*([^\s\n\r]+)\s*$/gm;

    let match;
    const matches = [];
    while ((match = fileHeaderRegex.exec(responseText)) !== null) {
        matches.push({
            filePath: match[1].trim(),
            startIndex: match.index,
            headerLength: match[0].length,
        });
    }

    if (matches.length === 0) {
        console.warn(`${logPrefix} No "// File: ..." headers found in the AI response.`);
        return extractedFiles;
    }

    for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const contentStartIndex = currentMatch.startIndex + currentMatch.headerLength;

        let contentEndIndex: number;
        if (i + 1 < matches.length) {
            contentEndIndex = matches[i + 1].startIndex;
        } else {
            contentEndIndex = responseText.length;
        }

        let fileContent = responseText.substring(contentStartIndex, contentEndIndex);

        // 1. Basic trim to remove surrounding whitespace from the segment
        fileContent = fileContent.trim();

        // 2. Attempt to detect and remove Markdown code block fences if they wrap THE ENTIRE fileContent segment
        // This regex attempts to match:
        // ```[optional_lang_specifier]
        // code_content
        // ```
        // It's multiline and dotAll (implicitly via [\s\S]) to handle newlines in code_content.
        const markdownBlockRegex = /^```(?:[a-zA-Z0-9-+_]+)?\s*\n([\s\S]*?)\n?\s*```$/;
        const matchResult = fileContent.match(markdownBlockRegex);

        if (matchResult && matchResult[1]) {
            // If the entire segment was a Markdown block, use its inner content
            fileContent = matchResult[1].trim(); // Trim the inner content as well
            console.log(`${logPrefix} Stripped Markdown code block fences for file: ${currentMatch.filePath}`);
        }
        // If no such wrapping block is found, the content is used as is (after the initial trim).

        if (!currentMatch.filePath) {
            console.warn(`${logPrefix} Skipping a block due to missing file path in header: ${responseText.substring(currentMatch.startIndex, currentMatch.startIndex + 50)}...`);
            continue;
        }

        if (currentMatch.filePath.length < 3 || !currentMatch.filePath.includes('/') && !currentMatch.filePath.includes('.')) {
            console.warn(`${logPrefix} Skipping block due to potentially invalid file path: "${currentMatch.filePath}"`);
            continue;
        }

        extractedFiles.push({
            filePath: currentMatch.filePath,
            content: fileContent,
        });
    }

    if (extractedFiles.length > 0) {
        console.log(`${logPrefix} Successfully parsed ${extractedFiles.length} file(s) from AI response.`);
    }

    return extractedFiles;
}