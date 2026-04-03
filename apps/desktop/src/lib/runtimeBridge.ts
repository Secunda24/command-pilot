import type { CommandExecutionResult, PlannedCommandStep } from "@commandpilot/core";

interface BridgeRequest {
  path?: string;
  appKey?: string;
  appName?: string;
  routePath?: string;
  routeName?: string;
  url?: string;
  preferredBrowser?: string;
  text?: string;
  pressEnter?: boolean;
  allowOutsideApprovedRoots?: boolean;
  createIfMissing?: boolean;
  content?: string;
  overwrite?: boolean;
  approvedRoots?: string[];
  trustedWebsiteHosts?: string[];
  approvedLinkedAppKeys?: string[];
}

interface BridgeEntry {
  name: string;
  path: string;
  kind: "file" | "folder";
}

interface BridgeResult {
  ok: boolean;
  message: string;
  path?: string;
  entries?: BridgeEntry[];
  launchUrl?: string;
  running?: boolean;
  appKey?: string;
  appName?: string;
  exists?: boolean;
  kind?: "file" | "folder" | "missing";
  approvedRoots?: string[];
  trustedWebsiteHosts?: string[];
  approvedLinkedAppKeys?: string[];
}

export const BRIDGE_BASE_URL = "http://127.0.0.1:8787";
const APP_READY_RETRY_DELAYS_MS = [1000, 1500, 2000, 2500, 3000];
const MAX_RUNTIME_TYPED_CHARACTERS = 1200;
const DANGEROUS_TYPED_COMMAND_PATTERNS = [
  /\bgit\s+reset\s+--hard\b/i,
  /\brm\s+-rf\b/i,
  /\bdel(?:ete)?\b/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown\b/i,
  /\bpowershell\b/i,
  /\bcmd\s*\/c\b/i
];

export interface RuntimeSafetySettings {
  approvedRoots: string[];
  trustedWebsiteHosts: string[];
  approvedLinkedAppKeys: string[];
}

async function callBridge(endpoint: string, payload: BridgeRequest): Promise<BridgeResult> {
  const response = await fetch(`${BRIDGE_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as BridgeResult;

  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Bridge request failed.");
  }

  return data;
}

function parseRuntimeSettings(data: BridgeResult): RuntimeSafetySettings {
  return {
    approvedRoots: data.approvedRoots ?? [],
    trustedWebsiteHosts: data.trustedWebsiteHosts ?? [],
    approvedLinkedAppKeys: data.approvedLinkedAppKeys ?? []
  };
}

export async function fetchRuntimeSafetySettings(): Promise<RuntimeSafetySettings> {
  const response = await fetch(`${BRIDGE_BASE_URL}/api/settings/runtime`, {
    method: "GET"
  });

  const data = (await response.json()) as BridgeResult;
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Could not load runtime safety settings.");
  }

  return parseRuntimeSettings(data);
}

export async function updateRuntimeSafetySettings(
  patch: Partial<RuntimeSafetySettings>
): Promise<RuntimeSafetySettings> {
  const response = await fetch(`${BRIDGE_BASE_URL}/api/settings/runtime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patch)
  });

  const data = (await response.json()) as BridgeResult;
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Could not save runtime safety settings.");
  }

  return parseRuntimeSettings(data);
}

function basename(targetPath: string): string {
  const segments = targetPath.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] ?? targetPath;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function shouldCreateFolder(step: PlannedCommandStep, planId: string): boolean {
  return planId.includes("cmd") && step.parameters?.path?.endsWith("\\Echo Test Folder") === true;
}

function applyRuntimeSuccess(
  result: CommandExecutionResult,
  echoMessage: string
): CommandExecutionResult {
  return {
    ...result,
    echoMessage,
    completionSummary: echoMessage,
    plan: {
      ...result.plan,
      echo: {
        ...result.plan.echo,
        success: echoMessage
      }
    }
  };
}

