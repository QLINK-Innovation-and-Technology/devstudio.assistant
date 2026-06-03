import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FeatureWorkflow,
  PhaseState,
  PhaseStatus,
  WorkflowPhase,
  WorkflowState,
  WebToExtMsg,
} from "../../src/shared/types";

vi.mock("../../src/webview/components/PhaseProgress", () => ({
  default: ({
    constitutionStatus,
    activeFeature,
  }: {
    constitutionStatus: string;
    activeFeature: FeatureWorkflow | null;
  }) => (
    <div data-testid="phase-progress">{`${constitutionStatus}:${activeFeature?.name ?? "none"}`}</div>
  ),
}));

vi.mock("../../src/webview/components/FeatureManager", () => ({
  default: ({
    onSelect,
    onCreate,
  }: {
    onSelect(name: string): void;
    onCreate(name: string): void;
  }) => (
    <div data-testid="feature-manager">
      <button onClick={() => onSelect("feature-b")}>select-feature</button>
      <button onClick={() => onCreate("feature-c")}>create-feature</button>
    </div>
  ),
}));

vi.mock("../../src/webview/components/PhaseCard", () => ({
  default: ({
    phase,
    onRun,
    onApprove,
    onDiscard,
    onOpenInEditor,
    onTerminalInput,
  }: {
    phase: PhaseState;
    onRun(prompt?: string): void;
    onApprove(): void;
    onDiscard(): void;
    onOpenInEditor(path: string): void;
    onTerminalInput(text: string): void;
  }) => (
    <div data-testid="phase-card">
      <span>{`phase:${phase.phase}`}</span>
      <button onClick={() => onRun("context-from-test")}>run-phase</button>
      <button onClick={onApprove}>approve-phase</button>
      <button onClick={onDiscard}>discard-phase</button>
      <button onClick={() => onOpenInEditor("/tmp/generated.md")}>
        open-phase-file
      </button>
      <button onClick={() => onTerminalInput("reply-from-phase-card")}>
        phase-terminal-input
      </button>
    </div>
  ),
}));

vi.mock("../../src/webview/components/ConsolePanel", () => ({
  default: ({
    onSend,
    onReply,
    onClear,
    onShowTerminal,
  }: {
    onSend(text: string): void;
    onReply(text: string): void;
    onClear(): void;
    onShowTerminal(): void;
  }) => (
    <div data-testid="console-panel">
      <button onClick={() => onSend("send-from-console")}>console-send</button>
      <button onClick={() => onReply("reply-from-console")}>
        console-reply
      </button>
      <button onClick={onClear}>console-clear</button>
      <button onClick={onShowTerminal}>console-show-terminal</button>
    </div>
  ),
}));

import WorkflowView from "../../src/webview/components/WorkflowView";

function phase(name: WorkflowPhase, status: PhaseStatus): PhaseState {
  return {
    phase: name,
    status,
    filePath: null,
    content: null,
  };
}

function feature(
  name: string,
  statuses: Record<Exclude<WorkflowPhase, "constitution">, PhaseStatus>,
): FeatureWorkflow {
  return {
    name,
    phases: [
      phase("specification", statuses.specification),
      phase("planning", statuses.planning),
      phase("tasks", statuses.tasks),
      phase("implementation", statuses.implementation),
    ],
  };
}

function renderWorkflow(state: WorkflowState) {
  const onMessage = vi.fn<(msg: WebToExtMsg) => void>();
  const onClearConsole = vi.fn();
  const onClearPrompt = vi.fn();

  render(
    <WorkflowView
      state={state}
      onMessage={onMessage}
      consoleLines={["line 1"]}
      promptOptions={["y", "n"]}
      onClearConsole={onClearConsole}
      onClearPrompt={onClearPrompt}
    />,
  );

  return { onMessage, onClearConsole, onClearPrompt };
}

