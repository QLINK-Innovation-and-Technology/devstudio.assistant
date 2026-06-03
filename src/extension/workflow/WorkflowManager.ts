import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import {
  WorkflowPhase,
  PhaseStatus,
  PhaseState,
  FeatureWorkflow,
  WorkflowState,
} from "../../shared/types";

const PERSIST_KEY = "devstudio.assistant.workflow";

const PHASE_COMMANDS: Record<WorkflowPhase, string> = {
  constitution: "/devstudio.factory.constitution",
  specification: "/devstudio.factory.specify",
  planning: "/devstudio.factory.plan",
  tasks: "/devstudio.factory.tasks",
  implementation: "/devstudio.factory.implement",
};

/** Flags that suppress interactive permission prompts for known AI CLIs */
const AGENT_PERMISSION_FLAGS: Record<string, string> = {
  claude: "--permission-mode bypassPermissions",
};

/** Default CLI executable names for each agent type */
const AGENT_CLI_DEFAULTS: Record<string, string> = {
  claude: "claude",
  gemini: "gemini",
  copilot: "ghcs",
  openai: "codex",
};

const FEATURE_PHASES: WorkflowPhase[] = [
  "specification",
  "planning",
  "tasks",
  "implementation",
];
const PHASE_DONE_MARKER = "__DEVSTUDIO_FACTORY_PHASE_DONE__";
const PHASE_DONE_RE =
  /__DEVSTUDIO_FACTORY_PHASE_DONE__:(constitution|specification|planning|tasks|implementation):(-?\d+)/;
const PHASE_DONE_FILE_REL = ".factory/.runtime/phase-done.txt";
const IMPLEMENTATION_COMPLETION_RE = /\bimplementation complete\b/i;
const TASK_CHECKBOX_RE = /^\s*(?:[-*]|\d+\.)\s+\[( |x|X)\]\s+/gm;

// Patterns that indicate the terminal is waiting for user input
const PROMPT_RE =
  /\[y\/n\]|\[Y\/n\]|\[y\/N\]|\(y\/n\)|\(Y\/N\)|\[yes\/no\]|\bpress enter\b|\bhit enter\b|continue\?|proceed\?|are you sure\?|allow .+\?|\[always\]|\[1\].*\[2\]|\baccept\b.*\?|\bconfirm\b.*\?|\boverwrite\b.*\?|\bcreate\b.*\?|write to file|run this command|do you want/i;

