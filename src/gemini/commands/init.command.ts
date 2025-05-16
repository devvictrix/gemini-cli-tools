import fs from 'fs';
import path from 'path';
import { CliArguments } from '@shared/types/app.type';
import { EnhancementType } from '@/gemini/types/enhancement.type';
import { writeOutputFile } from '@shared/utils/file-io.utils';

const logPrefix = "[InitCommand]";

/**
 * Generates the content for the package.json file.
 * @param packageName - The name of the package.
 * @param description - Optional description of the package.
 * @returns The string content for package.json.
 */
function getPackageJsonContent(packageName: string, description?: string): string {
    const pkg = {
        name: packageName,
        version: "0.1.0",
        description: description || "",
        main: "dist/index.js",
        scripts: {
            "start": "node dist/index.js", // Runs compiled code
            "dev": "ts-node src/index.ts",
            "build": "tsc",
            "test": "jest"
        },
        keywords: [],
        author: "",
        license: "ISC",
        devDependencies: {
            "@types/jest": "^29.5.14", // Example version, update as needed
            "@types/node": "^20.17.30", // Example version, update as needed
            "jest": "^29.7.0", // Example version, update as needed
            "ts-jest": "^29.3.2", // Example version, update as needed
            "ts-node": "^10.9.2", // Example version, update as needed
            "typescript": "^5.8.3" // Example version, update as needed
        },
        dependencies: {}
    };
    return JSON.stringify(pkg, null, 2);
}

/**
 * Generates the content for the tsconfig.json file.
 * @returns The string content for tsconfig.json.
 */
function getTsconfigJsonContent(): string {
    const tsconfig = {
        compilerOptions: {
            target: "ES2020",
            module: "CommonJS",
            moduleResolution: "node",
            rootDir: "./src",
            outDir: "./dist",
            esModuleInterop: true,
            forceConsistentCasingInFileNames: true,
            strict: true,
            skipLibCheck: true,
            resolveJsonModule: true,
            baseUrl: ".",
            paths: {
                "@/*": ["src/*"]
            }
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "dist", "tests/**/*"]
    };
    return JSON.stringify(tsconfig, null, 2);
}

/**
 * Generates the content for the FEATURE_ROADMAP.md file.
 * @param packageName - The name of the package.
 * @returns The string content for FEATURE_ROADMAP.md.
 */
function getFeatureRoadmapContent(packageName: string): string {
    return `# Project: ${packageName} - Roadmap & Status

This document tracks the planned features and their status for the \`${packageName}\` project.
This project is intended to be developed using the \`gemini-poc develop\` command.

**Key Supporting Documents:**
*   *(Optionally, link to your own detailed Functional Requirements, Non-Functional Requirements, ADRs, etc. here.)*

---

## Feature Breakdown

| Version | Status      | Priority | Feature Name          | Description                        | Responsible File(s) | Test File Path(s)        | Notes        |
| :------ | :---------- | :------- | :-------------------- | :--------------------------------- | :------------------ | :----------------------- | :----------- |
| v0.1.0  | Not Started | P0       | Initial Project Setup | Complete initial project setup and basic structure. This includes creating the main entry point and a simple test. | src/index.ts        | tests/index.test.ts    | Initial task |
|         |             |          |                       | Add a simple function in \`src/index.ts\` (e.g., \`greet(name: string): string\`) and a corresponding test in \`tests/index.test.ts\`. | src/utils/formatter.ts (example) | tests/utils/formatter.test.ts (example) | Placeholder for a utility function |
| v0.1.0  | Not Started | P1       | Example Feature One   | Implement the first core feature as described. | src/featureOne.ts   | tests/featureOne.test.ts |              |

---

**Summary & Next Steps:**

*   The project \`${packageName}\` has been initialized using \`gemini-poc init\`.
*   The next step is to begin development on the "Initial Project Setup" task using \`gemini-poc develop .\` (run from the root of this new project).
`;
}

/**
 * Generates the content for the README.md file.
 * @param packageName - The name of the package.
 * @param description - Optional description of the package.
 * @returns The string content for README.md.
 */