describe("WorkflowView", () => {
  it("handles constitution phase actions and console interactions", () => {
    const state: WorkflowState = {
      constitutionPhase: phase("constitution", "running"),
      features: [
        feature("feature-a", {
          specification: "idle",
          planning: "idle",
          tasks: "idle",
          implementation: "idle",
        }),
      ],
      activeFeatureName: "feature-a",
    };

    const { onMessage, onClearConsole, onClearPrompt } = renderWorkflow(state);

    expect(screen.getByTestId("phase-progress")).toHaveTextContent(
      "running:feature-a",
    );
    expect(screen.getByText("phase:constitution")).toBeInTheDocument();
    expect(screen.queryByTestId("feature-manager")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "run-phase" }));
    fireEvent.click(screen.getByRole("button", { name: "approve-phase" }));
    fireEvent.click(screen.getByRole("button", { name: "discard-phase" }));
    fireEvent.click(screen.getByRole("button", { name: "open-phase-file" }));
    fireEvent.click(
      screen.getByRole("button", { name: "phase-terminal-input" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "console-send" }));
    fireEvent.click(screen.getByRole("button", { name: "console-reply" }));
    fireEvent.click(screen.getByRole("button", { name: "console-clear" }));
    fireEvent.click(
      screen.getByRole("button", { name: "console-show-terminal" }),
    );

    expect(onMessage).toHaveBeenCalledWith({
      type: "runPhase",
      phase: "constitution",
      prompt: "context-from-test",
    });
    expect(onMessage).toHaveBeenCalledWith({
      type: "approvePhase",
      phase: "constitution",
    });
    expect(onMessage).toHaveBeenCalledWith({
      type: "discardPhase",
      phase: "constitution",
    });
    expect(onMessage).toHaveBeenCalledWith({
      type: "openInEditor",
      path: "/tmp/generated.md",
    });
    expect(onMessage).toHaveBeenCalledWith({
      type: "terminalInput",
      text: "reply-from-phase-card",
    });
    expect(onMessage).toHaveBeenCalledWith({
      type: "terminalInput",
      text: "send-from-console",
    });
    expect(onMessage).toHaveBeenCalledWith({
      type: "terminalInput",
      text: "reply-from-console",
    });
    expect(onMessage).toHaveBeenCalledWith({ type: "showTerminal" });

    expect(onClearPrompt).toHaveBeenCalledTimes(2);
    expect(onClearConsole).toHaveBeenCalledTimes(1);
  });

  it("shows feature manager and uses first non-approved feature phase", () => {
    const state: WorkflowState = {
      constitutionPhase: phase("constitution", "approved"),
      features: [
        feature("feature-a", {
          specification: "approved",
          planning: "awaiting_review",
          tasks: "idle",
          implementation: "idle",
        }),
      ],
      activeFeatureName: "feature-a",
    };

    const { onMessage } = renderWorkflow(state);

    expect(screen.getByTestId("phase-progress")).toHaveTextContent(
      "approved:feature-a",
    );
    expect(screen.getByTestId("feature-manager")).toBeInTheDocument();
    expect(screen.getByText("phase:planning")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "select-feature" }));
    fireEvent.click(screen.getByRole("button", { name: "create-feature" }));

    expect(onMessage).toHaveBeenCalledWith({
      type: "setActiveFeature",
      name: "feature-b",
    });
    expect(onMessage).toHaveBeenCalledWith({
      type: "createFeature",
      name: "feature-c",
    });
  });

  it("shows the create-feature hint when constitution is approved but no feature is active", () => {
    const state: WorkflowState = {
      constitutionPhase: phase("constitution", "approved"),
      features: [],
      activeFeatureName: null,
    };

    renderWorkflow(state);

    expect(screen.getByText("Constitution approved.")).toBeInTheDocument();
    expect(screen.queryByTestId("phase-card")).not.toBeInTheDocument();
  });

  it("shows all-done message when active feature has all phases approved", () => {
    const state: WorkflowState = {
      constitutionPhase: phase("constitution", "approved"),
      features: [
        feature("feature-done", {
          specification: "approved",
          planning: "approved",
          tasks: "approved",
          implementation: "approved",
        }),
      ],
      activeFeatureName: "feature-done",
    };

    renderWorkflow(state);

    expect(
      screen.getByText(/All phases complete for/i, { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.getByText("feature-done")).toBeInTheDocument();
    expect(screen.queryByTestId("phase-card")).not.toBeInTheDocument();
  });
});
