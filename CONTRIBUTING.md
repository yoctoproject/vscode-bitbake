# Contributing to vscode-bitbake

Thank you for your interest in contributing to the official BitBake extension for
Visual Studio Code. This extension is maintained by the
[Yocto Project](https://www.yoctoproject.org/) and serves developers writing
`.bb`, `.bbappend`, `.bbclass`, `.conf`, and `.inc` files for
[BitBake](https://docs.yoctoproject.org/bitbake/)-based builds.

---

## Code of Conduct

This project follows the
[Yocto Project Code of Conduct](CODE_OF_CONDUCT.md).
By participating you agree to abide by its terms.

---

## Before You Start

- Check the [open issues](https://github.com/yoctoproject/vscode-bitbake/issues)
  to see if your idea or bug is already tracked
- For significant new features, open an issue to discuss the design before
  writing code — this saves effort if the direction needs adjustment
- Small fixes (typos, obvious bugs, documentation) can go straight to a PR

---

## Development Setup

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18.x | [nodejs.org](https://nodejs.org/) |
| npm | ≥ 9.x | Bundled with Node.js |
| VS Code | ≥ 1.92.0 | For running the extension in dev mode |
| Git | any recent | — |

### Clone and install

```bash
git clone https://github.com/yoctoproject/vscode-bitbake.git
cd vscode-bitbake
npm install          # installs root + server/ + client/ dependencies
npm run fetch:wasm   # downloads the tree-sitter WASM binary
```

### Build

```bash
npm run compile      # TypeScript → JavaScript (tsc -b)
```

For incremental builds during development:

```bash
npm run watch
```

### Run in VS Code (extension dev mode)

1. Open the repository root in VS Code
2. Press `F5` (or **Run → Start Debugging**)
3. A new VS Code window opens with the extension loaded from source
4. Open a folder containing a Yocto project to activate the extension

---

## Testing

The test suite has three independent layers. Run all of them before submitting a PR.

### 1 — Unit tests (Jest)

Tests the language server logic (LSP handlers, analyzer, completions, hover,
definitions, symbol declarations).

```bash
npm run jest
```

For watch mode during development:

```bash
npm run test:watch
```

Unit test files live in:
- `server/src/__tests__/` — LSP handler tests
- `client/src/__tests__/unit-tests/` — client-side driver and UI tests

Fixtures (`.bb`, `.bbclass`, `.inc`, `.conf` files used by tests) are in
`server/src/__tests__/fixtures/`.

### 2 — Integration tests

Runs the extension inside a live VS Code instance against a real (minimal) Yocto
project. Requires a display server. On Linux CI this uses `xvfb-run`.

```bash
npm run test:integration
```

> **Note**: Integration tests require a self-hosted runner with Yocto build
> dependencies. If you are submitting a PR without access to such an environment,
> the CI will run them — no action needed on your part.

### 3 — Grammar tests

Tests the TextMate grammar (`client/syntaxes/bitbake.tmLanguage.json`) against
`.bb` fixture files.

```bash
npm run test:grammar
```

### Run everything

```bash
npm test    # jest + integration + grammar
```

---

## Code Style

- TypeScript — strict mode, ESLint enforced
- Run `npm run lint` before submitting
- The project uses tabs for indentation (see `.editorconfig`)
- Imports are organized: VS Code API first, Node built-ins second, local modules last

```bash
npm run lint         # check
npm run lint -- --fix  # auto-fix where possible
```

---

## Project Structure

```
vscode-bitbake/
├── client/          # VS Code extension host (UI, commands, status bar, settings)
│   └── src/
│       ├── extension.ts          # activation entry point
│       ├── driver/               # BitbakeDriver — spawns bitbake processes
│       ├── lib/src/              # shared types (BitbakeSettings, etc.)
│       └── ui/                   # status bar items, pickers
├── server/          # Language server (LSP — runs in separate Node.js process)
│   └── src/
│       ├── tree-sitter/          # analyzer, declarations, utils
│       ├── connectionHandlers/   # onCompletion, onHover, onDefinition, …
│       └── __tests__/            # unit tests + fixtures
├── integration-tests/            # live VS Code integration tests
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
│       └── main.yml              # CI: lint + compile + jest + integration + grammar
└── package.json     # extension manifest, contributes, npm scripts
```

The extension uses a client/server split. The **client** handles VS Code UI and
delegates language intelligence to the **server** via the Language Server Protocol.
Changes to LSP behavior (completions, hover, definitions) live in `server/`.
Changes to UI and commands live in `client/`.

---

## Submitting a Pull Request

1. Fork the repository and create a branch from `main`
2. Follow the naming convention: `fix/<short-description>`, `feat/<short-description>`,
   or `docs/<short-description>`
3. Make your changes. Add or update tests if the change affects logic
4. Run `npm run compile && npm run jest && npm run lint`
5. Write a clear commit message:
   - Use the form `fix(scope): what changed` or `feat(scope): what added`
   - Reference the issue number: `Fixes #NNN`
6. Open a pull request against `main`
7. Fill in the PR description — what problem it solves and how

**Good commit message examples:**
```
fix(lsp): handle OVERRIDE variable in multi-segment completion
feat(ui): add MACHINE status bar picker with local.conf integration
docs: add CONTRIBUTING.md for new contributors
```

---

## Reporting Bugs

Use the [bug report template](https://github.com/yoctoproject/vscode-bitbake/issues/new?template=bug_report.md).
Include:
- OS and VS Code version (`Help → About`)
- Extension version (Extensions panel)
- Yocto release (e.g., Scarthgap 5.0, Walnascar 5.2)
- The BitBake debug log: **Command Palette → BitBake: Show log**
- Output of `code --list-extensions --show-versions`

---

## Requesting Features

Use the [feature request template](https://github.com/yoctoproject/vscode-bitbake/issues/new?template=feature_request.md).
Describe the Yocto workflow you are trying to improve and the VS Code behavior you
would like to see.
