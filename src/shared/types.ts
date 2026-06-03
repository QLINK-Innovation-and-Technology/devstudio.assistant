// ─── File tree ────────────────────────────────────────────────────────────────

export type FileKind = 'constitution' | 'spec' | 'plan' | 'tasks' | 'other';

export type FileItem = {
  name: string;
  /** Absolute path on the filesystem */
  path: string;
  kind: FileKind;
};

export type FeatureGroup = {
  name: string;
  files: FileItem[];
};

export type FileTree = {
  constitution: FileItem | null;
  features: FeatureGroup[];
};

// ─── Workflow domain ──────────────────────────────────────────────────────────

export type WorkflowPhase =
  | 'constitution'
  | 'specification'
  | 'planning'
  | 'tasks'
  | 'implementation';

export type PhaseStatus =
  | 'idle'             // not yet started
  | 'running'          // command sent to terminal, waiting for AI to generate file
  | 'awaiting_review'  // file appeared on disk, ready for user review
  | 'approved';        // user approved, phase complete

export type PhaseState = {
  phase: WorkflowPhase;
  status: PhaseStatus;
  /** Absolute path to the generated .md file, or null */
  filePath: string | null;
  /** Cached file content from disk */
  content: string | null;
  /** True when an earlier phase was re-run after this one was already approved */
  stale?: boolean;
};

export type FeatureWorkflow = {
  name: string;
  /** Always [specification, planning, tasks, implementation] */
  phases: PhaseState[];
};

export type WorkflowState = {
  constitutionPhase: PhaseState;
  features: FeatureWorkflow[];
  activeFeatureName: string | null;
};

// ─── Messages: Extension Host → Webview ──────────────────────────────────────

export type ExtToWebMsg =
  | { type: 'fileTree'; tree: FileTree }
  | { type: 'fileContent'; path: string; title: string; content: string }
  | { type: 'noWorkspace' }
  | { type: 'noDevstudio'; defaultAgent: string }
  | { type: 'initializing'; agent: string }
  | { type: 'workflowState'; state: WorkflowState }
  | { type: 'consoleOutput'; text: string; promptOptions: string[] | null };

// ─── Messages: Webview → Extension Host ──────────────────────────────────────

export type WebToExtMsg =
  | { type: 'ready' }
  | { type: 'refresh' }
  | { type: 'selectFile'; path: string }
  | { type: 'openInEditor'; path: string }
  | { type: 'initProject'; agent: string }
  | { type: 'runPhase'; phase: WorkflowPhase; prompt?: string }
  | { type: 'approvePhase'; phase: WorkflowPhase }
  | { type: 'discardPhase'; phase: WorkflowPhase }
  | { type: 'createFeature'; name: string }
  | { type: 'setActiveFeature'; name: string }
  | { type: 'terminalInput'; text: string }
  | { type: 'showTerminal' }
  | { type: 'toggleTask'; featureName: string; lineIndex: number; checked: boolean };
