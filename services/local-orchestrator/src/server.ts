import {
  autoApproveExecutionResult,
  linkedApps,
  normalizeTrustedWebsiteHosts,
  planCommand,
  simulateExecution,
  trustedWebsiteHosts as defaultTrustedWebsiteHosts,
  type CommandExecutionResult,
  type EchoAiConversationMessage,
  type EchoAiInterpretRequest,
  type PlannedCommandStep
} from "@commandpilot/core";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, extname, normalize, resolve } from "node:path";
import { loadCommandPilotEnv } from "./runtime/env";
import { getLinkedAppStatus, launchLinkedApp, openUrl } from "./runtime/linkedApps";
import {
  interpretCommandWithAi,
  isAiConfigured,
  isEchoAiBridgeError,
} from "./runtime/openaiResponses";

const PORT = 8787;
loadCommandPilotEnv();

const defaultApprovedRoots = [
  "C:\\Users\\angel\\OneDrive\\Desktop",
  "C:\\Users\\angel\\OneDrive\\Documentos"
];
const allowedTextExtensions = new Set([".txt", ".md", ".json", ".csv", ".rtf"]);
const MAX_TYPED_TEXT_CHARACTERS = 1200;
const APP_READY_RETRY_DELAYS_MS = [1000, 1500, 2000, 2500, 3000];
const DANGEROUS_TYPED_COMMAND_PATTERNS = [
  /\bgit\s+reset\s+--hard\b/i,
  /\brm\s+-rf\b/i,
  /\bdel(?:ete)?\b/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown\b/i,
  /\bpowershell\b/i,
  /\bcmd\s*\/c\b/i
];

interface RuntimeSafetySettings {
  approvedRoots: string[];
  trustedWebsiteHosts: string[];
  approvedLinkedAppKeys: string[];
}

const runtimeSafetySettings: RuntimeSafetySettings = {
  approvedRoots: [...defaultApprovedRoots],
  trustedWebsiteHosts: [...defaultTrustedWebsiteHosts],
  approvedLinkedAppKeys: linkedApps.map((app) => app.key)
};

interface PathRequest {
  path?: string;
  createIfMissing?: boolean;
  allowOutsideApprovedRoots?: boolean;
}

interface CreateTextFileRequest extends PathRequest {
  content?: string;
  overwrite?: boolean;
}

interface BrowserRequest {
  url?: string;
  preferredBrowser?: string;
}

interface TypeTextRequest {
  text?: string;
  pressEnter?: boolean;
}

interface LinkedAppRequest {
  appKey?: string;
  appName?: string;
  routePath?: string;
  routeName?: string;
}

interface RuntimeSettingsRequest {
  approvedRoots?: string[];
  trustedWebsiteHosts?: string[];
  approvedLinkedAppKeys?: string[];
}

interface CommandExecuteRequest {
  command?: string;
  conversation?: EchoAiConversationMessage[];
  forceAiInterpret?: boolean;
  autoApprove?: boolean;
}

interface DirectoryEntryPayload {
  name: string;
  path: string;
  kind: "file" | "folder";
}

interface BridgeResponsePayload {
  ok: boolean;
  message: string;
  path?: string;
  entries?: DirectoryEntryPayload[];
  exists?: boolean;
  kind?: "file" | "folder" | "missing";
}

function sendJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody<T extends object>(
  request: import("node:http").IncomingMessage
): Promise<T> {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      if (!raw) {
        resolveBody({} as T);
        return;
      }

      try {
        resolveBody(JSON.parse(raw) as T);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function normalizeResolvedPath(targetPath: string): string {
  return normalize(resolve(targetPath));
}

function getNormalizedApprovedRoots(): string[] {
  return [...new Set(runtimeSafetySettings.approvedRoots.map((root) => normalizeResolvedPath(root).toLowerCase()))];
}

function getTrustedWebsiteHosts(): string[] {
  return normalizeTrustedWebsiteHosts(runtimeSafetySettings.trustedWebsiteHosts);
}

function getApprovedLinkedAppKeys(): string[] {
  const normalized = runtimeSafetySettings.approvedLinkedAppKeys
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function toRuntimeSettingsPayload() {
  return {
    approvedRoots: [...runtimeSafetySettings.approvedRoots],
    trustedWebsiteHosts: getTrustedWebsiteHosts(),
    approvedLinkedAppKeys: getApprovedLinkedAppKeys()
  };
}

function isAllowedPath(targetPath: string): boolean {
  const resolved = normalizeResolvedPath(targetPath).toLowerCase();
  return getNormalizedApprovedRoots().some(
    (root) => resolved === root || resolved.startsWith(`${root}\\`)
  );
}

function isTrustedWebsiteUrl(url: string): boolean {
  if (url.trim().toLowerCase() === "about:blank") {
    return true;
  }

  try {
    const hostname = new URL(url).hostname.trim().toLowerCase().replace(/^www\./, "");
    const trustedHosts = getTrustedWebsiteHosts();
    return trustedHosts.some(
      (trustedHost) => hostname === trustedHost || hostname.endsWith(`.${trustedHost}`)
    );
  } catch {
    return false;
  }
}

function resolveLinkedAppKeyFromRequest(request: LinkedAppRequest): string | null {
  const fromKey = request.appKey?.trim().toLowerCase();
  if (fromKey) {
    return fromKey;
  }

  const byName = linkedApps.find(
    (app) => app.name.toLowerCase() === request.appName?.trim().toLowerCase()
  );
  return byName?.key ?? null;
}

function isLinkedAppAllowed(request: LinkedAppRequest): boolean {
  const appKey = resolveLinkedAppKeyFromRequest(request);
  if (!appKey) {
    return true;
  }

  const approvedKeys = getApprovedLinkedAppKeys();
  return approvedKeys.length === 0 || approvedKeys.includes(appKey);
}

function validateRuntimeSettingsRequest(requestBody: RuntimeSettingsRequest): string | null {
  if (requestBody.approvedRoots && !Array.isArray(requestBody.approvedRoots)) {
    return "approvedRoots must be an array of paths.";
  }

  if (requestBody.trustedWebsiteHosts && !Array.isArray(requestBody.trustedWebsiteHosts)) {
    return "trustedWebsiteHosts must be an array of hosts.";
  }

  if (requestBody.approvedLinkedAppKeys && !Array.isArray(requestBody.approvedLinkedAppKeys)) {
    return "approvedLinkedAppKeys must be an array of app keys.";
  }

  return null;
}

function applyRuntimeSettingsPatch(patch: RuntimeSettingsRequest): void {
  if (patch.approvedRoots) {
    const sanitizedRoots = patch.approvedRoots
      .map((root) => root.trim())
      .filter((root) => /^[a-zA-Z]:\\/.test(root))
      .map((root) => normalizeResolvedPath(root));

    runtimeSafetySettings.approvedRoots =
      sanitizedRoots.length > 0 ? [...new Set(sanitizedRoots)] : [...defaultApprovedRoots];
  }

  if (patch.trustedWebsiteHosts) {
    const normalizedHosts = normalizeTrustedWebsiteHosts(
      patch.trustedWebsiteHosts.map((host) => host.trim())
    );
    runtimeSafetySettings.trustedWebsiteHosts =
      normalizedHosts.length > 0 ? normalizedHosts : [...defaultTrustedWebsiteHosts];
  }

  if (patch.approvedLinkedAppKeys) {
    const allowedKeys = new Set(linkedApps.map((app) => app.key));
    const sanitizedKeys = patch.approvedLinkedAppKeys
      .map((key) => key.trim().toLowerCase())
      .filter((key) => allowedKeys.has(key));

    runtimeSafetySettings.approvedLinkedAppKeys =
      sanitizedKeys.length > 0 ? [...new Set(sanitizedKeys)] : linkedApps.map((app) => app.key);
  }
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
}

function basename(targetPath: string): string {
  const segments = targetPath.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] ?? targetPath;
}

function shouldCreateFolder(step: PlannedCommandStep, planId: string): boolean {
  return planId.includes("cmd") && step.parameters?.path?.endsWith("\\Echo Test Folder") === true;
}

function formatEntries(entries: DirectoryEntryPayload[]): string {
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

function shouldInterpretWithAi(commandText: string): boolean {
  const trimmed = commandText.trim();
  if (!trimmed) {
    return false;
  }

  if (/^(can|could|would|will)\s+(you|u)\b/i.test(trimmed) || /^please\b/i.test(trimmed)) {
    return true;
  }

  if (/^(?:hey\s+)?echo(?:\s+|,\s*)/i.test(trimmed)) {
    return false;
  }

  if (
    /^(open|launch|start|run|create|show|check|find|search|list|type|notify|lock|close|minimize|go)\b/i.test(
      trimmed
    )
  ) {
    return false;
  }

  return (
    /\?$/.test(trimmed) ||
    /^(what|why|how|who|when|where|tell me|explain|help)\b/i.test(trimmed)
  );
}

function sanitizeConversation(value: unknown): EchoAiConversationMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const messages: EchoAiConversationMessage[] = [];
  for (const candidate of value.slice(-6)) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const maybeMessage = candidate as { role?: unknown; text?: unknown };
    if (
      (maybeMessage.role === "assistant" || maybeMessage.role === "user") &&
      typeof maybeMessage.text === "string" &&
      maybeMessage.text.trim()
    ) {
      messages.push({
        role: maybeMessage.role,
        text: maybeMessage.text
      });
    }
  }

  return messages;
}

function validateTypingRequest(step: PlannedCommandStep): void {
  const typedText = step.parameters?.text ?? "";
  if (typedText.length > MAX_TYPED_TEXT_CHARACTERS) {
    throw new Error(
      `That typing request is too large for one pass. Keep it under ${MAX_TYPED_TEXT_CHARACTERS} characters.`
    );
  }

  const shouldPressEnter = step.parameters?.pressEnter === "true";
  const allowCommandExecution = step.parameters?.allowCommandExecution === "true";
  const looksDangerous = DANGEROUS_TYPED_COMMAND_PATTERNS.some((pattern) => pattern.test(typedText));

  if (shouldPressEnter && looksDangerous && !allowCommandExecution) {
    throw new Error('That looks like a command execution payload. Say "Echo, force type ..." to allow it.');
  }
}

async function verifyLinkedAppLaunch(
  step: PlannedCommandStep,
  launchResponse: { message: string; running?: boolean; appName?: string }
): Promise<string> {
  if (launchResponse.running === true) {
    return launchResponse.message;
  }

  for (const delayMs of APP_READY_RETRY_DELAYS_MS) {
    await sleep(delayMs);
    const status = await getLinkedAppStatus({
      appKey: step.parameters?.appKey,
      appName: step.parameters?.appName
    });

    if (status.ok && status.running === true) {
      return status.message;
    }
  }

  const appName = step.parameters?.appName ?? launchResponse.appName ?? "that app";
  throw new Error(
    `${appName} did not come online yet. Check its local dependencies, then try again.`
  );
}

function isActionableCompletedStep(step: PlannedCommandStep): boolean {
  if (step.status !== "completed") {
    return false;
  }

  if (
    step.parameters?.path &&
    ["open_folder", "open_file", "create_folder", "create_text_file", "list_folder_contents"].includes(
      step.skillKey
    )
  ) {
    return true;
  }

  if (step.parameters?.text && step.skillKey === "type_text") {
    return true;
  }

  if (step.parameters?.url && step.skillKey === "open_website") {
    return true;
  }

  if (step.parameters?.appName && ["open_app", "check_app_status"].includes(step.skillKey)) {
    return true;
  }

  return step.skillKey === "launch_custom_app_page" && Boolean(step.parameters?.destination);
}

async function runCommandStep(step: PlannedCommandStep, planId: string): Promise<string> {
  const targetPath = step.parameters?.path;
  const customSuccessMessage = step.parameters?.successMessage;
  const allowOutsideApprovedRoots = step.safetyLevel === "confirm";

  if (step.skillKey === "open_app") {
    const launchResponse = await launchLinkedApp({
      appKey: step.parameters?.appKey,
      appName: step.parameters?.appName,
      routePath: step.parameters?.routePath,
      routeName: step.parameters?.routeName
    });

    if (!launchResponse.ok) {
      throw new Error(launchResponse.message);
    }

    const verifiedMessage = await verifyLinkedAppLaunch(step, launchResponse);
    return customSuccessMessage ?? verifiedMessage;
  }

  if (step.skillKey === "launch_custom_app_page") {
    const destination = step.parameters?.destination?.trim() || "PromptPilot Studio";
    const launchResponse = await launchLinkedApp({
      appName: destination
    });

    if (!launchResponse.ok) {
      throw new Error(launchResponse.message);
    }

    const verifiedMessage = await verifyLinkedAppLaunch(
      {
        ...step,
        parameters: {
          ...step.parameters,
          appName: destination
        }
      },
      launchResponse
    );
    return customSuccessMessage ?? verifiedMessage;
  }

  if (step.skillKey === "check_app_status") {
    const statusResponse = await getLinkedAppStatus({
      appKey: step.parameters?.appKey,
      appName: step.parameters?.appName
    });

    if (!statusResponse.ok) {
      throw new Error(statusResponse.message);
    }

    return customSuccessMessage ?? statusResponse.message;
  }

  if (step.skillKey === "open_folder") {
    if (!targetPath) {
      throw new Error("The command is missing a path.");
    }

    const openResponse = openFolder(
      targetPath,
      shouldCreateFolder(step, planId),
      allowOutsideApprovedRoots
    );
    if (!openResponse.ok) {
      throw new Error(openResponse.message);
    }
    return customSuccessMessage ?? `Done. I've opened ${basename(targetPath)}.`;
  }

  if (step.skillKey === "open_file") {
    if (!targetPath) {
      throw new Error("The command is missing a path.");
    }

    const openResponse = openFile(targetPath, allowOutsideApprovedRoots);
    if (!openResponse.ok) {
      throw new Error(openResponse.message);
    }
    return customSuccessMessage ?? `Done. I've opened ${basename(targetPath)}.`;
  }

  if (step.skillKey === "open_website") {
    const targetUrl = step.parameters?.url;
    if (!targetUrl) {
      throw new Error("The command is missing a website URL.");
    }

    const openResponse = openBrowserPage(targetUrl, step.parameters?.preferredBrowser ?? "system");
    if (!openResponse.ok) {
      throw new Error(openResponse.message);
    }
    return customSuccessMessage ?? openResponse.message;
  }

  if (step.skillKey === "create_folder") {
    if (!targetPath) {
      throw new Error("The command is missing a path.");
    }

    const createResponse = createFolder(targetPath, allowOutsideApprovedRoots);
    if (!createResponse.ok) {
      throw new Error(createResponse.message);
    }
    return customSuccessMessage ?? `Done. I created ${basename(targetPath)}.`;
  }

  if (step.skillKey === "create_text_file") {
    if (!targetPath) {
      throw new Error("The command is missing a path.");
    }

    const createResponse = createTextFile(
      targetPath,
      step.parameters?.content ?? "Echo created this file.",
      false,
      allowOutsideApprovedRoots
    );
    if (!createResponse.ok) {
      throw new Error(createResponse.message);
    }
    return customSuccessMessage ?? `Done. I created ${basename(targetPath)}.`;
  }

  if (step.skillKey === "list_folder_contents") {
    if (!targetPath) {
      throw new Error("The command is missing a path.");
    }

    const listResponse = listFolderContents(targetPath);
    if (!listResponse.ok) {
      throw new Error(listResponse.message);
    }

    return (
      customSuccessMessage ??
      `I found ${listResponse.entries?.length ?? 0} items in ${basename(targetPath)}: ${formatEntries(
        listResponse.entries ?? []
      )}`
    );
  }

  if (step.skillKey === "type_text") {
    validateTypingRequest(step);
    const typeResponse = typeTextIntoActiveWindow(
      step.parameters?.text ?? "",
      step.parameters?.pressEnter === "true"
    );

    if (!typeResponse.ok) {
      throw new Error(typeResponse.message);
    }

    return customSuccessMessage ?? typeResponse.message;
  }

  return "";
}

async function executeRuntimeActions(
  result: CommandExecutionResult
): Promise<{ ok: boolean; message: string }> {
  const actionableSteps = result.steps.filter((step) => isActionableCompletedStep(step));

  if (actionableSteps.length === 0) {
    return {
      ok: true,
      message: result.echoMessage
    };
  }

  let latestMessage = result.echoMessage;
  let lastStepId = actionableSteps[0]?.id ?? "";

  try {
    for (const step of actionableSteps) {
      lastStepId = step.id;
      const runtimeMessage = await runCommandStep(step, result.plan.id);
      if (runtimeMessage.trim()) {
        latestMessage = runtimeMessage;
      }
    }

    return {
      ok: true,
      message: latestMessage
    };
  } catch (error) {
    const failingStep = result.steps.find((step) => step.id === lastStepId);
    const stepLabel = failingStep?.title ? failingStep.title.toLowerCase() : "that action";
    const errorMessage =
      error instanceof Error ? error.message : "The local desktop bridge was unavailable.";

    return {
      ok: false,
      message: `I couldn't complete ${stepLabel}. ${errorMessage}`
    };
  }
}

function escapePowerShellLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function rejectOutsideApprovedRoots(): BridgeResponsePayload {
  return {
    ok: false,
    message: "That path is outside Echo's approved desktop roots."
  };
}

function shellOpenPath(targetPath: string): BridgeResponsePayload {
  const escapedPath = escapePowerShellLiteral(targetPath);
  const openResult = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", `Invoke-Item -LiteralPath '${escapedPath}'`],
    {
      windowsHide: true,
      encoding: "utf8"
    }
  );

  if (openResult.error || openResult.status !== 0) {
    return {
      ok: false,
      message:
        openResult.error?.message ||
        openResult.stderr?.trim() ||
        "Windows could not open that path."
    };
  }

  return {
    ok: true,
    message: "Path opened successfully.",
    path: targetPath
  };
}

