import {
  linkedApps,
  normalizeTrustedWebsiteHosts,
  trustedWebsiteHosts as defaultTrustedWebsiteHosts,
  type EchoAiInterpretRequest
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
  interpretCommandWithOpenAi,
  isEchoAiBridgeError,
  isOpenAiConfigured
} from "./runtime/openaiResponses";

const PORT = 8787;
loadCommandPilotEnv();

const defaultApprovedRoots = [
  "C:\\Users\\angel\\OneDrive\\Desktop",
  "C:\\Users\\angel\\OneDrive\\Documentos"
];
const allowedTextExtensions = new Set([".txt", ".md", ".json", ".csv", ".rtf"]);
const MAX_TYPED_TEXT_CHARACTERS = 1200;

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
      aiConfigured: isOpenAiConfigured()
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

      const result = await interpretCommandWithOpenAi({
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
