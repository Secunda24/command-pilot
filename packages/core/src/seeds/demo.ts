import { quickCommands } from "../commands/demo";
import {
  autoApproveExecutionResult,
  planCommand,
  simulateExecution
} from "../orchestration/planner";
import { skillCatalog } from "../skills/catalog";
import { workflowCatalog } from "../skills/workflows";
import { defaultVoiceSettings } from "../voice/echo";
import type {
  ApprovalRecord,
  CommandExecutionResult,
  DemoSnapshot,
  NotificationRecord,
  SettingRecord
} from "../types/domain";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function stampResult(result: CommandExecutionResult, minutes: number): CommandExecutionResult {
  const createdAt = minutesAgo(minutes);
  return {
    ...result,
    approvalsRequested: result.approvalsRequested.map((approval) => ({ ...approval, requestedAt: createdAt })),
    activityLog: result.activityLog.map((log) => ({ ...log, createdAt }))
  };
}

function createSeedResult(commandText: string): CommandExecutionResult {
  const simulatedResult = simulateExecution(planCommand(commandText));
  return simulatedResult.status === "awaiting_approval"
    ? autoApproveExecutionResult(simulatedResult, simulatedResult.plan.echo.success)
    : simulatedResult;
}

const recentCommands = [
  stampResult(createSeedResult("Echo, open my work setup"), 5),
  stampResult(createSeedResult("Echo, show me today's priorities"), 28),
  stampResult(createSeedResult("Echo, find the latest invoice for Acme"), 64),
  stampResult(createSeedResult("Echo, start content mode"), 95)
];

const runningTasks: CommandExecutionResult[] = [];

const pendingApprovals: ApprovalRecord[] = runningTasks.flatMap((task) => task.approvalsRequested);

const notifications: NotificationRecord[] = [
  {
    id: "notif-1",
    title: "Chrome control live",
    body: "Echo can now open Chrome and run web searches for your demo.",
    channel: "android",
    status: "sent",
    commandId: recentCommands[0].plan.id,
    createdAt: minutesAgo(2),
    updatedAt: minutesAgo(2)
  },
  {
    id: "notif-2",
    title: "Morning work setup complete",
    body: "PromptPilot Studio, Gmail, and Client Files are open.",
    channel: "android",
    status: "read",
    commandId: recentCommands[0].plan.id,
    createdAt: minutesAgo(5),
    updatedAt: minutesAgo(3)
  }
];

const settings: SettingRecord[] = [
  { id: "setting-1", category: "assistant", key: "assistantName", value: "Echo", updatedAt: minutesAgo(120) },
  { id: "setting-2", category: "voice", key: "voiceEnabled", value: "true", updatedAt: minutesAgo(120) },
  {
    id: "setting-3",
    category: "demo",
    key: "autoApproveConfirmations",
    value: "true",
    updatedAt: minutesAgo(5)
  },
  {
    id: "setting-4",
    category: "security",
    key: "trustedWebsites",
    value: "mail.google.com, notion.so, app.clickup.com",
    updatedAt: minutesAgo(120)
  },
  {
    id: "setting-5",
    category: "pairing",
    key: "androidDevice",
    value: "Echo Companion Pixel",
    updatedAt: minutesAgo(21)
  }
];

export const demoSnapshot: DemoSnapshot = {
  profile: {
    id: "profile-1",
    name: "Angel",
    assistantName: "Echo",
    preferredTone: "calm_futuristic",
    voiceEnabled: true,
    createdAt: minutesAgo(1440),
    updatedAt: minutesAgo(9)
  },
  devices: [
    {
      id: "device-pc-1",
      name: "Angel Workstation",
      platform: "windows",
      status: "online",
      trusted: true,
      batteryPercent: 100,
      network: "Office LAN",
      lastSeenAt: minutesAgo(0),
      createdAt: minutesAgo(1440),
      updatedAt: minutesAgo(0)
    },
    {
      id: "device-android-1",
      name: "Echo Companion Pixel",
      platform: "android",
      status: "paired",
      trusted: true,
      batteryPercent: 86,
      network: "Wi-Fi",
      lastSeenAt: minutesAgo(1),
      pairingCode: "ECHO-4721",
      createdAt: minutesAgo(600),
      updatedAt: minutesAgo(1)
    }
  ],
  skills: skillCatalog,
  workflows: workflowCatalog,
  recentCommands,
  pendingApprovals,
  notifications,
  activity: [...runningTasks.flatMap((task) => task.activityLog), ...recentCommands.flatMap((command) => command.activityLog)]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 14),
  settings,
  runningTasks,
  voice: defaultVoiceSettings
};

export const dashboardQuickCommands = quickCommands;
