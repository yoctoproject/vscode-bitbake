# vscode-bitbake AI Agents Instructions

This document provides context for AI agents working on the vscode-bitbake project. Use this for consistent contributions across the codebase.
This repository implements a VSCode extension for BitBake, providing language support and integration features.

## Coding Style and Naming Conventions

**Language**: TypeScript with strict mode enabled (`"strict": true`)

**File naming**:
- PascalCase for classes: `BitbakeDriver.ts`, `BitbakeRecipesView.ts`
- camelCase for functions/utilities: `completions/`, `embedded-languages/`
- PascalCase with `.test.ts` suffix for test files: `extensionTest.test.ts`

**Class/Interface naming**:
- Classes: PascalCase (`BitbakeDriver`, `LanguageClient`, `BitbakeTaskProvider`)
- Interfaces: PascalCase with optional `I` prefix (not consistently used, prefer descriptive names)
- Type aliases: PascalCase (`BitbakeScanResult`, `NotificationMethod`)

**Code header**: All `.ts` and `.js` files must include the Savoir-faire Linux copyright header:
```typescript
/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2026 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
```

**Imports**:
- Use `import * as name from 'module'` for namespaced imports
- Use `import { named } from 'module'` for named imports
- Relative imports must use explicit paths: `'./lib/src/utils/OutputLogger'`

**Variables**:
- `const` preferred over `let`; avoid `var`
- camelCase for variables and functions
- Descriptive names matching usage context

## Technology Stack

**Core Technologies**:
- **TypeScript** 5.7.2 (target: ES2020)
- **VSCode Extension API** (VSCode 1.92+)
- **Language Server Protocol (LSP)** via `vscode-languageserver`
- **Tree-sitter** for syntax parsing (Bitbake and Bash)
- **Node.js CommonJS** modules

**Key Runtime Libraries**:
- `vscode` - VSCode extension API
- `vscode-languageserver/node` - LSP server implementation
- `vscode-languageclient/node` - LSP client for extension
- `glob` - File globbing for test discovery
- `mocha` - Integration test framework
- `jest` - Unit testing framework
- `@types/node`, `@types/vscode`, `@types/mocha` - TypeScript definitions

**Build & Development**:
- `tsc` (TypeScript compiler) for compilation
- `ts-jest` for Jest+TypeScript integration
- `eslint` with typescript-eslint for linting
- `eslint-plugin-header` for enforcing license headers
- `vsce` for packaging VSCode extensions
- `tree-sitter-cli` for building Wasm parsers

**Web Support**:
- `extension-web.ts` provides browser-compatible extension entry point (limited features)

## Architectural Patterns

**Client-Server Architecture**:
- **Client** (`client/src/`): VSCode extension UI and integration
  - `extension.ts` / `extension-web.ts` - Main activation and deactivation
  - `language/` - LSP client setup and middleware
  - `ui/` - UI components (views, status bar, commands, notifications)
  - `driver/` - BitBake process execution and environment scanning
  - `lib/` - Shared utilities (re-exports from server/lib)

- **Server** (`server/src/`): Language server process
  - `server.ts` - LSP server initialization and connection
  - `connectionHandlers/` - LSP request handlers (completion, definition, hover, rename, reference)
  - `tree-sitter/` - Syntax analysis and parsing
  - `completions/` - Completion item generation logic
  - `embedded-languages/` - Python and Shell language support within BitBake
  - `semanticTokens.ts` - Semantic token generation for syntax highlighting
  - `utils/`, `lib/` - Shared utilities and types

**Middleware Pattern**:
- `language/middleware*.ts` files intercept LSP requests/responses for client-side enhancement before reaching the server

**Module Organization**:
- Shared code in `lib/src/` (types, constants, utilities)
- Feature-specific directories group related functionality
- Utils directories contain generic helper functions

**Type Safety**:
- Use strict TypeScript with no implicit `any`
- Define types for all public APIs and LSP communication
- Type definitions in `lib/src/types/` for shared types (BitbakeScanResult, NotificationMethod, RequestMethod, etc.)

## Security Requirements and Error Handling

**Command Execution**:
- All BitBake command execution goes through `BitbakeDriver.ts`
- Wrap commands with `bitbake.commandWrapper` config for container/environment isolation
- Environment variables via `bitbake.shellEnv` setting for safe credential handling
- **Never hardcode paths** - use VSCode workspace variables (`${workspaceFolder}`, etc.)

**Error Handling**:
- Catch and log all async operations
- Use try-catch in integration test runners to ensure callbacks are always invoked
- Never let promises reject without handling (prevents process hangs)
- Await all async predicates in assertions (Bug fix example: `await predicate()` not `predicate()`)
- Forward errors to LSP client via notifications or diagnostics

**Process Management**:
- Ensure callbacks (`cb(error, failureCount)`) are called even on error paths
- Catch promise rejections in glob operations and other global handlers
- Use `process.exit(code)` for test runners to ensure proper exit
- Add `.catch()` handlers to all top-level promises