function applyRuntimeFailure(
  result: CommandExecutionResult,
  failingStepId: string,
  errorMessage: string
): CommandExecutionResult {
  const failingStep = result.steps.find((step) => step.id === failingStepId);
  const stepLabel = failingStep?.title ? failingStep.title.toLowerCase() : "that action";
  const failureEcho = `I couldn't complete ${stepLabel}. ${errorMessage}`;

  const steps = result.steps.map((step) =>
    step.id === failingStepId
      ? {
          ...step,
          status: "failed" as const,
          errorMessage
        }
      : step
  );

  return {
    ...result,
    status: "failed",
    echoMessage: failureEcho,
    completionSummary: failureEcho,
    steps,
    plan: {
      ...result.plan,
      status: "failed",
      steps,
      echo: {
        ...result.plan.echo,
        failed: failureEcho
      }
    }
  };
}

function formatEntries(entries: BridgeEntry[]): string {
  if (entries.length === 0) {
    return "The folder is currently empty.";
  }

  const preview = entries
    .slice(0, 6)
    .map((entry) => (entry.kind === "folder" ? `${entry.name}/` : entry.name))
    .join(", ");

  if (entries.length <= 6) {
    return preview;
  }

  return `${preview}, and ${entries.length - 6} more.`;
}

async function verifyPathState(
  targetPath: string,
  expectedKind: "file" | "folder",
  allowOutsideApprovedRoots: boolean
): Promise<void> {
  const state = await callBridge("/api/desktop/path-state", {
    path: targetPath,
    allowOutsideApprovedRoots
  });

  if (state.exists !== true) {
    throw new Error(`${basename(targetPath)} is still missing after execution.`);
  }

  if (state.kind !== expectedKind) {
    throw new Error(
      `I expected ${basename(targetPath)} to be a ${expectedKind}, but found ${state.kind ?? "a different type"}.`
    );
  }
}

async function verifyLinkedAppLaunch(step: PlannedCommandStep, launchResponse: BridgeResult): Promise<string> {
  if (launchResponse.running === true) {
    return launchResponse.message;
  }

  for (const delayMs of APP_READY_RETRY_DELAYS_MS) {
    await sleep(delayMs);
    const status = await callBridge("/api/apps/status", {
      appKey: step.parameters?.appKey,
      appName: step.parameters?.appName
    });

    if (status.running === true) {
      return status.message;
    }
  }

  const appName = step.parameters?.appName ?? launchResponse.appName ?? "that app";
  throw new Error(
    `${appName} did not come online yet. Check that its local dependencies are installed, then try again.`
  );
}

function validateTypingRequest(step: PlannedCommandStep): void {
  const typedText = step.parameters?.text ?? "";
  if (typedText.length > MAX_RUNTIME_TYPED_CHARACTERS) {
    throw new Error(
      `That typing request is too large for one pass. Keep it under ${MAX_RUNTIME_TYPED_CHARACTERS} characters.`
    );
  }

  const shouldPressEnter = step.parameters?.pressEnter === "true";
  const allowCommandExecution = step.parameters?.allowCommandExecution === "true";
  const looksDangerous = DANGEROUS_TYPED_COMMAND_PATTERNS.some((pattern) => pattern.test(typedText));

  if (shouldPressEnter && looksDangerous && !allowCommandExecution) {
    throw new Error(
      'That looks like a command execution payload. Say "Echo, force type ..." to allow it.'
    );
  }
}