function openFolder(
  targetPath: string,
  createIfMissing: boolean,
  allowOutsideApprovedRoots: boolean
): BridgeResponsePayload {
  const resolvedPath = normalizeResolvedPath(targetPath);

  if (!allowOutsideApprovedRoots && !isAllowedPath(resolvedPath)) {
    return rejectOutsideApprovedRoots();
  }

  if (!existsSync(resolvedPath)) {
    if (!createIfMissing) {
      return {
        ok: false,
        message: "That folder doesn't exist yet."
      };
    }

    mkdirSync(resolvedPath, { recursive: true });
  }

  if (!statSync(resolvedPath).isDirectory()) {
    return {
      ok: false,
      message: "The target path isn't a folder."
    };
  }

  return shellOpenPath(resolvedPath);
}

function openFile(targetPath: string, allowOutsideApprovedRoots: boolean): BridgeResponsePayload {
  const resolvedPath = normalizeResolvedPath(targetPath);

  if (!allowOutsideApprovedRoots && !isAllowedPath(resolvedPath)) {
    return rejectOutsideApprovedRoots();
  }

  if (!existsSync(resolvedPath)) {
    return {
      ok: false,
      message: "That file doesn't exist."
    };
  }

  if (!statSync(resolvedPath).isFile()) {
    return {
      ok: false,
      message: "The target path isn't a file."
    };
  }

  return shellOpenPath(resolvedPath);
}