function getReadmeContent(packageName: string, description?: string): string {
    let content = `# ${packageName}\n\n`;
    if (description) {
        content += `${description}\n\n`;
    }
    content += `## Overview

This project, \`${packageName}\`, was scaffolded using the \`gemini-poc init\` command and is ready for development, particularly using the \`gemini-poc develop\` command.

## Getting Started

### Prerequisites

*   Node.js (e.g., v18+ or v20+)
*   npm (or yarn, pnpm)

### Installation

1.  Clone the repository (if applicable) or navigate to the project directory:
    \`\`\`bash
    cd path/to/${packageName}
    \`\`\`
2.  Install dependencies:
    \`\`\`bash
    npm install
    # or: yarn install
    # or: pnpm install
    \`\`\`

### Development

To run the application in development mode (uses \`ts-node\` for live execution of TypeScript):
\`\`\`bash
npm run dev
\`\`\`

### Build

To compile the TypeScript code to JavaScript (output to \`dist/\` directory):
\`\`\`bash
npm run build
\`\`\`

To run the compiled application:
\`\`\`bash
npm start 
# (This script typically runs \`node dist/index.js\`)
\`\`\`

### Testing

To run unit tests using Jest:
\`\`\`bash
npm test
\`\`\`

## Project Structure

*   \`src/\`: Contains the main TypeScript source code for the application (e.g., \`src/index.ts\`).
*   \`tests/\`: Contains test files, typically mirroring the structure of \`src/\` (e.g., \`tests/index.test.ts\`).
*   \`docs/\`: Contains project documentation files, including the crucial \`FEATURE_ROADMAP.md\` which drives the \`gemini-poc develop\` command.
*   \`package.json\`: Lists project metadata, dependencies, and npm scripts.
*   \`tsconfig.json\`: TypeScript compiler configuration.
*   \`.gitignore\`: Specifies intentionally untracked files that Git should ignore.
*   \`README.md\`: This file - provides an overview of the project.
`;
    return content;
}

/**
 * Generates the content for the .gitignore file.
 * @returns The string content for .gitignore.
 */
function getGitignoreContent(): string {
    return `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Directory for instrumented libs generated by jscoverage/JSCover
lib-cov

# Coverage directory used by tools like istanbul
coverage
*.lcov

# nyc test coverage
.nyc_output

# Grunt intermediate storage (http://gruntjs.com/creating-plugins#storing-task-files)
.grunt

# Bower dependency directory (https://bower.io/)
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons (http://nodejs.org/api/addons.html)
build/Release

# Dependency directories
node_modules/
jspm_packages/

# Snowpack dependency directory (https://snowpack.dev/)
web_modules/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
.env.test
.env.production
.env.development
.env.*.local

# parcel-bundler cache files
.cache
.parcel-cache

# Next.js build output
.next
out

# Nuxt.js build output
.nuxt
dist

# Remix build output
.cache/
build/
public/build/

# Gatsby files
.cache/
# Comment in the public line in if your project uses Gatsby and not Next.js
# https://nextjs.org/blog/next-9-1#public-directory-support
public

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless/

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# Stores VSCode versions used for testing VSCode extensions
.vscode-test

# Temporary folder for jest watch
jest.tmp/
`;
}

/**
 * Generates the content for the placeholder src/index.ts file.
 * @param packageName - The name of the package.
 * @returns The string content for src/index.ts.
 */
function getSrcIndexTsContent(packageName: string): string {
    return `// File: src/index.ts

/**
 * A simple greeting function.
 * @param name - The name to greet.
 * @returns A greeting string.
 */
export function greet(name: string): string {
    return \`Hello, \${name} from ${packageName}!\`;
}

/**
 * Main function to demonstrate project initialization and the greet function.
 */
function main() {
    const projectName = "${packageName}";
    console.log(greet(projectName));
    console.log("Project initialized successfully.");
    console.log("You can start by editing this file: src/index.ts");
    console.log("And its corresponding test: tests/index.test.ts");
    console.log("To run this code in development, use: npm run dev");
    console.log("To run tests, use: npm test");
}

// Ensure main is called only when the script is executed directly
if (require.main === module) {
    main();
}
`;
}

/**
 * Generates the content for the placeholder tests/index.test.ts file.
 * @param packageName - The name of the package.
 * @returns The string content for tests/index.test.ts.
 */
function getTestsIndexTestTsContent(packageName: string): string {
    return `// File: tests/index.test.ts

import { greet } from '../src/index'; // Assuming greet is exported from src/index.ts

describe('${packageName} Initial Tests', () => {
    it('should have a placeholder test that passes to confirm setup', () => {
        expect(true).toBe(true);
    });

    describe('greet function', () => {
        it('should return a greeting message including the provided name and package name', () => {
            const name = "Developer";
            const expectedMessage = \`Hello, \${name} from ${packageName}!\`;
            expect(greet(name)).toBe(expectedMessage);
        });

        it('should handle an empty name string', () => {
            const name = "";
            const expectedMessage = \`Hello, \${name} from ${packageName}!\`;
            expect(greet(name)).toBe(expectedMessage);
        });
    });

    // Example of a simple utility function and its test (if you were to add one)
    // function add(a: number, b: number): number {
    //     return a + b;
    // }
    //
    // it('should correctly add two numbers', () => {
    //     expect(add(1, 2)).toBe(3);
    //     expect(add(-1, 1)).toBe(0);
    //     expect(add(0, 0)).toBe(0);
    // });
});
`;
}