async function runBridgeStep(step: PlannedCommandStep, planId: string): Promise<string> {
  const targetPath = step.parameters?.path;
  const customSuccessMessage = step.parameters?.successMessage;
  const allowOutsideApprovedRoots = step.safetyLevel === "confirm";

  if (step.skillKey === "open_app") {
    const launchResponse = await callBridge("/api/apps/launch", {
      appKey: step.parameters?.appKey,
      appName: step.parameters?.appName,
      routePath: step.parameters?.routePath,
      routeName: step.parameters?.routeName
    });
    const verifiedMessage = await verifyLinkedAppLaunch(step, launchResponse);
    return customSuccessMessage ?? verifiedMessage;
  }

  if (step.skillKey === "check_app_status") {
    const response = await callBridge("/api/apps/status", {
      appKey: step.parameters?.appKey,
      appName: step.parameters?.appName
    });
    return customSuccessMessage ?? response.message;
  }

  if (step.skillKey === "open_folder") {
    if (!targetPath) {
      throw new Error("The command is missing a path.");
    }
    await callBridge("/api/desktop/open-folder", {
      path: targetPath,
      allowOutsideApprovedRoots,
      createIfMissing: shouldCreateFolder(step, planId)
    });
    await verifyPathState(targetPath, "folder", allowOutsideApprovedRoots);
    return customSuccessMessage ?? `Done. I've opened ${basename(targetPath)}.`;
  }

  if (step.skillKey === "open_file") {
    if (!targetPath) {
      throw new Error("The command is missing a path.");
    }
    await callBridge("/api/desktop/open-file", {
      path: targetPath,
      allowOutsideApprovedRoots
    });
    await verifyPathState(targetPath, "file", allowOutsideApprovedRoots);
    return customSuccessMessage ?? `Done. I've opened ${basename(targetPath)}.`;
  }

  if (step.skillKey === "open_website") {
    const response = await callBridge("/api/browser/open", {
      url: step.parameters?.url,
      preferredBrowser: step.parameters?.preferredBrowser
    });
    return customSuccessMessage ?? response.message;
  }

  if (step.skillKey === "create_folder") {
    if (!targetPath) {
      throw new Error("The command is missing a path.");
    }
    await callBridge("/api/desktop/create-folder", {
      path: targetPath,
      allowOutsideApprovedRoots
    });
    await verifyPathState(targetPath, "folder", allowOutsideApprovedRoots);
    return customSuccessMessage ?? `Done. I created ${basename(targetPath)}.`;
  }

  if (step.skillKey === "create_text_file") {
    if (!targetPath) {
      throw new Error("The command is missing a path.");
    }
    await callBridge("/api/desktop/create-text-file", {
      path: targetPath,
      content: step.parameters?.content ?? "Echo created this file.",
      allowOutsideApprovedRoots
    });
    await verifyPathState(targetPath, "file", allowOutsideApprovedRoots);
    return customSuccessMessage ?? `Done. I created ${basename(targetPath)}.`;
  }

  if (step.skillKey === "list_folder_contents") {
    if (!targetPath) {
      throw new Error("The command is missing a path.");
    }
    const response = await callBridge("/api/desktop/list-folder", { path: targetPath });
    return (
      customSuccessMessage ??
      `I found ${response.entries?.length ?? 0} items in ${basename(targetPath)}: ${formatEntries(response.entries ?? [])}`
    );
  }

  if (step.skillKey === "type_text") {
    validateTypingRequest(step);
    const response = await callBridge("/api/desktop/type-text", {
      text: step.parameters?.text,
      pressEnter: step.parameters?.pressEnter === "true"
    });
    return customSuccessMessage ?? response.message;
  }

  return "";
}

export async function executeRuntimeActions(
  result: CommandExecutionResult
): Promise<CommandExecutionResult> {
  const actionableSteps = result.steps.filter(
    (step) =>
      step.status === "completed" &&
      ((step.parameters?.path &&
        ["open_folder", "open_file", "create_folder", "create_text_file", "list_folder_contents"].includes(
          step.skillKey
        )) ||
        (step.parameters?.text && step.skillKey === "type_text") ||
        (step.parameters?.url && step.skillKey === "open_website") ||
        (step.parameters?.appName && ["open_app", "check_app_status"].includes(step.skillKey)))
  );

  if (actionableSteps.length === 0) {
    return result;
  }

  let latestEchoMessage = result.echoMessage;
  let lastStepId = actionableSteps[0]?.id ?? "runtime";

  try {
    for (const step of actionableSteps) {
      lastStepId = step.id;
      const echoMessage = await runBridgeStep(step, result.plan.id);
      if (echoMessage) {
        latestEchoMessage = echoMessage;
      }
    }

    return applyRuntimeSuccess(result, latestEchoMessage);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The local desktop bridge was unavailable.";
    return applyRuntimeFailure(result, lastStepId, message);
  }
}
