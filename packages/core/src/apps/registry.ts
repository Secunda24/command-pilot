export interface LinkedAppDefinition {
  key: string;
  name: string;
  aliases: string[];
  description: string;
  executionTarget: "pc" | "either";
}

export interface LinkedAppTextCandidate {
  app: LinkedAppDefinition;
  score: number;
  matchedAlias: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasAlias(text: string, alias: string): boolean {
  return new RegExp(`(^|\\b)${escapeRegExp(alias)}(\\b|$)`, "i").test(text);
}

function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return right.length;
  }

  if (!right) {
    return left.length;
  }

  const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previousRow[0];
    previousRow[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const nextDiagonal = previousRow[column];
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      previousRow[column] = Math.min(
        previousRow[column] + 1,
        previousRow[column - 1] + 1,
        diagonal + substitutionCost
      );
      diagonal = nextDiagonal;
    }
  }

  return previousRow[right.length];
}

function stringSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeForComparison(left);
  const normalizedRight = normalizeForComparison(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const distance = levenshteinDistance(normalizedLeft, normalizedRight);
  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
  return maxLength === 0 ? 0 : Math.max(0, 1 - distance / maxLength);
}

const commandStopWords = new Set([
  "open",
  "launch",
  "start",
  "bring",
  "up",
  "is",
  "check",
  "status",
  "running",
  "online",
  "the",
  "my",
  "app",
  "please",
  "echo",
  "hey",
  "what",
  "whats"
]);

function resolveComparableTokens(normalizedText: string): string[] {
  const rawTokens = tokenize(normalizedText);
  const filteredTokens = rawTokens.filter((token) => !commandStopWords.has(token));
  return filteredTokens.length > 0 ? filteredTokens : rawTokens;
}

function scoreAlias(
  normalizedText: string,
  comparableTokens: string[],
  rawAlias: string
): { score: number; matchedAlias: string } {
  const normalizedAlias = normalizeForComparison(rawAlias);
  if (!normalizedAlias) {
    return {
      score: 0,
      matchedAlias: rawAlias
    };
  }

  if (normalizedText === normalizedAlias || hasAlias(normalizedText, normalizedAlias)) {
    return {
      score: 1,
      matchedAlias: rawAlias
    };
  }

  if (normalizedText.includes(normalizedAlias)) {
    return {
      score: 0.93,
      matchedAlias: rawAlias
    };
  }

  const aliasTokens = tokenize(normalizedAlias);
  if (aliasTokens.length === 0) {
    return {
      score: 0,
      matchedAlias: rawAlias
    };
  }

  const overlapCount = aliasTokens.filter((token) => comparableTokens.includes(token)).length;
  const overlapScore = overlapCount / aliasTokens.length;

  let fuzzyTokenTotal = 0;
  for (const aliasToken of aliasTokens) {
    const bestTokenSimilarity = comparableTokens.reduce((best, token) => {
      const similarity = stringSimilarity(aliasToken, token);
      return similarity > best ? similarity : best;
    }, 0);
    fuzzyTokenTotal += bestTokenSimilarity;
  }

  const fuzzyTokenScore = fuzzyTokenTotal / aliasTokens.length;
  const finalScore = Math.max(overlapScore * 0.82, fuzzyTokenScore * 0.88);

  return {
    score: Math.min(1, finalScore),
    matchedAlias: rawAlias
  };
}

function scoreLinkedApp(
  normalizedText: string,
  comparableTokens: string[],
  app: LinkedAppDefinition
): LinkedAppTextCandidate {
  const candidateAliases = [app.name, ...app.aliases];
  let bestScore = 0;
  let matchedAlias = candidateAliases[0] ?? app.name;

  for (const alias of candidateAliases) {
    const aliasScore = scoreAlias(normalizedText, comparableTokens, alias);
    if (aliasScore.score > bestScore) {
      bestScore = aliasScore.score;
      matchedAlias = aliasScore.matchedAlias;
    }
  }

  return {
    app,
    score: bestScore,
    matchedAlias
  };
}

export const linkedApps: LinkedAppDefinition[] = [
  {
    key: "promptpilot",
    name: "PromptPilot Studio",
    aliases: ["promptpilot", "promptpilot studio", "prompt pilot"],
    description: "Prompt and content workspace.",
    executionTarget: "pc"
  },
  {
    key: "clientflow",
    name: "Clientflow",
    aliases: ["clientflow", "client flow", "clientflow portal"],
    description: "Client operations and portal workspace.",
    executionTarget: "pc"
  },
  {
    key: "flowpilot",
    name: "FlowPilot",
    aliases: ["flowpilot", "flow pilot"],
    description: "Workflow and operations command workspace.",
    executionTarget: "pc"
  },
  {
    key: "fieldops",
    name: "FieldOps",
    aliases: ["fieldops", "field ops", "fieldops mobile"],
    description: "Field operations dashboard and mobile workflow app.",
    executionTarget: "pc"
  },
  {
    key: "accounting",
    name: "Accounting",
    aliases: ["accounting", "bookkeeping", "bookkeeping demo"],
    description: "Local bookkeeping and finance review app.",
    executionTarget: "pc"
  },
  {
    key: "maps",
    name: "Maps",
    aliases: ["maps", "map app", "street finder", "secunda street finder"],
    description: "Street finder and local map lookup workspace.",
    executionTarget: "pc"
  },
  {
    key: "chatgpt",
    name: "ChatGPT",
    aliases: ["chatgpt", "chat gpt", "my chatgpt", "my chatgpt account"],
    description: "ChatGPT web workspace tied to your signed-in account.",
    executionTarget: "pc"
  },
  {
    key: "codex",
    name: "Codex",
    aliases: ["codex", "openai codex", "codex app"],
    description: "Codex workspace for coding assistance.",
    executionTarget: "pc"
  }
];

export function findLinkedAppCandidatesByText(
  text: string,
  minimumScore = 0.58,
  limit = 3
): LinkedAppTextCandidate[] {
  const normalizedText = normalizeForComparison(text);
  if (!normalizedText) {
    return [];
  }

  const comparableTokens = resolveComparableTokens(normalizedText);
  return linkedApps
    .map((app) => scoreLinkedApp(normalizedText, comparableTokens, app))
    .filter((candidate) => candidate.score >= minimumScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, limit));
}

export function findLinkedAppByText(text: string): LinkedAppDefinition | null {
  const [bestCandidate] = findLinkedAppCandidatesByText(text, 0.76, 1);
  return bestCandidate?.app ?? null;
}

export function findLinkedAppLaunchMatch(text: string): LinkedAppDefinition | null {
  if (!/^(open|launch|start|bring up)\b/i.test(text.trim())) {
    return null;
  }

  return findLinkedAppByText(text);
}

export function findLinkedAppStatusMatch(text: string): LinkedAppDefinition | null {
  const normalizedText = text.trim().toLowerCase();
  const looksLikeStatusCommand =
    /^is\b/.test(normalizedText) ||
    /^check\b/.test(normalizedText) ||
    /^what'?s\b/.test(normalizedText) ||
    normalizedText.includes(" status") ||
    normalizedText.includes(" running") ||
    normalizedText.includes(" online");

  if (!looksLikeStatusCommand) {
    return null;
  }

  return findLinkedAppByText(text);
}
