# Source Code Structure

## Overview
This directory contains the TypeScript source code for Rule5Bot.

## Directory Structure

```
src/
├── main.ts                 # Main entry point, Devvit configuration
├── types/                  # TypeScript type definitions
│   └── index.ts           # Core types and interfaces
├── settings/              # Devvit settings configuration
│   └── definitions.ts     # Settings UI definitions
├── handlers/                # Event handlers
│   ├── postSubmit.ts       # PostSubmit trigger handler
│   ├── modMailHandler.ts   # ModMail trigger handler
│   └── queuePolling.ts     # Optional queue polling
├── services/                # Business logic
│   ├── postValidation.ts   # Post type validation
│   ├── commentValidation.ts# R5 comment validation
│   ├── warningSystem.ts    # Warning enforcement
│   ├── removalSystem.ts    # Removal enforcement
│   ├── reinstatementSystem.ts # Auto-approval
│   └── notificationService.ts # Slack/Discord
├── storage/                 # Redis operations
│   └── postState.ts        # Post state tracking
└── utils/                   # Utility functions
    ├── keywordMatching.ts  # Keyword validation (no regex)
    ├── domainMatching.ts   # Domain pattern matching
    ├── postHelpers.ts      # Post utility functions
    ├── templates.ts        # Message template substitution
    └── logger.ts           # Structured logging
```

## Key Design Principles

### 1. No Regex for User Input
- All keyword matching uses safe string operations
- Prevents ReDoS (Regular Expression Denial of Service) attacks
- See `utils/keywordMatching.ts` and `Docs/KEYWORD-MATCHING.md`

### 2. Type Safety
- All functions have explicit return types
- Strict TypeScript configuration
- Comprehensive type definitions in `types/index.ts`

### 3. Separation of Concerns
- **Handlers**: Process Devvit events, delegate to services
- **Services**: Business logic, validation, enforcement
- **Storage**: Redis operations, state management
- **Utils**: Reusable helper functions

### 4. Error Handling
- Fail open: If validation errors, skip enforcement rather than crash
- Log errors for debugging
- Never block user posts due to bot errors

### 5. Performance
- Cache settings per execution
- Batch Redis operations
- Short-circuit evaluation (check cheap conditions first)
- Keyword matching is O(n), no backtracking

## Development Workflow

1. **Types First**: Define interfaces in `types/index.ts`
2. **Settings**: Add settings in `settings/definitions.ts`
3. **Services**: Implement business logic in `services/`
4. **Handlers**: Wire up Devvit triggers in `handlers/`
5. **Storage**: Add Redis operations in `storage/`
6. **Utils**: Extract reusable logic to `utils/`

## Testing

Tests are located in the `test/` directory at project root.

```
test/
├── unit/              # Unit tests for individual functions
│   ├── keywordMatching.test.ts
│   ├── postValidation.test.ts
│   └── r5Validation.test.ts
└── integration/       # Integration tests
    └── enforcement.test.ts
```

Run tests:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Building

```bash
npm run build         # Compile TypeScript to dist/
npm run watch         # Watch mode for development
```

## Documentation

- See `Docs/` directory for detailed feature specifications
- Each feature domain (1000-13000) has its own documentation
- Architecture overview: `Docs/ARCHITECTURE.md`
- Implementation roadmap: `Docs/ROADMAP.md`