**Configuration**:
- Validate user-provided paths before execution
- Handle missing configuration gracefully with defaults
- Document path expansion behavior (workspace variables are expanded at runtime)

## Documentation Standards

**File Header Comments**:
- Mandatory Savoir-faire Linux copyright header in all source files
- Brief JSDoc comments for public functions and classes

**Code Comments**:
- Comments explain "why" not "what" (code should be self-documenting)
- Use `///` for doc comments in TypeScript
- Inline comments for complex logic

**README Structure**:
- [README.md](README.md) - User-facing feature documentation
- [README-DEVELOPER.md](README-DEVELOPER.md) - Developer setup and contributing guide
- [server/README.md](server/README.md) - Standalone language server installation
- [integration-tests/README.md](integration-tests/README.md) - Integration test specifics

**Commit Messages**:
- Follow conventional commits when possible
- Reference GitHub issues
- Keep messages concise

## npm Commands and Test Architecture

### Build Commands

```bash
npm install                    # Install all dependencies (client, server, root)
npm run fetch                  # Download all external resources
  # Includes:
  # - npm run fetch:poky       - Yocto poky repo for reference
  # - npm run fetch:docs       - BitBake documentation for hover hints
  # - npm run fetch:wasm       - Tree-sitter WASM binaries
  # - npm run fetch:spdx-licenses - SPDX license database

npm run compile                # TypeScript compilation (root + client + server)
npm run watch                  # TypeScript watch mode with post-compile hooks
npm run clean                  # Remove all build artifacts and node_modules
```

### Testing

```bash
npm test                       # Run all tests: jest + integration + grammar
npm run jest                   # Unit tests only (Jest, runs __tests__/**/*.test.ts)
npm run test:integration       # Integration tests (VSCode headless mode, requires Xvfb)
npm run test:grammar           # Syntax highlighting grammar tests
npm run lint                   # ESLint code style check
npm run test:watch             # Jest with file watch mode
```

### Test Architecture

**Unit Tests (Jest)**:
- Framework: Jest with ts-jest preset
- Location: `**/__tests__/**/*.test.ts` pattern
- Runs in: Node.js test environment (not browser)
- Mocking: Mock VSCode API via `__mocks__/vscode.ts`
- Config: `jest.config.js` - env: node, ts-jest with server tsconfig
- Coverage: Collects from `**/*.ts` (excludes test files)

**Integration Tests (Mocha + VSCode Test Electron)**:
- Framework: Mocha in VSCode via `@vscode/test-electron`
- Discovery: `**/**.test.js` files in `integration-tests/src/tests/`
- Setup: `integration-tests/src/suite/index.ts` runs glob and loads test files
- VSCode Version: 1.102.3 (managed by test runner)
- Extensions Installed: bash-ide-vscode, ms-python
- Workspace: `integration-tests/project-folder/` (includes build/, sources/)
- Requirements: `xvfb` (X11 virtual framebuffer for headless tests)
- Execution: Via `xvfb-run node ./integration-tests/out/runTest.js`

**Grammar Tests**:
- Framework: `vscode-tmgrammar-test`
- Test cases: `client/test/grammars/test-cases/*.bb`
- Snapshots: `client/test/grammars/snaps/*.bb`
- Command: `vscode-tmgrammar-test <files>` and `vscode-tmgrammar-snap -u` for updates

### Package and Deploy

```bash
npm run package                # Build .vsix file (vsce package)
npm run vscode:prepublish      # Strip dev dependencies before publishing
npm run dev:vsix               # Full dev build (fetch, compile, package)
npm run dev:npm                # Pack server as npm package
```

### TypeScript Configuration

**Base Config** (`tsconfig.json`):
- Target: ES2020, Module: CommonJS
- Strict mode enabled (`"strict": true`)
- Composite project (enables project references)
- Composite paths managed by root tsconfig

**Client** (`client/tsconfig.json`):
- Extends: Root tsconfig
- Output: `client/out/`
- Entry: `client/src/`

**Server** (`server/tsconfig.json`):
- Extends: Root tsconfig
- Output: `server/out/`
- Entry: `server/src/`

**Integration Tests** (`tsconfig.json` for integration-tests):
- Output: `integration-tests/out/`
- Entry: `integration-tests/src/`
- Excludes: `node_modules`, poky, `.vscode-test`

### ESLint Configuration

- Config: `eslint.config.mjs` (flat format)
- Rules:
  - Mandatory: Savoir-faire Linux copyright header in all `.{js,mjs,cjs,ts}` files
  - Recommended: TypeScript ESLint rules
  - JavaScript: ESLint recommended rules
- Ignores: `out/`, `poky/`, `.vscode-test/`, test mocks, config files, integration-tests project folder

---

**Last Updated**: March 2026
