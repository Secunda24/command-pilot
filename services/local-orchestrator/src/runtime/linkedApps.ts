import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { linkedApps, type LinkedAppDefinition } from "@commandpilot/core";

const PLAYGROUND_ROOT = "C:\\Users\\angel\\OneDrive\\Documentos\\Playground";
const NODE_TOOL_ROOT = `${PLAYGROUND_ROOT}\\clientflow-portal\\.tools\\node`;
const NPM_CMD = `${PLAYGROUND_ROOT}\\clientflow-portal\\.tools\\node\\npm.cmd`;
const PYTHON_EXE = "C:\\Users\\angel\\AppData\\Local\\Programs\\Python\\Python313\\python.exe";
const chromeBrowserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Users\\angel\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"
];
const edgeBrowserCandidates = [
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];
const preferredBrowserCandidates = [...chromeBrowserCandidates, ...edgeBrowserCandidates];

interface LinkedAppRequest {
  appKey?: string;
  appName?: string;
  routePath?: string;
  routeName?: string;
}

interface LocalLinkedAppConfig {
  repoPath: string;
  launchUrl: string;
  healthUrl: string;
  processMatch: string;
  startCommand?: {
    filePath: string;
    args: string[];
    cwd: string;
    env?: Record<string, string>;
  };
}

export interface LinkedAppBridgePayload {
  ok: boolean;
  message: string;
  appKey?: string;
  appName?: string;
  launchUrl?: string;
  running?: boolean;
}

function createNextDevCommand(port: number, cwd: string) {
  return {
    filePath: "powershell.exe",
    args: [
      "-NoProfile",
      "-Command",
      `& '${NPM_CMD}' run dev -- --hostname 127.0.0.1 --port ${port}`
    ],
    cwd,
    env: {
      PATH: `${NODE_TOOL_ROOT};${process.env.PATH ?? ""}`
    }
  };
}

const linkedAppConfigByKey: Record<string, LocalLinkedAppConfig> = {
  promptpilot: {
    repoPath: `${PLAYGROUND_ROOT}\\promptpilot-studio`,
    launchUrl: "http://127.0.0.1:3003",
    healthUrl: "http://127.0.0.1:3003/api/health",
    processMatch: "promptpilot-studio|3003|next dev",
    startCommand: createNextDevCommand(3003, `${PLAYGROUND_ROOT}\\promptpilot-studio`)
  },
  clientflow: {
    repoPath: `${PLAYGROUND_ROOT}\\clientflow-portal`,
    launchUrl: "http://127.0.0.1:3000",
    healthUrl: "http://127.0.0.1:3000/api/health",
    processMatch: "clientflow-portal|3000|next dev",
    startCommand: createNextDevCommand(3000, `${PLAYGROUND_ROOT}\\clientflow-portal`)
  },
  flowpilot: {
    repoPath: `${PLAYGROUND_ROOT}\\flowpilot`,
    launchUrl: "http://127.0.0.1:3001",
    healthUrl: "http://127.0.0.1:3001/api/health",
    processMatch: "flowpilot|3001|next dev",
    startCommand: createNextDevCommand(3001, `${PLAYGROUND_ROOT}\\flowpilot`)
  },
  fieldops: {
    repoPath: `${PLAYGROUND_ROOT}\\fieldops-mobile-github-upload`,
    launchUrl: "http://127.0.0.1:3002",
    healthUrl: "http://127.0.0.1:3002/api/health",
    processMatch: "fieldops-mobile-github-upload|3002|next dev",
    startCommand: createNextDevCommand(3002, `${PLAYGROUND_ROOT}\\fieldops-mobile-github-upload`)
  },
  accounting: {
    repoPath: `${PLAYGROUND_ROOT}\\bookkeeping_demo_github_ready`,
    launchUrl: "http://127.0.0.1:8000",
    healthUrl: "http://127.0.0.1:8000/api/health",
    processMatch: "bookkeeping_demo_github_ready|app.main:app|8000",
    startCommand: {
      filePath: PYTHON_EXE,
      args: ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
      cwd: `${PLAYGROUND_ROOT}\\bookkeeping_demo_github_ready`
    }
  },
  maps: {
    repoPath: `${PLAYGROUND_ROOT}\\secunda_street_finder`,
    launchUrl: "http://127.0.0.1:8010",
    healthUrl: "http://127.0.0.1:8010/api/health",
    processMatch: "secunda_street_finder.main:app|8010|secunda_street_finder",
    startCommand: {
      filePath: PYTHON_EXE,
      args: ["-m", "uvicorn", "secunda_street_finder.main:app", "--host", "127.0.0.1", "--port", "8010"],
      cwd: PLAYGROUND_ROOT
    }
  },
  chatgpt: {
    repoPath: PLAYGROUND_ROOT,
    launchUrl: "https://chatgpt.com",
    healthUrl: "https://chatgpt.com",
    processMatch: "chatgpt.com"
  },
  codex: {
    repoPath: PLAYGROUND_ROOT,
    launchUrl: "https://chatgpt.com/codex",
    healthUrl: "https://chatgpt.com/codex",
    processMatch: "chatgpt.com/codex|codex"
  }
};

function escapePowerShellLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function buildLaunchUrl(baseUrl: string, routePath?: string): string {
  if (!routePath) {
    return baseUrl;
  }

  if (/^https?:\/\//i.test(routePath)) {
    return routePath;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${normalizedBase}${normalizedPath}`;
}

function resolveLinkedApp(request: LinkedAppRequest): (LinkedAppDefinition & LocalLinkedAppConfig) | null {
  const matchedCoreApp =
    linkedApps.find((app) => app.key === request.appKey) ??
    linkedApps.find((app) => app.name.toLowerCase() === request.appName?.trim().toLowerCase());

  if (!matchedCoreApp) {
    return null;
  }

  const config = linkedAppConfigByKey[matchedCoreApp.key];
  if (!config) {
    return null;
  }

  return {
    ...matchedCoreApp,
    ...config
  };
}

async function probeUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal
    });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function hasActiveLaunchProcess(app: LinkedAppDefinition & LocalLinkedAppConfig): boolean {
  const escapedPattern = escapePowerShellLiteral(app.processMatch);
  const processResult = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node|cmd|python' -and $_.CommandLine -match '${escapedPattern}' } | Select-Object -First 1 -ExpandProperty ProcessId`
    ],
    {
      windowsHide: true,
      encoding: "utf8"
    }
  );

  if (processResult.error || processResult.status !== 0) {
    return false;
  }

  return processResult.stdout.trim().length > 0;
}

async function resolveRuntimeState(app: LinkedAppDefinition & LocalLinkedAppConfig): Promise<{
  running: boolean;
  source: "http" | "process" | "none";
}> {
  const httpRunning = await probeUrl(app.healthUrl);
  if (httpRunning) {
    return { running: true, source: "http" };
  }

  const processRunning = hasActiveLaunchProcess(app);
  if (processRunning) {
    return { running: true, source: "process" };
  }

  return { running: false, source: "none" };
}

