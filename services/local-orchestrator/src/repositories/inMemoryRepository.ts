import type { CommandExecutionResult, DemoSnapshot } from "@commandpilot/core";

export class InMemoryRepository {
  constructor(private snapshot: DemoSnapshot) {}

  getSnapshot(): DemoSnapshot {
    return this.snapshot;
  }

  appendCommand(result: CommandExecutionResult): DemoSnapshot {
    this.snapshot = {
      ...this.snapshot,
      recentCommands: [result, ...this.snapshot.recentCommands].slice(0, 8),
      pendingApprovals: [...result.approvalsRequested, ...this.snapshot.pendingApprovals].slice(0, 8),
      activity: [...result.activityLog, ...this.snapshot.activity].slice(0, 24)
    };

    return this.snapshot;
  }
}
