export interface TrustedWebsiteRule {
  id: string;
  label: string;
  defaultUrl: string;
  aliases: string[];
  host: string;
  allowSubdomains?: boolean;
}

export interface TrustedWebsiteTarget {
  url: string;
  label: string;
  host: string;
}

export const trustedWebsiteRules: TrustedWebsiteRule[] = [
  {
    id: "google-search",
    label: "Google",
    defaultUrl: "https://www.google.com",
    aliases: ["google", "google search", "search"],
    host: "google.com",
    allowSubdomains: true
  },
  {
    id: "youtube",
    label: "YouTube",
    defaultUrl: "https://www.youtube.com",
    aliases: ["youtube", "yt"],
    host: "youtube.com",
    allowSubdomains: true
  },
  {
    id: "gmail",
    label: "Gmail",
    defaultUrl: "https://mail.google.com",
    aliases: ["gmail", "mail", "google mail", "inbox"],
    host: "mail.google.com"
  },
  {
    id: "google-calendar",
    label: "Google Calendar",
    defaultUrl: "https://calendar.google.com",
    aliases: ["google calendar", "calendar", "gcal"],
    host: "calendar.google.com"
  },
  {
    id: "google-drive",
    label: "Google Drive",
    defaultUrl: "https://drive.google.com",
    aliases: ["google drive", "drive"],
    host: "drive.google.com"
  },
  {
    id: "google-docs",
    label: "Google Docs",
    defaultUrl: "https://docs.google.com",
    aliases: ["google docs", "docs"],
    host: "docs.google.com"
  },
  {
    id: "google-maps",
    label: "Google Maps",
    defaultUrl: "https://maps.google.com",
    aliases: ["maps", "google maps"],
    host: "maps.google.com"
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    defaultUrl: "https://chatgpt.com",
    aliases: ["chatgpt", "chat gpt", "my chatgpt", "my chatgpt account"],
    host: "chatgpt.com",
    allowSubdomains: true
  },
  {
    id: "notion",
    label: "Notion",
    defaultUrl: "https://notion.so",
    aliases: ["notion", "notion workspace"],
    host: "notion.so",
    allowSubdomains: true
  },
  {
    id: "clickup",
    label: "ClickUp",
    defaultUrl: "https://app.clickup.com",
    aliases: ["clickup", "click up", "app clickup"],
    host: "app.clickup.com"
  },
  {
    id: "localhost",
    label: "Localhost",
    defaultUrl: "http://127.0.0.1:3000",
    aliases: ["localhost", "local app", "local dashboard"],
    host: "localhost",
    allowSubdomains: true
  },
  {
    id: "loopback",
    label: "127.0.0.1",
    defaultUrl: "http://127.0.0.1:3000",
    aliases: ["127.0.0.1"],
    host: "127.0.0.1"
  }
];

export const trustedWebsiteHosts = trustedWebsiteRules.map((rule) => rule.host);
export const trustedWebsiteLabels = trustedWebsiteRules.map((rule) => rule.label);

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAlias(value: string): string {
  return normalizeValue(value)
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

function normalizeHost(host: string): string {
  return normalizeValue(host).replace(/^www\./, "");
}

export function normalizeTrustedWebsiteHost(host: string): string {
  return normalizeHost(host);
}

function isMatchingRuleHost(host: string, rule: TrustedWebsiteRule): boolean {
  const normalizedHost = normalizeHost(host);
  const normalizedRuleHost = normalizeHost(rule.host);

  if (normalizedHost === normalizedRuleHost) {
    return true;
  }

  if (rule.allowSubdomains === true && normalizedHost.endsWith(`.${normalizedRuleHost}`)) {
    return true;
  }

  return false;
}

function isHostTrustedByList(host: string, trustedHosts: string[]): boolean {
  const normalizedHost = normalizeHost(host);
  const normalizedTrustedHosts = trustedHosts.map((entry) => normalizeHost(entry));
  return normalizedTrustedHosts.some(
    (trustedHost) =>
      normalizedHost === trustedHost || normalizedHost.endsWith(`.${trustedHost}`)
  );
}

function normalizeWebUrl(rawTarget: string): string | null {
  const trimmed = rawTarget.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^[a-z0-9.-]+(\:[0-9]{2,5})?(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
}

const aliasTargetLookup = new Map<string, TrustedWebsiteRule>(
  trustedWebsiteRules.flatMap((rule) =>
    [rule.label, rule.host, ...rule.aliases].map((alias) => [normalizeAlias(alias), rule] as const)
  )
);

export function resolveTrustedWebsiteAlias(rawTarget: string): TrustedWebsiteTarget | null {
  const alias = normalizeAlias(rawTarget);
  const matchedRule = aliasTargetLookup.get(alias);

  if (!matchedRule) {
    return null;
  }

  return {
    url: matchedRule.defaultUrl,
    label: matchedRule.label,
    host: normalizeHost(matchedRule.host)
  };
}

export function parseWebsiteTarget(rawTarget: string): TrustedWebsiteTarget | null {
  const normalizedUrl = normalizeWebUrl(rawTarget);
  if (!normalizedUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    return {
      url: parsedUrl.toString(),
      label: rawTarget.trim(),
      host: normalizeHost(parsedUrl.hostname)
    };
  } catch {
    return null;
  }
}

export function normalizeTrustedWebsiteHosts(rawHosts: string[]): string[] {
  return [...new Set(rawHosts.map((entry) => normalizeHost(entry)).filter(Boolean))];
}

export function isTrustedWebsiteHost(host: string, trustedHosts?: string[]): boolean {
  if (trustedHosts && trustedHosts.length > 0) {
    return isHostTrustedByList(host, trustedHosts);
  }

  return trustedWebsiteRules.some((rule) => isMatchingRuleHost(host, rule));
}

export function resolveTrustedWebsiteTarget(
  rawTarget: string,
  trustedHosts?: string[]
): TrustedWebsiteTarget | null {
  const aliasMatch = resolveTrustedWebsiteAlias(rawTarget);
  if (aliasMatch) {
    if (!isTrustedWebsiteHost(aliasMatch.host, trustedHosts)) {
      return null;
    }

    return aliasMatch;
  }

  const parsedTarget = parseWebsiteTarget(rawTarget);
  if (parsedTarget) {
    if (!isTrustedWebsiteHost(parsedTarget.host, trustedHosts)) {
      return null;
    }

    const aliasForHost = resolveTrustedWebsiteAlias(parsedTarget.host);
    return {
      ...parsedTarget,
      label: aliasForHost?.label ?? parsedTarget.label
    };
  }

  return null;
}