function getPathState(
  targetPath: string,
  allowOutsideApprovedRoots: boolean
): BridgeResponsePayload {
  const resolvedPath = normalizeResolvedPath(targetPath);

  if (!allowOutsideApprovedRoots && !isAllowedPath(resolvedPath)) {
    return rejectOutsideApprovedRoots();
  }

  if (!existsSync(resolvedPath)) {
    return {
      ok: true,
      message: "Path does not exist.",
      path: resolvedPath,
      exists: false,
      kind: "missing"
    };
  }

  const stats = statSync(resolvedPath);
  return {
    ok: true,
    message: "Path exists.",
    path: resolvedPath,
    exists: true,
    kind: stats.isDirectory() ? "folder" : "file"
  };
}

function listFolderContents(targetPath: string): BridgeResponsePayload {
  const resolvedPath = normalizeResolvedPath(targetPath);

  if (!isAllowedPath(resolvedPath)) {
    return rejectOutsideApprovedRoots();
  }

  if (!existsSync(resolvedPath)) {
    return {
      ok: false,
      message: "That folder doesn't exist."
    };
  }

  if (!statSync(resolvedPath).isDirectory()) {
    return {
      ok: false,
      message: "The target path isn't a folder."
    };
  }

  const entries = readdirSync(resolvedPath, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      path: `${resolvedPath}\\${entry.name}`,
      kind: entry.isDirectory() ? "folder" as const : "file" as const
    }))
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "folder" ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });

  return {
    ok: true,
    message: `Found ${entries.length} item${entries.length === 1 ? "" : "s"}.`,
    path: resolvedPath,
    entries
  };
}

