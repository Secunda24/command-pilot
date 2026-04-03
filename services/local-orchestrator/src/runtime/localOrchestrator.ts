import {
  demoSnapshot,
  planCommand,
  simulateExecution,
  type CommandExecutionResult,
  type DemoSnapshot
} from "@commandpilot/core";
import type { PlatformAdapters } from "../adapters/platformAdapters";
import { createDemoAdapters } from "../adapters/platformAdapters";
import { InMemoryRepository } from "../repositories/inMemoryRepository";

export class LocalOrchestratorService {
  private repository: InMemoryRepository;
  private adapters: PlatformAdapters;

  constructor(snapshot: DemoSnapshot = demoSnapshot, adapters: PlatformAdapters = createDemoAdapters()) {
    this.repository = new InMemoryRepository(snapshot);
    this.adapters = adapters;
  }

  getDashboardSnapshot(): DemoSnapshot {
    return this.repository.getSnapshot();
  }

  async submitCommand(input: string): Promise<CommandExecutionResult> {
    const plan = planCommand(input);
    const result = simulateExecution(plan);

    await this.dispatchSideEffects(result);
    this.repository.appendCommand(result);

    return result;
  }

  private async dispatchSideEffects(result: CommandExecutionResult): Promise<void> {
    for (const step of result.steps) {
      if (step.status !== "completed") {
        continue;
      }

      if (step.skillKey === "open_app" && step.parameters?.appName) {
        await this.adapters.desktop.launchApp(step.parameters.appName);
      }

      if (step.skillKey === "check_app_status" && step.parameters?.appName) {
        await this.adapters.desktop.checkAppStatus(step.parameters.appName);
      }

      if (step.skillKey === "open_website" && step.parameters?.url) {
        await this.adapters.desktop.openWebsite(step.parameters.url);
      }

      if (step.skillKey === "open_folder" && step.parameters?.path) {
        await this.adapters.desktop.openFolder(step.parameters.path);
      }

      if (step.skillKey === "run_script" && step.parameters?.scriptKey) {
        await this.adapters.desktop.runScript(step.parameters.scriptKey);
      }

      if (step.skillKey === "run_power_automate_flow" && step.parameters?.flowName) {
        await this.adapters.desktop.runPowerAutomateFlow(step.parameters.flowName);
      }

      if (step.skillKey === "send_phone_notification" && step.parameters?.message) {
        await this.adapters.android.sendNotification(step.parameters.message);
      }

      if (step.skillKey === "create_reminder_placeholder" && step.parameters?.title) {
        await this.adapters.android.createReminder(step.parameters.title);
      }

      if (step.skillKey === "summarize_text_file" && step.parameters?.path) {
        await this.adapters.analysis.summarizeFile(step.parameters.path);
      }
    }
  }
}
