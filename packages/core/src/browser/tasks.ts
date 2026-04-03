export interface ChromeTaskTemplate {
  key: string;
  name: string;
  description: string;
  host: string;
  aliases: string[];
  mode: "fixed" | "query";
  fixedUrl?: string;
  queryBaseUrl?: string;
  queryParameter?: string;
  queryRequired?: boolean;
  followUps: string[];
}

export interface ChromeTaskMatch {
  task: ChromeTaskTemplate;
  url: string;
  label: string;
  query?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeAlias(value: string): string {
  return normalizeText(value).replace(/^the\s+/, "");
}

function hasWordAlias(text: string, alias: string): boolean {
  return new RegExp(`(^|\\b)${escapeRegExp(alias)}(\\b|$)`, "i").test(text);
}

function findBestAlias(text: string, aliases: string[]): string | null {
  const normalizedAliases = aliases.map(normalizeAlias).sort((left, right) => right.length - left.length);
  return normalizedAliases.find((alias) => hasWordAlias(text, alias)) ?? null;
}

function trimChromeSuffix(value: string): string {
  return value
    .replace(/(?:^|\s+)in\s+(?:google\s+)?chrome$/i, "")
    .replace(/(?:^|\s+)on\s+(?:google\s+)?chrome$/i, "")
    .trim();
}

function extractQueryFromText(commandText: string, alias: string): string | null {
  const normalizedCommand = normalizeText(commandText);
  const aliasIndex = normalizedCommand.indexOf(alias);
  if (aliasIndex < 0) {
    return null;
  }

  const trailing = trimChromeSuffix(normalizedCommand.slice(aliasIndex + alias.length).trim())
    .replace(/^(?:for|about|on|to)\s+/, "")
    .trim();

  if (trailing) {
    return trailing;
  }

  const leading = normalizedCommand
    .slice(0, aliasIndex)
    .replace(/^(?:hey\s+)?echo(?:\s+|,\s*)/i, "")
    .replace(/^(?:open|launch|start|go to|navigate to|find|search)\s+/, "")
    .replace(/^(?:in\s+)?(?:google\s+)?chrome(?:,)?\s*/, "")
    .trim();

  if (!leading || leading === alias) {
    return null;
  }

  return leading;
}

function hasExplicitUrlToken(text: string): boolean {
  return /\bhttps?:\/\/\S+|\b[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?\b/i.test(text);
}

function buildQueryUrl(baseUrl: string, parameter: string, query: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set(parameter, query);
  return url.toString();
}

export const chromeTaskTemplates: ChromeTaskTemplate[] = [
  {
    key: "gmail-inbox",
    name: "Gmail Inbox",
    description: "Open your Gmail inbox directly.",
    host: "mail.google.com",
    aliases: ["gmail inbox", "my inbox", "mail inbox", "gmail"],
    mode: "fixed",
    fixedUrl: "https://mail.google.com/mail/u/0/#inbox",
    followUps: ["Open Google Calendar in Chrome", "Open Google Drive in Chrome"]
  },
  {
    key: "calendar-today",
    name: "Google Calendar Today",
    description: "Open today's calendar view.",
    host: "calendar.google.com",
    aliases: ["calendar today", "today calendar", "google calendar", "calendar"],
    mode: "fixed",
    fixedUrl: "https://calendar.google.com/calendar/u/0/r/day",
    followUps: ["Open Gmail inbox in Chrome", "Open Google Drive in Chrome"]
  },
  {
    key: "drive-recent",
    name: "Google Drive Recent",
    description: "Open the recent files view in Drive.",
    host: "drive.google.com",
    aliases: ["google drive recent", "drive recent", "google drive", "drive"],
    mode: "fixed",
    fixedUrl: "https://drive.google.com/drive/recent",
    followUps: ["Open Google Docs in Chrome", "Open Gmail inbox in Chrome"]
  },
  {
    key: "docs-home",
    name: "Google Docs Home",
    description: "Open Google Docs home.",
    host: "docs.google.com",
    aliases: ["google docs", "docs home", "docs"],
    mode: "fixed",
    fixedUrl: "https://docs.google.com/document/u/0/",
    followUps: ["Open Google Drive in Chrome", "Search Chrome for writing template"]
  },
  {
    key: "maps-search",
    name: "Google Maps Search",
    description: "Search a place in Google Maps.",
    host: "maps.google.com",
    aliases: ["google maps", "maps", "map"],
    mode: "query",
    queryBaseUrl: "https://maps.google.com/",
    queryParameter: "q",
    queryRequired: false,
    followUps: ["Open Maps in Chrome", "Search Chrome for directions tips"]
  },
  {
    key: "chatgpt-codex",
    name: "ChatGPT Codex",
    description: "Open ChatGPT Codex workspace.",
    host: "chatgpt.com",
    aliases: ["chatgpt codex", "codex", "open codex"],
    mode: "fixed",
    fixedUrl: "https://chatgpt.com/codex",
    followUps: ["Open ChatGPT in Chrome", "Open PromptPilot Studio"]
  },
  {
    key: "chatgpt-home",
    name: "ChatGPT",
    description: "Open ChatGPT home.",
    host: "chatgpt.com",
    aliases: ["chatgpt", "chat gpt", "my chatgpt"],
    mode: "fixed",
    fixedUrl: "https://chatgpt.com",
    followUps: ["Open ChatGPT Codex in Chrome", "Open Gmail inbox in Chrome"]
  },
  {
    key: "notion-home",
    name: "Notion Workspace",
    description: "Open your Notion workspace.",
    host: "notion.so",
    aliases: ["notion workspace", "notion", "open notion"],
    mode: "fixed",
    fixedUrl: "https://www.notion.so",
    followUps: ["Open ClickUp in Chrome", "Open Google Drive in Chrome"]
  },
  {
    key: "clickup-home",
    name: "ClickUp Workspace",
    description: "Open ClickUp app.",
    host: "app.clickup.com",
    aliases: ["clickup workspace", "clickup", "click up"],
    mode: "fixed",
    fixedUrl: "https://app.clickup.com",
    followUps: ["Open Notion workspace in Chrome", "Open Gmail inbox in Chrome"]
  },
  {
    key: "google-search",
    name: "Google Search",
    description: "Search in Google.",
    host: "google.com",
    aliases: ["google search", "search google", "google"],
    mode: "query",
    queryBaseUrl: "https://www.google.com/search",
    queryParameter: "q",
    queryRequired: false,
    followUps: ["Open Gmail inbox in Chrome", "Open Google Calendar in Chrome"]
  }
];

export function isChromeTaskCommand(text: string): boolean {
  const normalized = normalizeText(text);
  return /\bchrome\b/.test(normalized) || /^search\b/.test(normalized);
}

export function matchChromeTaskCommand(commandText: string): ChromeTaskMatch | null {
  if (!isChromeTaskCommand(commandText)) {
    return null;
  }

  const normalizedCommand = normalizeText(commandText);
  const explicitUrlToken = hasExplicitUrlToken(normalizedCommand);

  const candidates = chromeTaskTemplates
    .map((task) => ({
      task,
      alias: findBestAlias(normalizedCommand, task.aliases)
    }))
    .filter((candidate): candidate is { task: ChromeTaskTemplate; alias: string } => Boolean(candidate.alias))
    .sort((left, right) => right.alias.length - left.alias.length);

  for (const { task, alias } of candidates) {
    if (task.mode === "query" && explicitUrlToken) {
      continue;
    }

    if (task.mode === "fixed") {
      if (!task.fixedUrl) {
        continue;
      }

      return {
        task,
        url: task.fixedUrl,
        label: task.name
      };
    }

    const extractedQuery = extractQueryFromText(commandText, alias);
    const query = extractedQuery?.trim();
    if (task.queryRequired && !query) {
      return {
        task,
        url: task.queryBaseUrl ?? task.fixedUrl ?? "",
        label: task.name
      };
    }

    if (!task.queryBaseUrl || !task.queryParameter) {
      continue;
    }

    if (!query) {
      return {
        task,
        url: task.queryBaseUrl,
        label: task.name
      };
    }

    return {
      task,
      url: buildQueryUrl(task.queryBaseUrl, task.queryParameter, query),
      label: `${task.name}: ${query}`,
      query
    };
  }

  return null;
}