function createFolder(
  targetPath: string,
  allowOutsideApprovedRoots: boolean
): BridgeResponsePayload {
  const resolvedPath = normalizeResolvedPath(targetPath);

  if (!allowOutsideApprovedRoots && !isAllowedPath(resolvedPath)) {
    return rejectOutsideApprovedRoots();
  }

  if (existsSync(resolvedPath)) {
    if (!statSync(resolvedPath).isDirectory()) {
      return {
        ok: false,
        message: "A file already exists at that path."
      };
    }

    return {
      ok: true,
      message: "That folder already exists.",
      path: resolvedPath
    };
  }

  mkdirSync(resolvedPath, { recursive: true });

  return {
    ok: true,
    message: "Folder created successfully.",
    path: resolvedPath
  };
}

function createTextFile(
  targetPath: string,
  content: string,
  overwrite: boolean,
  allowOutsideApprovedRoots: boolean
): BridgeResponsePayload {
  const resolvedPath = normalizeResolvedPath(targetPath);

  if (!allowOutsideApprovedRoots && !isAllowedPath(resolvedPath)) {
    return rejectOutsideApprovedRoots();
  }

  if (!allowedTextExtensions.has(extname(resolvedPath).toLowerCase())) {
    return {
      ok: false,
      message: "Echo can only create text-based files in this mode."
    };
  }

  if (existsSync(resolvedPath) && !overwrite) {
    return {
      ok: false,
      message: "That file already exists."
    };
  }

  mkdirSync(dirname(resolvedPath), { recursive: true });
  const extension = extname(resolvedPath).toLowerCase();
  const formattedContent =
    extension === ".rtf" ? buildRichTextContent(content) : content;
  writeFileSync(resolvedPath, formattedContent, "utf8");

  return {
    ok: true,
    message: "Text file created successfully.",
    path: resolvedPath
  };
}

