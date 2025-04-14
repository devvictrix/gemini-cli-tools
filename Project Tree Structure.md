gemini-poc/
├── .env                  # Environment variables (API Key)
├── package.json
├── tsconfig.json
└── src/
    ├── config/
    │   └── app.config.ts # Renamed from config.ts
    ├── index.ts          # New application entry point
    │
    ├── gemini/           # Domain Module: Core Gemini CLI functionality
    │   ├── cli/          # CLI specific logic
    │   │   ├── gemini.cli.ts     # Yargs setup and command definition
    │   │   └── gemini.handler.ts # Core command execution logic (runMainLogic)
    │   ├── services/
    │   │   └── gemini.service.ts # Interaction with Gemini API (minor import updates)
    │   └── utils/        # Module-specific utilities (if any in future)
    │       └── code.extractor.ts # Moved here as it's specific to gemini service output
    │
    ├── shared/             # Shared utilities, types, constants
    │   ├── constants/
    │   │   └── filesystem.constants.ts # No changes needed
    │   ├── enums/
    │   │   └── enhancement.type.ts # Moved from shared/types
    │   ├── helpers/
    │   │   ├── filesystem.helper.ts # Renamed from file.helpers.ts (getAllFiles, filterLines)
    │   │   └── type-inference.helper.ts # No changes needed
    │   ├── types/
    │   │   └── app.type.ts # Contains CliArguments, FileProcessingResult
    │   └── utils/
    │       ├── file-io.utils.ts    # Contains sync I/O (read/update/write)
    │       └── filesystem.utils.ts # Contains getTargetFiles, getConsolidatedSources
    │
    └── shared-modules/     # (Empty for now)
        └── .gitkeep        # Placeholder