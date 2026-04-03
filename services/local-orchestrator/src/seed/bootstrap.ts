import { demoSnapshot, supportedDemoCommands } from "@commandpilot/core";
import { LocalOrchestratorService } from "../runtime/localOrchestrator";

async function main(): Promise<void> {
  const orchestrator = new LocalOrchestratorService(demoSnapshot);

  for (const command of supportedDemoCommands.slice(0, 3)) {
    await orchestrator.submitCommand(command);
  }

  const snapshot = orchestrator.getDashboardSnapshot();
  console.log(
    JSON.stringify(
      {
        assistant: snapshot.profile.assistantName,
        commands: snapshot.recentCommands.length,
        approvals: snapshot.pendingApprovals.length,
        devices: snapshot.devices.length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