/**
 * Executes the Init command to scaffold a new project.
 * @param args - The command line arguments.
 * @returns A promise that resolves when the command is complete.
 */
export async function execute(args: CliArguments): Promise<void> {
    if (args.command !== EnhancementType.Init) {
        throw new Error(`${logPrefix} Handler mismatch: Expected Init command.`);
    }

    const { targetPath, packageName, description, force } = args;

    if (!targetPath) {
        // This should be caught by yargs' demandOption, but good for direct calls
        throw new Error(`${logPrefix} targetPath argument is required.`);
    }
    if (!packageName || typeof packageName !== 'string' || !String(packageName).trim()) {
        // This should be caught by yargs' demandOption, but good for direct calls
        throw new Error(`${logPrefix} --packageName option is required and cannot be empty.`);
    }

    const projectRoot = path.resolve(String(targetPath));
    const projPackageName = String(packageName).trim();
    const projDescription = typeof description === 'string' ? String(description).trim() : undefined;

    console.log(`\n${logPrefix} Initializing new project '${projPackageName}' at: ${projectRoot}`);

    // Validate and prepare project directory
    if (fs.existsSync(projectRoot)) {
        if (!fs.statSync(projectRoot).isDirectory()) {
            throw new Error(`${logPrefix} Target path '${projectRoot}' exists but is not a directory.`);
        }
        const filesInDir = fs.readdirSync(projectRoot);
        if (filesInDir.length > 0 && !force) {
            throw new Error(`${logPrefix} Target directory '${projectRoot}' is not empty. Use --force to proceed.`);
        }
        if (filesInDir.length > 0 && force) {
            console.warn(`${logPrefix} ⚠️ Target directory '${projectRoot}' is not empty. --force flag is used, proceeding. Existing files with the same name will be overwritten.`);
        }
    } else {
        console.log(`${logPrefix} Creating project directory: ${projectRoot}`);
        fs.mkdirSync(projectRoot, { recursive: true });
    }

    // Create subdirectories
    const dirsToCreate = ['src', 'tests', 'docs'];
    for (const dir of dirsToCreate) {
        const dirPath = path.join(projectRoot, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            const relativeDirPath = path.relative(process.cwd(), dirPath) || dirPath;
            console.log(`${logPrefix} Created directory: ./${relativeDirPath}`);
        }
    }

    // Generate and write files
    const filesToWrite: { filePath: string, content: string, name: string }[] = [
        { filePath: path.join(projectRoot, 'package.json'), content: getPackageJsonContent(projPackageName, projDescription), name: 'package.json' },
        { filePath: path.join(projectRoot, 'tsconfig.json'), content: getTsconfigJsonContent(), name: 'tsconfig.json' },
        { filePath: path.join(projectRoot, 'FEATURE_ROADMAP.md'), content: getFeatureRoadmapContent(projPackageName), name: 'FEATURE_ROADMAP.md' },
        { filePath: path.join(projectRoot, 'README.md'), content: getReadmeContent(projPackageName, projDescription), name: 'README.md' },
        { filePath: path.join(projectRoot, '.gitignore'), content: getGitignoreContent(), name: '.gitignore' },
        { filePath: path.join(projectRoot, 'src', 'index.ts'), content: getSrcIndexTsContent(projPackageName), name: 'src/index.ts' },
        { filePath: path.join(projectRoot, 'tests', 'index.test.ts'), content: getTestsIndexTestTsContent(projPackageName), name: 'tests/index.test.ts' },
    ];

    for (const file of filesToWrite) {
        const relativeFilePath = path.relative(process.cwd(), file.filePath) || file.filePath;
        console.log(`${logPrefix} Writing ${file.name} to ./${relativeFilePath}`);
        if (!writeOutputFile(file.filePath, file.content)) {
            // writeOutputFile already logs errors
            throw new Error(`${logPrefix} Failed to write ${file.name} to ./${relativeFilePath}`);
        }
    }

    const relativeTargetPath = path.relative(process.cwd(), projectRoot) || '.';
    console.log(`\n${logPrefix} ✅ Project '${projPackageName}' initialized successfully at ./${relativeTargetPath}`);
    console.log(`${logPrefix} Next steps:`);
    console.log(`   cd ./${relativeTargetPath}`);
    console.log(`   npm install (or yarn install / pnpm install)`);
    console.log(`   npm run dev (to start the example application)`);
    console.log(`   npm test (to run initial tests)`);
}