function resolvePreferredBrowser(preferredBrowser: "chrome" | "edge" | "system"): string | null {
  if (preferredBrowser === "chrome") {
    return chromeBrowserCandidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  if (preferredBrowser === "edge") {
    return edgeBrowserCandidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  return preferredBrowserCandidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function openUrl(
  url: string,
  preferredBrowser: "chrome" | "edge" | "system" = "system"
): string | null {
  const resolvedBrowser = resolvePreferredBrowser(preferredBrowser);

  if (resolvedBrowser) {
    const browserResult = spawnSync(
      "cmd.exe",
      ["/c", "start", "", "/D", dirname(resolvedBrowser), resolvedBrowser, "--new-window", url],
      {
        windowsHide: false,
        encoding: "utf8"
      }
    );

    if (!browserResult.error && browserResult.status === 0) {
      return null;
    }
  }

  const openResult = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", `Start-Process '${escapePowerShellLiteral(url)}'`],
    {
      windowsHide: true,
      encoding: "utf8"
    }
  );

  if (openResult.error || openResult.status !== 0) {
    return openResult.error?.message || openResult.stderr?.trim() || "Windows could not open that app URL.";
  }

  return null;
}

function startDetachedApp(app: LinkedAppDefinition & LocalLinkedAppConfig): string | null {
  if (!app.startCommand) {
    return `${app.name} does not have a configured local start command yet.`;
  }

  if (!existsSync(app.repoPath)) {
    return `${app.name} is not linked on this PC yet.`;
  }

  if (!existsSync(app.startCommand.cwd)) {
    return `${app.name} launch folder is missing.`;
  }

  const needsPresenceCheck = /^[a-zA-Z]:\\/.test(app.startCommand.filePath);
  if (needsPresenceCheck && !existsSync(app.startCommand.filePath)) {
    return `${app.name} launch dependency is missing on this PC.`;
  }

  try {
    const launchResult = spawnSync(
      "cmd.exe",
      ["/c", "start", "", "/D", app.startCommand.cwd, app.startCommand.filePath, ...app.startCommand.args],
      {
        cwd: app.startCommand.cwd,
        windowsHide: false,
        encoding: "utf8",
        env: {
          ...process.env,
          ...app.startCommand.env
        }
      }
    );

    if (launchResult.error || launchResult.status !== 0) {
      return (
        launchResult.error?.message ||
        launchResult.stderr?.trim() ||
        `I couldn't start ${app.name}.`
      );
    }

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : `I couldn't start ${app.name}.`;
  }
}

function isWebLinkedApp(app: LinkedAppDefinition & LocalLinkedAppConfig): boolean {
  return !app.startCommand && /^https?:\/\//i.test(app.launchUrl);
}

export async function getLinkedAppStatus(request: LinkedAppRequest): Promise<LinkedAppBridgePayload> {
  const app = resolveLinkedApp(request);

  if (!app) {
    return {
      ok: false,
      message: "That linked app is not registered yet."
    };
  }

  const targetUrl = buildLaunchUrl(app.launchUrl, request.routePath);

  if (isWebLinkedApp(app)) {
    return {
      ok: true,
      message: `${app.name} is ready on the web at ${targetUrl}.`,
      appKey: app.key,
      appName: app.name,
      launchUrl: targetUrl,
      running: true
    };
  }

  const runtimeState = await resolveRuntimeState(app);
  const running = runtimeState.running;

  return {
    ok: true,
    message: running
      ? runtimeState.source === "http"
        ? `${app.name} is running at ${targetUrl}.`
        : `${app.name} is launching locally at ${targetUrl}.`
      : `${app.name} is currently offline.`,
    appKey: app.key,
    appName: app.name,
    launchUrl: targetUrl,
    running
  };
}

export async function launchLinkedApp(request: LinkedAppRequest): Promise<LinkedAppBridgePayload> {
  const app = resolveLinkedApp(request);

  if (!app) {
    return {
      ok: false,
      message: "That linked app is not registered yet."
    };
  }

  const targetUrl = buildLaunchUrl(app.launchUrl, request.routePath);

  if (isWebLinkedApp(app)) {
    const openError = openUrl(targetUrl);
    if (openError) {
      return {
        ok: false,
        message: openError,
        appKey: app.key,
        appName: app.name,
        launchUrl: targetUrl,
        running: false
      };
    }

    return {
      ok: true,
      message: request.routeName
        ? `Done. I've opened ${request.routeName} in ${app.name}.`
        : `Done. I've opened ${app.name}.`,
      appKey: app.key,
      appName: app.name,
      launchUrl: targetUrl,
      running: true
    };
  }

  const runtimeState = await resolveRuntimeState(app);
  const alreadyRunning = runtimeState.running;

  if (alreadyRunning) {
    const openError = openUrl(targetUrl);
    if (openError) {
      return {
        ok: false,
        message: openError,
        appKey: app.key,
        appName: app.name,
        launchUrl: targetUrl,
        running: true
      };
    }

    return {
      ok: true,
      message: request.routeName
        ? `Done. I've opened ${request.routeName} in ${app.name}.`
        : `Done. ${app.name} is already running, and I've opened it.`,
      appKey: app.key,
      appName: app.name,
      launchUrl: targetUrl,
      running: true
    };
  }

  const startError = startDetachedApp(app);
  if (startError) {
    return {
      ok: false,
      message: startError,
      appKey: app.key,
      appName: app.name,
      launchUrl: targetUrl,
      running: false
    };
  }

  const openError = openUrl(targetUrl);
  if (openError) {
    return {
      ok: false,
      message: openError,
      appKey: app.key,
      appName: app.name,
      launchUrl: targetUrl,
      running: false
    };
  }

  return {
    ok: true,
    message: request.routeName
      ? `Done. I'm starting ${app.name} and opening ${request.routeName}. It may take a few seconds to come online.`
      : `Done. I'm starting ${app.name} and opening it now. It may take a few seconds to come online.`,
    appKey: app.key,
    appName: app.name,
    launchUrl: targetUrl,
    running: false
  };
}
