import type { CommandPlan, CommandStatus, VoiceSettings } from "../types/domain";

export const echoPersona = {
  name: "Echo",
  persona: "female",
  tone: "calm, intelligent, confident, slightly futuristic",
  fallbackVoice: "system",
  defaultStatus: "Echo is listening",
  helperLine: "I can keep the task moving, and I’ll pause cleanly when approval is needed."
} as const;

export const defaultVoiceSettings: VoiceSettings = {
  enabled: true,
  muted: false,
  provider: "system",
  rate: 1,
  style: "calm",
  outputDevice: "System Default"
};

export function buildEchoStatus(plan: CommandPlan, status: CommandStatus): string {
  if (status === "awaiting_approval") {
    return "Awaiting approval";
  }

  if (status === "running") {
    return "Echo is working";
  }

  if (status === "completed") {
    return "Done";
  }

  if (status === "blocked") {
    return "Action blocked";
  }

  if (plan.intent === "show_priorities") {
    return "Priorities ready";
  }

  return echoPersona.defaultStatus;
}

export function buildEchoSummary(plan: CommandPlan, status: CommandStatus): string {
  if (status === "completed") {
    return plan.echo.success;
  }

  if (status === "awaiting_approval") {
    return plan.echo.approvalRequired;
  }

  if (status === "blocked") {
    return plan.echo.blocked;
  }

  if (status === "failed") {
    return plan.echo.failed;
  }

  return plan.echo.thinking;
}