/** Parse the last prompt line and return the set of quick-reply button labels, or null if no prompt */
function extractPromptOptions(lines: string[]): string[] | null {
  const text = lines.join("\n");
  if (!PROMPT_RE.test(text)) return null;

  // Numbered menu: [1] ... [2] ...
  if (/\[1\].*\[2\]/i.test(text)) {
    const nums = [...text.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
    if (nums.length > 0) return nums;
  }

  // [y/n] / [Y/n] / [y/N] / (y/n) / (Y/N)
  if (/[\[(][yY]\/[nN][\])]/.test(text)) {
    return ["y", "n"];
  }

  // [yes/no]
  if (/\[yes\/no\]/i.test(text)) {
    return ["yes", "no"];
  }

  // [always] — try to collect all bracket-word options from the line
  if (/\[always\]/i.test(text)) {
    const opts = [...text.matchAll(/\[([a-zA-Z][a-zA-Z ]{0,9})\]/g)].map((m) =>
      m[1].toLowerCase(),
    );
    return opts.length > 0 ? opts : ["always"];
  }

  // press enter / hit enter
  if (/press enter|hit enter/i.test(text)) {
    return ["↵"];
  }

  // Confirm-style prompts
  if (/continue\?|proceed\?|are you sure\?/i.test(text)) {
    return ["y", "n", "↵"];
  }

  // allow ...?
  if (/allow .+\?/i.test(text)) {
    return ["y", "n"];
  }

  return ["y", "n"];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePhaseState(phase: WorkflowPhase): PhaseState {
  return { phase, status: "idle", filePath: null, content: null };
}

function makeFeatureWorkflow(name: string): FeatureWorkflow {
  return { name, phases: FEATURE_PHASES.map(makePhaseState) };
}

function defaultWorkflowState(): WorkflowState {
  return {
    constitutionPhase: makePhaseState("constitution"),
    features: [],
    activeFeatureName: null,
  };
}

/** Strip ANSI/VT escape sequences and non-printable control characters */
function stripAnsi(data: string): string {
  return data
    .replace(/\x1B\[[\x30-\x3F]*[\x20-\x2F]*[\x40-\x7E]/g, "") // CSI sequences
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, "") // OSC sequences
    .replace(/\x1B[\s\S]/g, "") // remaining ESC + char
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""); // control chars (keep \n \r \t)
}

// ─── WorkflowManager ─────────────────────────────────────────────────────────

export class WorkflowManager {
  private _state: WorkflowState;
  private _terminal: vscode.Terminal | null = null;
  private _termBuffer = "";
  private _activePhase: WorkflowPhase | null = null;
  private _onChange: Array<() => void> = [];
  private _onConsoleData:
    | ((text: string, promptOptions: string[] | null) => void)
    | null = null;

  constructor(private readonly _context: vscode.ExtensionContext) {
    this._state = this._load();

    _context.subscriptions.push(
      vscode.window.onDidCloseTerminal((t) => {
        if (t === this._terminal) {
          this._terminal = null;
          this._termBuffer = "";
        }
      }),
      // Stream output via shell integration (VS Code 1.93+, works with bash/zsh/fish/pwsh).
      // The buffer-flush logic in _handleTermData ensures prompts without a trailing \n
      // are forwarded immediately instead of being held until the next newline arrives.
      vscode.window.onDidStartTerminalShellExecution((event) => {
        if (event.terminal === this._terminal) {
          this._streamExecution(event.execution);
        }
      }),
      // When the agent process finishes, transition implementation phase to awaiting_review.
      // Other phases (specification/planning/tasks) are handled by the file watcher instead.
      vscode.window.onDidEndTerminalShellExecution((event) => {
        if (event.terminal !== this._terminal) return;
        if (this._activePhase === "implementation") {
          this._markImplementationAwaitingReview();
        }
        this._activePhase = null;
      }),
    );
  }

  /** Register a callback that fires whenever workflow state changes */
  onStateChange(cb: () => void): void {
    this._onChange.push(cb);
  }

  /** Register a callback that fires whenever terminal output is ready to display */
  onConsoleData(
    cb: (text: string, promptOptions: string[] | null) => void,
  ): void {
    this._onConsoleData = cb;
  }

  getState(): WorkflowState {
    return this._state;
  }

  // ─── Phase actions ──────────────────────────────────────────────────────

  runPhase(phase: WorkflowPhase, prompt?: string): void {
    this._activePhase = phase;
    this._setPhaseStatus(phase, "running");
    this._save();
    this._notify();

    const terminal = this._getOrCreateTerminal();
    const fullCmd = this._buildAgentCommand(phase, prompt);
    terminal.sendText(this._withPhaseDoneMarker(phase, fullCmd));

    if (phase === "implementation") {
      this._maybeMarkImplementationDoneFromTasks();
    }
  }

  approvePhase(phase: WorkflowPhase): void {
    const ps = this._findPhase(phase);
    if (ps) {
      ps.status = "approved";
      ps.stale = false;
    }
    this._save();
    this._notify();
  }

  discardPhase(phase: WorkflowPhase): void {
    const ps = this._findPhase(phase);
    if (ps) {
      ps.status = "idle";
      ps.content = null;
      ps.stale = false;
    }
    this._markDownstreamStale(phase);
    this._save();
    this._notify();
  }

  toggleTask(featureName: string, lineIndex: number, checked: boolean): void {
    const feature = this._state.features.find((f) => f.name === featureName);
    if (!feature) return;
    const taskPhase = feature.phases.find((p) => p.phase === "tasks");
    if (!taskPhase?.filePath || !taskPhase.content) return;

    const lines = taskPhase.content.split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    lines[lineIndex] = lines[lineIndex].replace(
      /^(\s*(?:[-*]|\d+\.)\s+\[)( |x|X)(\])/,
      (_, pre, _c, post) => `${pre}${checked ? "x" : " "}${post}`,
    );

    fs.writeFileSync(taskPhase.filePath, lines.join("\n"), "utf-8");
    // File watcher picks up the change and updates content + state
  }

  setActiveFeature(name: string): void {
    this._state.activeFeatureName = name;
    this._save();
    this._notify();
  }

  createFeature(name: string): void {
    if (this._state.features.find((f) => f.name === name)) {
      this._state.activeFeatureName = name;
      this._save();
      this._notify();
      return;
    }

    const root = this._workspaceRoot();
    if (!root) return;

    const scriptPath = path.join(
      root,
      ".factory",
      "scripts",
      "bash",
      "create-new-feature.sh",
    );

    if (fs.existsSync(scriptPath)) {
      const child = spawn("bash", [scriptPath, name], { cwd: root });
      child.on("close", () => {
        this._addFeature(name, root);
      });
    } else {
      const featureDir = path.join(root, "specs", name);
      fs.mkdirSync(featureDir, { recursive: true });
      this._addFeature(name, root);
    }
  }

  sendToTerminal(text: string): void {
    if (this._terminal && this._terminal.exitStatus === undefined) {
      this._terminal.sendText(text);
    }
  }

  /** Reveal the underlying terminal (escape hatch for debugging) */
  showTerminal(): void {
    this._terminal?.show(true);
  }

  // ─── Called by SidebarProvider when files change ────────────────────────

  onFileEvent(filePath: string): void {
    const root = this._workspaceRoot();
    if (!root) return;

    const rel = path.relative(root, filePath).replace(/\\/g, "/");

    if (rel === PHASE_DONE_FILE_REL) {
      this._phaseDoneSignalArrived(filePath);
      return;
    }

    if (rel === ".factory/memory/constitution.md") {
      this._fileArrived(this._state.constitutionPhase, filePath);
      return;
    }

    const m = rel.match(/^specs\/([^/]+)\/(spec|plan|tasks)\.md$/);
    if (!m) return;

    const [, featureName, fileKind] = m;
    const phaseMap: Record<string, WorkflowPhase> = {
      spec: "specification",
      plan: "planning",
      tasks: "tasks",
    };
    const targetPhase = phaseMap[fileKind];

    let feature = this._state.features.find((f) => f.name === featureName);
    if (!feature) {
      this._addFeature(featureName, root);
      feature = this._state.features.find((f) => f.name === featureName)!;
    }

    const ps = feature.phases.find((p) => p.phase === targetPhase);
    if (ps) {
      this._fileArrived(ps, filePath);
      if (targetPhase === "tasks") {
        this._maybeMarkImplementationDoneFromTasks();
      }
    }
  }

  // ─── Reconcile existing disk files on startup ────────────────────────────

  reconcileWithDisk(root: string): void {
    const constitutionPath = path.join(
      root,
      ".factory",
      "memory",
      "constitution.md",
    );
    if (
      fs.existsSync(constitutionPath) &&
      this._state.constitutionPhase.status === "idle"
    ) {
      this._fileArrived(this._state.constitutionPhase, constitutionPath);
    }
    this._state.constitutionPhase.filePath = fs.existsSync(constitutionPath)
      ? constitutionPath
      : null;

    const specsDir = path.join(root, "specs");
    if (fs.existsSync(specsDir)) {
      const entries = fs.readdirSync(specsDir, { withFileTypes: true });
      for (const entry of entries.filter((e) => e.isDirectory())) {
        const name = entry.name;
        if (!this._state.features.find((f) => f.name === name)) {
          this._state.features.push(makeFeatureWorkflow(name));
        }
        const feature = this._state.features.find((f) => f.name === name)!;

        const fileMap: Array<{ file: string; phase: WorkflowPhase }> = [
          { file: "spec.md", phase: "specification" },
          { file: "plan.md", phase: "planning" },
          { file: "tasks.md", phase: "tasks" },
        ];
        for (const { file, phase } of fileMap) {
          const fp = path.join(specsDir, name, file);
          const ps = feature.phases.find((p) => p.phase === phase)!;
          ps.filePath = fs.existsSync(fp) ? fp : null;
          if (ps.filePath && ps.status === "idle") {
            this._fileArrived(ps, fp);
          }
        }
      }
    }

    if (!this._state.activeFeatureName && this._state.features.length > 0) {
      this._state.activeFeatureName = this._state.features[0].name;
    }

    this._save();
  }

  // ─── Terminal output handling ─────────────────────────────────────────────

  /** Async-iterate a shell execution's output stream and forward lines to the console panel */
  private _streamExecution(execution: vscode.TerminalShellExecution): void {
    void (async () => {
      for await (const data of execution.read()) {
        this._handleTermData(data);
      }
    })();
  }

  private _handleTermData(raw: string): void {
    const clean = stripAnsi(raw);
    this._termBuffer += clean;

    // Prompts like "Continue? [y/n] " never end with \n — they wait for input on the same line.
    // Flush the buffer immediately when a prompt pattern is detected so the UI can show buttons.
    if (PROMPT_RE.test(this._termBuffer) && !this._termBuffer.endsWith("\n")) {
      this._termBuffer += "\n";
    }

    const lines = this._termBuffer.split("\n");
    this._termBuffer = lines.pop() ?? "";

    // Collapse carriage-return overwrites (spinner animations) — keep last segment per line
    const processed = lines
      .map((line) => {
        const segs = line.split("\r");
        return segs[segs.length - 1].trimEnd();
      })
      .filter((line) => line.length > 0);

    if (processed.length === 0) return;

    const visibleLines: string[] = [];
    for (const line of processed) {
      const done = line.match(PHASE_DONE_RE);
      if (done) {
        this._onPhaseDoneSignal(done[1] as WorkflowPhase);
        continue;
      }
      visibleLines.push(line);
    }

    if (visibleLines.length === 0) return;

    // Some agents can finish work but keep the process/session open. When implementation
    // explicitly reports completion, transition the phase without waiting for process exit.
    if (
      this._activePhase === "implementation" &&
      visibleLines.some((line) => IMPLEMENTATION_COMPLETION_RE.test(line))
    ) {
      this._markImplementationAwaitingReview();
      this._activePhase = null;
    }

    if (this._activePhase === "implementation") {
      this._maybeMarkImplementationDoneFromTasks();
    }

    const text = visibleLines.join("\n");
    const promptOptions = extractPromptOptions(visibleLines);
    this._onConsoleData?.(text, promptOptions);
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private _addFeature(name: string, root: string): void {
    if (!this._state.features.find((f) => f.name === name)) {
      this._state.features.push(makeFeatureWorkflow(name));
    }
    this._state.activeFeatureName = name;
    this.reconcileWithDisk(root);
    this._save();
    this._notify();
  }

  private _fileArrived(ps: PhaseState, filePath: string): void {
    ps.filePath = filePath;
    if (ps.status !== "approved") {
      ps.status = "awaiting_review";
    }
    try {
      ps.content = fs.readFileSync(filePath, "utf-8");
    } catch {
      // ignore
    }
    this._save();
    this._notify();
  }

  private _phaseDoneSignalArrived(filePath: string): void {
    try {
      const payload = fs.readFileSync(filePath, "utf-8").trim();
      const m = payload.match(
        /^(constitution|specification|planning|tasks|implementation):(-?\d+)$/,
      );
      if (!m) return;
      this._onPhaseDoneSignal(m[1] as WorkflowPhase);
    } catch {
      // ignore transient read errors while the file is being written
    }
  }

  private _onPhaseDoneSignal(phase: WorkflowPhase): void {
    if (phase === "implementation") {
      this._markImplementationAwaitingReview();
    }
    if (this._activePhase === phase) {
      this._activePhase = null;
    }
  }

  private _markImplementationAwaitingReview(): void {
    const ps = this._findPhase("implementation");
    if (ps && ps.status === "running") {
      ps.status = "awaiting_review";
      this._save();
      this._notify();
    }
  }

  private _maybeMarkImplementationDoneFromTasks(): void {
    if (this._activePhase !== "implementation") return;

    const featureName = this._state.activeFeatureName;
    if (!featureName) return;

    const tasksPath = this._resolveTasksPath(featureName);
    if (!tasksPath) return;

    if (this._areAllTaskCheckboxesChecked(tasksPath)) {
      this._markImplementationAwaitingReview();
      this._activePhase = null;
    }
  }

  private _resolveTasksPath(featureName: string): string | null {
    const feature =
      this._state.features.find((f) => f.name === featureName) ?? null;
    const fromState =
      feature?.phases.find((p) => p.phase === "tasks")?.filePath ?? null;
    if (fromState) return fromState;

    const root = this._workspaceRoot();
    if (!root) return null;

    const fallback = path.join(root, "specs", featureName, "tasks.md");
    return fs.existsSync(fallback) ? fallback : null;
  }

  private _areAllTaskCheckboxesChecked(tasksPath: string): boolean {
    let content = "";
    try {
      content = fs.readFileSync(tasksPath, "utf-8");
    } catch {
      return false;
    }

    const matches = [...content.matchAll(TASK_CHECKBOX_RE)];
    if (matches.length === 0) return false;
    return matches.every((m) => m[1].toLowerCase() === "x");
  }

  private _markDownstreamStale(discarded: WorkflowPhase): void {
    if (discarded === "constitution") {
      // Every approved feature phase becomes stale
      for (const feature of this._state.features) {
        for (const p of feature.phases) {
          if (p.status === "approved") p.stale = true;
        }
      }
      return;
    }

    const feature = this._activeFeature();
    if (!feature) return;

    const idx = FEATURE_PHASES.indexOf(discarded);
    for (let i = idx + 1; i < FEATURE_PHASES.length; i++) {
      const later = feature.phases.find((p) => p.phase === FEATURE_PHASES[i]);
      if (later && later.status === "approved") later.stale = true;
    }
  }

  private _setPhaseStatus(phase: WorkflowPhase, status: PhaseStatus): void {
    const ps = this._findPhase(phase);
    if (ps) {
      ps.status = status;
    }
  }

  private _findPhase(phase: WorkflowPhase): PhaseState | null {
    if (phase === "constitution") {
      return this._state.constitutionPhase;
    }
    const feature = this._activeFeature();
    if (!feature) return null;
    return feature.phases.find((p) => p.phase === phase) ?? null;
  }

  private _activeFeature(): FeatureWorkflow | null {
    if (!this._state.activeFeatureName) return null;
    return (
      this._state.features.find(
        (f) => f.name === this._state.activeFeatureName,
      ) ?? null
    );
  }

  private _getOrCreateTerminal(): vscode.Terminal {
    if (this._terminal && this._terminal.exitStatus === undefined) {
      return this._terminal;
    }
    const root = this._workspaceRoot();

    this._terminal = vscode.window.createTerminal({
      name: "DevStudio Assistant",
      cwd: root ?? undefined,
    });
    this._termBuffer = "";
    return this._terminal;
  }

  /**
   * Build the full shell command to run a phase for whichever AI agent is configured.
   *
   * claude:  claude --permission-mode bypassPermissions "/devstudio.factory.plan specs/feat"
   * gemini:  printf '%s' "/devstudio.factory.plan specs/feat" | gemini
   * copilot: ghcs "/devstudio.factory.plan specs/feat"
   * openai:  printf '%s' "/devstudio.factory.plan specs/feat" | codex exec -
   *
   * User context/refinements (prompt) are prepended to the slash command.
   */
  private _buildAgentCommand(phase: WorkflowPhase, prompt?: string): string {
    const cfg = vscode.workspace.getConfiguration("devstudio.assistant");
    const agentType = cfg.get<string>("aiAgent", "claude");
    const cliPath =
      cfg.get<string>("agentPath", "") ||
      AGENT_CLI_DEFAULTS[agentType] ||
      agentType;

    // Resolve the target directory for feature phases
    const specArg = this._resolveSpecArg(phase);
    const slashCmd = `${PHASE_COMMANDS[phase]}${specArg ? ` ${specArg}` : ""}`;

    // Combine user context with the slash command
    const userContext = prompt?.trim();
    const agentPrompt = userContext
      ? `${userContext}\n\n${slashCmd}`
      : slashCmd;

    // Escape single quotes in the prompt for the printf approach
    const escapedSQ = agentPrompt.replace(/'/g, `'"'"'`);
    // Escape double quotes for agents that use double-quoted args
    const escapedDQ = agentPrompt.replace(/"/g, '\\"');

    switch (agentType) {
      case "claude": {
        const permFlag = AGENT_PERMISSION_FLAGS["claude"];
        return `${cliPath} ${permFlag} "${escapedDQ}"`;
      }
      case "gemini":
        // Gemini CLI reads from stdin in non-interactive mode when piped
        return `printf '%s' '${escapedSQ}' | ${cliPath}`;
      case "copilot":
        // ghcs accepts the prompt as a positional argument
        return `${cliPath} "${escapedDQ}"`;
      case "openai":
        // Codex exec reads from stdin
        return `printf '%s' '${escapedSQ}' | ${cliPath} exec -`;
      default:
        // Generic fallback: pass as a quoted argument
        return `${cliPath} "${escapedDQ}"`;
    }
  }

  /**
   * Wrap a phase command to emit a completion marker line that can be parsed from
   * terminal output even when shell execution end events are unavailable.
   */
  private _withPhaseDoneMarker(phase: WorkflowPhase, cmd: string): string {
    return `(${cmd}); __devstudio_exit=$?; mkdir -p .factory/.runtime; printf '%s\\n' "${phase}:$__devstudio_exit" > "${PHASE_DONE_FILE_REL}"; echo "${PHASE_DONE_MARKER}:${phase}:$__devstudio_exit"`;
  }

  /**
   * Return the relative spec directory argument for a phase, e.g. "specs/my-feature".
   * Constitution has no target directory.
   */
  private _resolveSpecArg(phase: WorkflowPhase): string | null {
    if (phase === "constitution") return null;
    const root = this._workspaceRoot();
    const featureName = this._state.activeFeatureName;
    if (!root || !featureName) return null;
    return `specs/${featureName}`;
  }

  private _workspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  }

  private _load(): WorkflowState {
    const saved = this._context.workspaceState.get<WorkflowState>(PERSIST_KEY);
    return saved ?? defaultWorkflowState();
  }

  private _save(): void {
    this._context.workspaceState.update(PERSIST_KEY, this._state);
  }

  private _notify(): void {
    for (const cb of this._onChange) cb();
  }
}