function buildRichTextContent(content: string): string {
  const escaped = content
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\r?\n\r?\n/g, "\\par\\par ")
    .replace(/\r?\n/g, "\\par ");

  return `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Calibri;}}\\fs24 ${escaped}}`;
}

function typeTextIntoActiveWindow(text: string, pressEnter: boolean): BridgeResponsePayload {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return {
      ok: false,
      message: "Text is required before Echo can type anything."
    };
  }

  if (normalizedText.length > MAX_TYPED_TEXT_CHARACTERS) {
    return {
      ok: false,
      message: `Typing payload is too large. Keep it under ${MAX_TYPED_TEXT_CHARACTERS} characters.`
    };
  }

  const escapedText = escapePowerShellLiteral(normalizedText);
  const pressEnterCommand = pressEnter ? "$shell.SendKeys('{ENTER}');" : "";
  const typeResult = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Set-Clipboard -Value '${escapedText}'; Start-Sleep -Milliseconds 1800; $shell = New-Object -ComObject WScript.Shell; $shell.SendKeys('^v'); ${pressEnterCommand}`
    ],
    {
      windowsHide: true,
      encoding: "utf8"
    }
  );

  if (typeResult.error || typeResult.status !== 0) {
    return {
      ok: false,
      message:
        typeResult.error?.message ||
        typeResult.stderr?.trim() ||
        "Echo couldn't type into the active window."
    };
  }

  return {
    ok: true,
    message: pressEnter
      ? "Typed text and pressed Enter."
      : "Typed text into the active window."
  };
}

function openBrowserPage(targetUrl: string, preferredBrowser: string): BridgeResponsePayload {
  if (!isTrustedWebsiteUrl(targetUrl)) {
    return {
      ok: false,
      message: "That website is outside your trusted allowlist."
    };
  }

  const normalizedBrowser =
    preferredBrowser.trim().toLowerCase() === "chrome"
      ? "chrome"
      : preferredBrowser.trim().toLowerCase() === "edge"
        ? "edge"
        : "system";
  const openError = openUrl(targetUrl, normalizedBrowser);

  if (openError) {
    return {
      ok: false,
      message: openError
    };
  }

  return {
    ok: true,
    message:
      normalizedBrowser === "chrome"
        ? "Chrome opened successfully."
        : "Browser page opened successfully."
  };
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { ok: false, message: "Missing request URL." });
    return;
  }

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "commandpilot-local-bridge",
      port: PORT,
      aiConfigured: isAiConfigured()
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/settings/runtime") {
    sendJson(response, 200, {
      ok: true,
      message: "Runtime safety settings loaded.",
      ...toRuntimeSettingsPayload()
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/settings/runtime") {
    try {
      const body = await readJsonBody<RuntimeSettingsRequest>(request);
      const validationError = validateRuntimeSettingsRequest(body);
      if (validationError) {
        sendJson(response, 400, { ok: false, message: validationError });
        return;
      }

      applyRuntimeSettingsPatch(body);
      sendJson(response, 200, {
        ok: true,
        message: "Runtime safety settings updated.",
        ...toRuntimeSettingsPayload()
      });
      return;
    } catch {
      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/ai/interpret") {
    try {
      const body = await readJsonBody<EchoAiInterpretRequest>(request);

      if (typeof body.command !== "string" || !body.command.trim()) {
        sendJson(response, 400, { ok: false, message: "A command is required." });
        return;
      }

      const result = await interpretCommandWithAi({
        command: body.command,
        conversation: Array.isArray(body.conversation) ? body.conversation : []
      });
      sendJson(response, 200, {
        ok: true,
        ...result
      });
      return;
    } catch (error) {
      if (isEchoAiBridgeError(error)) {
        sendJson(response, error.statusCode, { ok: false, message: error.message });
        return;
      }

      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/command/execute") {
    try {
      const body = await readJsonBody<CommandExecuteRequest>(request);
      const rawCommand = typeof body.command === "string" ? body.command.trim() : "";

      if (!rawCommand) {
        sendJson(response, 400, { ok: false, message: "A command is required." });
        return;
      }

      const shouldUseAi = body.forceAiInterpret === true || shouldInterpretWithAi(rawCommand);
      const conversation = sanitizeConversation(body.conversation);
      let normalizedCommand = rawCommand;
      let provider: "openai" | "ollama" | undefined;
      let model: string | undefined;

      if (shouldUseAi) {
        try {
          const aiResult = await interpretCommandWithAi({
            command: rawCommand,
            conversation
          });

          provider = aiResult.provider;
          model = aiResult.model;

          if (aiResult.interpretation.mode === "respond") {
            sendJson(response, 200, {
              ok: true,
              status: "responded",
              intent: "conversation",
              message: aiResult.interpretation.assistantReply,
              normalizedCommand: null,
              provider,
              model
            });
            return;
          }

          if (aiResult.interpretation.normalizedCommand) {
            normalizedCommand = aiResult.interpretation.normalizedCommand;
          }
        } catch (error) {
          if (body.forceAiInterpret === true) {
            if (isEchoAiBridgeError(error)) {
              sendJson(response, error.statusCode, { ok: false, message: error.message });
              return;
            }

            sendJson(response, 502, { ok: false, message: "AI interpretation failed unexpectedly." });
            return;
          }
        }
      }

      let executionResult = simulateExecution(
        planCommand(normalizedCommand, {
          approvedRoots: runtimeSafetySettings.approvedRoots,
          trustedWebsiteHosts: getTrustedWebsiteHosts(),
          approvedLinkedAppKeys: getApprovedLinkedAppKeys()
        })
      );

      const autoApprove = body.autoApprove !== false;
      if (autoApprove && executionResult.status === "awaiting_approval") {
        executionResult = autoApproveExecutionResult(executionResult, executionResult.plan.echo.success);
      }

      const runtimeResult = await executeRuntimeActions(executionResult);
      sendJson(response, 200, {
        ok: runtimeResult.ok,
        status: runtimeResult.ok ? executionResult.status : "failed",
        intent: executionResult.plan.intent,
        message: runtimeResult.message,
        normalizedCommand,
        provider,
        model
      });
      return;
    } catch (error) {
      if (isEchoAiBridgeError(error)) {
        sendJson(response, error.statusCode, { ok: false, message: error.message });
        return;
      }

      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/desktop/open-folder") {
    try {
      const body = await readJsonBody<PathRequest>(request);
      const targetPath = body.path?.trim();

      if (!targetPath) {
        sendJson(response, 400, { ok: false, message: "A folder path is required." });
        return;
      }

      const result = openFolder(
        targetPath,
        body.createIfMissing === true,
        body.allowOutsideApprovedRoots === true
      );
      sendJson(response, result.ok ? 200 : 400, result);
      return;
    } catch {
      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/desktop/open-file") {
    try {
      const body = await readJsonBody<PathRequest>(request);
      const targetPath = body.path?.trim();

      if (!targetPath) {
        sendJson(response, 400, { ok: false, message: "A file path is required." });
        return;
      }

      const result = openFile(targetPath, body.allowOutsideApprovedRoots === true);
      sendJson(response, result.ok ? 200 : 400, result);
      return;
    } catch {
      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/desktop/path-state") {
    try {
      const body = await readJsonBody<PathRequest>(request);
      const targetPath = body.path?.trim();

      if (!targetPath) {
        sendJson(response, 400, { ok: false, message: "A path is required." });
        return;
      }

      const result = getPathState(targetPath, body.allowOutsideApprovedRoots === true);
      sendJson(response, result.ok ? 200 : 400, result);
      return;
    } catch {
      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/desktop/list-folder") {
    try {
      const body = await readJsonBody<PathRequest>(request);
      const targetPath = body.path?.trim();

      if (!targetPath) {
        sendJson(response, 400, { ok: false, message: "A folder path is required." });
        return;
      }

      const result = listFolderContents(targetPath);
      sendJson(response, result.ok ? 200 : 400, result);
      return;
    } catch {
      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/desktop/create-folder") {
    try {
      const body = await readJsonBody<PathRequest>(request);
      const targetPath = body.path?.trim();

      if (!targetPath) {
        sendJson(response, 400, { ok: false, message: "A folder path is required." });
        return;
      }

      const result = createFolder(targetPath, body.allowOutsideApprovedRoots === true);
      sendJson(response, result.ok ? 200 : 400, result);
      return;
    } catch {
      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/desktop/create-text-file") {
    try {
      const body = await readJsonBody<CreateTextFileRequest>(request);
      const targetPath = body.path?.trim();

      if (!targetPath) {
        sendJson(response, 400, { ok: false, message: "A file path is required." });
        return;
      }

      const result = createTextFile(
        targetPath,
        body.content?.toString() ?? "Echo created this file.",
        body.overwrite === true,
        body.allowOutsideApprovedRoots === true
      );
      sendJson(response, result.ok ? 200 : 400, result);
      return;
    } catch {
      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/desktop/type-text") {
    try {
      const body = await readJsonBody<TypeTextRequest>(request);
      const text = body.text?.toString() ?? "";
      const result = typeTextIntoActiveWindow(text, body.pressEnter === true);
      sendJson(response, result.ok ? 200 : 400, result);
      return;
    } catch {
      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/apps/status") {
    try {
      const body = await readJsonBody<LinkedAppRequest>(request);
      if (!isLinkedAppAllowed(body)) {
        sendJson(response, 403, { ok: false, message: "That app is outside your approved apps list." });
        return;
      }

      const result = await getLinkedAppStatus(body);
      sendJson(response, result.ok ? 200 : 400, result);
      return;
    } catch {
      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/apps/launch") {
    try {
      const body = await readJsonBody<LinkedAppRequest>(request);
      if (!isLinkedAppAllowed(body)) {
        sendJson(response, 403, { ok: false, message: "That app is outside your approved apps list." });
        return;
      }

      const result = await launchLinkedApp(body);
      sendJson(response, result.ok ? 200 : 400, result);
      return;
    } catch {
      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/api/browser/open") {
    try {
      const body = await readJsonBody<BrowserRequest>(request);
      const targetUrl = body.url?.trim();

      if (!targetUrl) {
        sendJson(response, 400, { ok: false, message: "A browser URL is required." });
        return;
      }

      const result = openBrowserPage(targetUrl, body.preferredBrowser?.toString() ?? "system");
      sendJson(response, result.ok ? 200 : 400, result);
      return;
    } catch {
      sendJson(response, 400, { ok: false, message: "Invalid JSON body." });
      return;
    }
  }

  sendJson(response, 404, { ok: false, message: "Route not found." });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`CommandPilot local bridge listening on http://127.0.0.1:${PORT}`);
});
