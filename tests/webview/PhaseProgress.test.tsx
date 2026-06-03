import React from "react";
import { render, screen } from "@testing-library/react";
import PhaseProgress from "../../src/webview/components/PhaseProgress";
import {
  FeatureWorkflow,
  PhaseState,
  PhaseStatus,
  WorkflowPhase,
} from "../../src/shared/types";

function phase(phaseName: WorkflowPhase, status: PhaseStatus): PhaseState {
  return {
    phase: phaseName,
    status,
    filePath: null,
    content: null,
  };
}

function featureWithStatuses(
  statuses: Record<Exclude<WorkflowPhase, "constitution">, PhaseStatus>,
): FeatureWorkflow {
  return {
    name: "feature-a",
    phases: [
      phase("specification", statuses.specification),
      phase("planning", statuses.planning),
      phase("tasks", statuses.tasks),
      phase("implementation", statuses.implementation),
    ],
  };
}

describe("PhaseProgress", () => {
  it("renders all step statuses and visual states", () => {
    const feature = featureWithStatuses({
      specification: "idle",
      planning: "running",
      tasks: "awaiting_review",
      implementation: "approved",
    });

    render(
      <PhaseProgress constitutionStatus="approved" activeFeature={feature} />,
    );

    const constLabel = screen.getByText("Const.");
    const specLabel = screen.getByText("Spec");
    const planLabel = screen.getByText("Plan");
    const tasksLabel = screen.getByText("Tasks");
    const implLabel = screen.getByText("Impl.");

    const constIcon = constLabel.previousSibling as HTMLElement;
    const specIcon = specLabel.previousSibling as HTMLElement;
    const planIcon = planLabel.previousSibling as HTMLElement;
    const tasksIcon = tasksLabel.previousSibling as HTMLElement;
    const implIcon = implLabel.previousSibling as HTMLElement;

    expect(constIcon).toHaveTextContent("✓");
    expect(specIcon).toHaveTextContent("○");
    expect(planIcon).toHaveTextContent("◌");
    expect(tasksIcon).toHaveTextContent("●");
    expect(implIcon).toHaveTextContent("✓");

    expect(planIcon).toHaveClass("running-pulse");
    expect(specLabel).toHaveStyle("opacity: 0.35");
    expect(implLabel).toHaveStyle(
      "color: var(--vscode-terminal-ansiGreen, #4ec9b0)",
    );
  });

  it("falls back to idle statuses when there is no active feature", () => {
    render(<PhaseProgress constitutionStatus="running" activeFeature={null} />);

    const constLabel = screen.getByText("Const.");
    const constIcon = constLabel.previousSibling as HTMLElement;

    expect(constIcon).toHaveTextContent("◌");
    expect(constIcon).toHaveClass("running-pulse");
    expect(screen.getAllByText("○")).toHaveLength(4);
  });
});
