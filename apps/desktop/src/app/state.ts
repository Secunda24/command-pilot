import type {
  ApprovalRecord,
  CommandExecutionResult,
  CommandStatus,
  DemoSnapshot,
  StepStatus
} from "@commandpilot/core";

export function pushExecution(previous: DemoSnapshot, result: CommandExecutionResult): DemoSnapshot {
  const runningTasks =
    result.status === "completed"
      ? previous.runningTasks
      : [result, ...previous.runningTasks].slice(0, 4);

  return {
    ...previous,
    recentCommands: [result, ...previous.recentCommands].slice(0, 6),
    runningTasks,
    pendingApprovals: [...result.approvalsRequested, ...previous.pendingApprovals].slice(0, 6),
    activity: [...result.activityLog, ...previous.activity].slice(0, 24)
  };
}

export function updateExecutionFromApproval(
  execution: CommandExecutionResult,
  decision: "approved" | "denied",
  message: string
): CommandExecutionResult {
  const timestamp = new Date().toISOString();
  const status: CommandStatus = decision === "approved" ? "completed" : "failed";

  const steps = execution.steps.map((step) => {
    if (step.status === "awaiting_approval") {
      const nextStatus: StepStatus = decision === "approved" ? "completed" : "failed";
      return {
        ...step,
        status: nextStatus,
        completedAt: decision === "approved" ? timestamp : undefined,
        errorMessage: decision === "denied" ? "Approval denied by user." : undefined
      };
    }

    if (step.status === "pending") {
      const nextStatus: StepStatus = decision === "approved" ? "completed" : "skipped";
      return {
        ...step,
        status: nextStatus,
        completedAt: decision === "approved" ? timestamp : undefined
      };
    }

    return step;
  });

  return {
    ...execution,
    status,
    echoMessage: message,
    completionSummary: message,
    approvalsRequested: [],
    steps,
    plan: {
      ...execution.plan,
      status,
      steps
    },
    activityLog: [
      {
        id: `approval-log-${timestamp}`,
        commandId: execution.plan.id,
        title: decision === "approved" ? "Approval granted" : "Approval denied",
        details: message,
        type: "approval",
        status: decision === "approved" ? "success" : "warning",
        createdAt: timestamp
      },
      ...execution.activityLog
    ]
  };
}

export function applyApprovalDecision(
  previous: DemoSnapshot,
  approval: ApprovalRecord,
  decision: "approved" | "denied",
  message: string,
  resolvedExecution?: CommandExecutionResult
): DemoSnapshot {
  const updateResult = (result: CommandExecutionResult) =>
    result.plan.id === approval.commandId
      ? resolvedExecution ?? updateExecutionFromApproval(result, decision, message)
      : result;

  const resolvedLog = {
    id: `activity-${Date.now()}`,
    commandId: approval.commandId,
    title: decision === "approved" ? "Approval granted" : "Approval denied",
    details: approval.title,
    type: "approval" as const,
    status: decision === "approved" ? "success" as const : "warning" as const,
    createdAt: new Date().toISOString()
  };

  return {
    ...previous,
    pendingApprovals: previous.pendingApprovals.filter((item) => item.id !== approval.id),
    recentCommands: previous.recentCommands.map(updateResult),
    runningTasks: previous.runningTasks
      .map(updateResult)
      .filter((result) => result.status === "running" || result.status === "awaiting_approval"),
    activity: [resolvedLog, ...previous.activity].slice(0, 24)
  };
}
