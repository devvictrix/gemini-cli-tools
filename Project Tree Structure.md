gemini-poc/
├── src/
│   ├── config/
│   │   └── app.config.ts
│   ├── gemini/
│   │   ├── cli/
│   │   │   ├── gemini.cli.ts
│   │   │   └── gemini.handler.ts
│   │   ├── commands/
│   │   │   ├── add-comments.command.ts
│   │   │   ├── add-path-comment.command.ts
│   │   │   ├── analyze.command.ts
│   │   │   ├── command.interface.ts
│   │   │   ├── consolidate.command.ts
│   │   │   ├── explain.command.ts
│   │   │   ├── generate-docs.command.ts
│   │   │   ├── generate-structure-doc.command.ts
│   │   │   └── suggest-improvements.command.ts
│   │   ├── interfaces/
│   │   │   └── infer-from-data.command.ts
│   │   ├── utils/
│   │   └── gemini.service.ts
│   ├── shared/
│   │   ├── constants/
│   │   │   └── filesystem.constants.ts
│   │   ├── enums/
│   │   │   └── enhancement.type.ts
│   │   ├── helpers/
│   │   │   ├── filesystem.helper.ts
│   │   │   └── type-inference.helper.ts
│   │   ├── types/
│   │   │   └── app.type.ts
│   │   └── utils/
│   │       ├── file-io.utils.ts
│   │       └── filesystem.utils.ts
│   ├── shared-modules/
│   │   └── .gitkeep
│   └── index.ts
├── .env
├── .gitignore
├── package.json
├── Project Architecture.md
└── tsconfig.json