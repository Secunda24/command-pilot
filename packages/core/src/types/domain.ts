export type SafetyLevel = "safe" | "notice" | "confirm" | "restricted";
export type ExecutionTarget = "pc" | "android" | "either" | "orchestrator";
export type CommandStatus =
  | "queued"
  | "planning"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "blocked";
export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "awaiting_approval";
export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";
export type DevicePlatform = "windows" | "android";
export type ExecutionMode =
  | "direct"
  | "script"
  | "power_automate"
  | "browser"
  | "ui_automation"
  | "analysis";
export type VoiceProvider = "system" | "browser" | "android" | "premium_placeholder";

export interface SkillParameter {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "path" | "url" | "enum";
  required: boolean;
  description: string;
  placeholder?: string;
  options?: string[];
}

export interface SkillDefinition {
  key: string;
  name: string;
  description: string;
  parameters: SkillParameter[];
  safetyLevel: SafetyLevel;
  executionTarget: ExecutionTarget;
  requiresApproval: boolean;
  executionMode: ExecutionMode;
  tags: string[];
  demoHandler: string;
}

export interface WorkflowStepTemplate {
  id: string;
  title: string;
  description: string;
  skillKey: string;
  target: ExecutionTarget;
  safetyLevel: SafetyLevel;
  approvalRequired: boolean;
  parameters?: Record<string, string>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  tags: string[];
  status: "ready" | "draft";
  promptExamples: string[];
  steps: WorkflowStepTemplate[];
}

export interface PlannedCommandStep {
  id: string;
  title: string;
  description: string;
  skillKey: string;
  status: StepStatus;
  target: ExecutionTarget;
  safetyLevel: SafetyLevel;
  approvalRequired: boolean;
  parameters?: Record<string, string>;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface EchoReplyPack {
  thinking: string;
  success: string;
  approvalRequired: string;
  blocked: string;
  failed: string;
}

export interface CommandPlan {
  id: string;
  text: string;
  normalizedText: string;
  intent: string;
  summary: string;
  executionTarget: ExecutionTarget;
  safetyLevel: SafetyLevel;
  status: CommandStatus;
  selectedSkills: string[];
  steps: PlannedCommandStep[];
  matchedWorkflowId?: string;
  echo: EchoReplyPack;
  suggestedFollowUps: string[];
}

export interface CommandExecutionResult {
  plan: CommandPlan;
  status: CommandStatus;
  echoMessage: string;
  completionSummary: string;
  steps: PlannedCommandStep[];
  approvalsRequested: ApprovalRecord[];
  activityLog: ActivityLogRecord[];
}

export interface Profile {
  id: string;
  name: string;
  assistantName: string;
  preferredTone: string;
  voiceEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceRecord {
  id: string;
  name: string;
  platform: DevicePlatform;
  status: "online" | "offline" | "paired";
  trusted: boolean;
  batteryPercent?: number;
  network?: string;
  lastSeenAt: string;
  pairingCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  commandId: string;
  title: string;
  description: string;
  status: ApprovalStatus;
  requestedAt: string;
  resolvedAt?: string;
  requestedOn: Array<"windows" | "android">;
  safetyLevel: SafetyLevel;
  target: ExecutionTarget;
}

export interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  channel: "desktop" | "android";
  status: "queued" | "sent" | "read";
  commandId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingRecord {
  id: string;
  category: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface ActivityLogRecord {
  id: string;
  commandId?: string;
  title: string;
  details: string;
  type: "command" | "step" | "approval" | "notification" | "system";
  status: "info" | "success" | "warning" | "error";
  createdAt: string;
}

export interface VoiceSettings {
  enabled: boolean;
  muted: boolean;
  provider: VoiceProvider;
  rate: number;
  style: "calm" | "focused" | "bright" | "premium_placeholder";
  outputDevice: string;
}

export interface DemoSnapshot {
  profile: Profile;
  devices: DeviceRecord[];
  skills: SkillDefinition[];
  workflows: WorkflowDefinition[];
  recentCommands: CommandExecutionResult[];
  pendingApprovals: ApprovalRecord[];
  notifications: NotificationRecord[];
  activity: ActivityLogRecord[];
  settings: SettingRecord[];
  runningTasks: CommandExecutionResult[];
  voice: VoiceSettings;
}
