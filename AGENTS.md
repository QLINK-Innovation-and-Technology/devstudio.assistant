# AGENTS.md — DevStudio Assistant

This file is the **product-scoped AI agent entry point** for the DevStudio Assistant VS Code extension. It describes the codebase architecture, source layout, build system, testing patterns, and conventions that apply when working with files under `projects/devstudio.assistant/`.

---

## Product overview

**DevStudio Assistant** is a VS Code extension that provides a visual sidebar orchestrator for the full Spec-Driven Development (SDD) workflow. It integrates with **DevStudio Factory** (the CLI product at `projects/devstudio.factory/`) to drive phase-by-phase guided execution — from constitution authoring through specification, planning, task generation, and implementation — with a live console, interactive task checklist, stale-phase alerts, and an interactive DAG workflow map.

- **Publisher:** `qlink-innovation-and-technology`
- **Extension name:** `devstudio-assistant`
- **Command namespace:** `devstudio.assistant.*`
- **Config namespace:** `devstudio.assistant.*`
- **Workspace folder (when open as multi-root root):** `${workspaceFolder}` resolves to `projects/devstudio.assistant/`

---

## Source layout

```text
projects/devstudio.assistant/
├── src/
│   ├── extension/          # Extension host code (Node.js, VS Code API)
│   │   ├── extension.ts    # Entry point — command registration, activation
│   │   ├── panels/
│   │   │   ├── SidebarProvider.ts   # WebviewViewProvider for the sidebar panel
│   │   │   └── DagPanel.ts          # WebviewPanel for the interactive DAG view
│   │   └── workflow/
│   │       └── WorkflowManager.ts   # Phase orchestration, terminal execution, state persistence
│   ├── webview/            # React app for the sidebar UI (webview context)
│   │   ├── App.tsx         # Root component; renders phase phases, task list, console
│   │   └── ...
│   ├── webview-dag/        # React app for the DAG panel UI (separate webview context)
│   │   ├── DagApp.tsx      # Root component; renders interactive workflow graph
│   │   └── ...
│   └── shared/
│       └── types.ts        # Shared message protocol types (extension ↔ webview IPC)
├── tests/                  # vitest unit and integration tests
├── resources/              # Extension icon and static assets
├── .vscode/
│   ├── launch.json         # "Run Extension" debug configuration (ExtensionHost)
│   ├── tasks.json          # Build and watch npm tasks
│   └── settings.json       # Workspace-scoped editor and Copilot settings
├── package.json            # Extension manifest — contribution points, commands, settings
├── tsconfig.json           # TypeScript compilation configuration
├── webpack.config.js       # Webpack build configuration (3 bundles)
└── vitest.config.ts        # vitest configuration
```

---

## Architecture boundaries

### Extension host (`src/extension/`)

Runs in the VS Code extension host process (Node.js, full VS Code API access). Responsible for:

- Registering commands (`devstudio.assistant.refreshFiles`, `devstudio.assistant.openInEditor`, `devstudio.assistant.openDag`)
- Providing the sidebar webview (`SidebarProvider`) and DAG panel (`DagPanel`)
- Executing DevStudio Factory CLI commands via VS Code terminal (`WorkflowManager`)
- File-system watchers on `.factory/**/*`
- Persisting workflow state via `vscode.Memento` with key `devstudio.assistant.workflow`

### Webviews (`src/webview/`, `src/webview-dag/`)

Run inside sandboxed webview contexts — **no direct VS Code API access**. Communication with the extension host is exclusively through the `vscode.postMessage` / `panel.webview.onDidReceiveMessage` IPC bridge using the shared message types in `src/shared/types.ts`.

### Shared types (`src/shared/types.ts`)

The single source of truth for all messages exchanged between the extension host and any webview. Modify this file whenever adding a new message direction or payload shape. Both the extension bundle and the webview bundles import from this file.

---

## Build system (webpack)

Three independent webpack bundles are produced by `webpack.config.js`:

| Bundle | Entry | Output | Target |
| :--- | :--- | :--- | :--- |
| Extension | `src/extension/extension.ts` | `dist/extension.js` | `node` (extension host) |
| Sidebar webview | `src/webview/index.tsx` | `dist/webview.js` | `web` (webview) |
| DAG webview | `src/webview-dag/index.tsx` | `dist/webview-dag.js` | `web` (webview) |

Build commands (from `projects/devstudio.assistant/`):

```bash
npm run build      # production build (all 3 bundles)
npm run dev        # watch mode (all 3 bundles)
```

Type-check only (no emit):

```bash
npx tsc --noEmit
```

---

## Testing (vitest)

Tests live in `tests/`. Run from `projects/devstudio.assistant/`:

```bash
npm test           # run all tests once
npm run test:watch # run tests in watch mode
```

Configuration is in `vitest.config.ts`. Tests mock VS Code APIs using the `@vscode/test-electron` pattern where needed. Do not import `vscode` directly in test files — use the mock helpers.

---

## Debugging

Open the workspace as the multi-root `devstudio.code-workspace`. The **"Run Extension"** launch configuration in `projects/devstudio.assistant/.vscode/launch.json` starts an Extension Development Host with the built extension loaded. Run a build first:

1. `Ctrl+Shift+B` → select **build** task (or run `npm run build` in the terminal)
2. `F5` → launches the Extension Development Host

`${workspaceFolder}` in launch.json and tasks.json resolves to `projects/devstudio.assistant/` when the workspace is open as multi-root.

---

## Key conventions

- **Command IDs** follow the pattern `devstudio.assistant.<action>` — do not mix with Factory command IDs.
- **Config keys** follow the pattern `devstudio.assistant.<key>` — declared in `package.json` `contributes.configuration`.
- **CLI integration** calls `devstudio` commands (Factory CLI) — never `speckit` or legacy names.
- **Runtime directory** is `.factory/.runtime/` relative to the open workspace root.
- **Message types** are defined only in `src/shared/types.ts` — do not define inline message shapes elsewhere.
- **No `speckit`, `specify`, `dmux`, or `rfsales` strings** — these are legacy identifiers that have been fully migrated.

---

## Related entry points

| Artifact | Path |
| :--- | :--- |
| Platform AGENTS.md | [`AGENTS.md`](../../AGENTS.md) |
| DevStudio Factory AGENTS.md | [`projects/devstudio.factory/AGENTS.md`](../devstudio.factory/AGENTS.md) |
| Extension manifest | [`package.json`](package.json) |
| Extension README | [`README.md`](README.md) |
