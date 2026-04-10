import { findLinkedAppRouteMatch } from "../apps/routes";
import {
  findLinkedAppByText,
  findLinkedAppCandidatesByText,
  findLinkedAppLaunchMatch,
  findLinkedAppStatusMatch,
  type LinkedAppTextCandidate
} from "../apps/registry";
import { matchChromeTaskCommand } from "../browser/tasks";
import {
  normalizeTrustedWebsiteHosts,
  parseWebsiteTarget,
  resolveTrustedWebsiteTarget,
  trustedWebsiteLabels
} from "../security/trustedWebsites";
import { skillCatalog } from "../skills/catalog";
import { workflowCatalog } from "../skills/workflows";
import { buildEchoSummary } from "../voice/echo";
import type {
  ActivityLogRecord,
  ApprovalRecord,
  CommandExecutionResult,
  CommandPlan,
  CommandStatus,
  PlannedCommandStep,
  SafetyLevel,
  WorkflowDefinition,
  WorkflowStepTemplate
} from "../types/domain";

const nowIso = () => new Date().toISOString();

function createId(prefix: string): string {
  const token = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${token}`;
}

function normalizeCommand(text: string): string {
  return text
    .toLowerCase()
    .replace(/^(?:hey\s+)?echo(?:\s+|,\s*)/i, "")
    .trim();
}

const USER_HOME_PATH = "C:\\Users\\angel";
const DESKTOP_PATH = "C:\\Users\\angel\\OneDrive\\Desktop";
const DOCUMENTS_PATH = "C:\\Users\\angel\\OneDrive\\Documentos";
const DOWNLOADS_PATH = `${USER_HOME_PATH}\\Downloads`;
const PICTURES_PATH = `${USER_HOME_PATH}\\Pictures`;
const VIDEOS_PATH = `${USER_HOME_PATH}\\Videos`;
const MUSIC_PATH = `${USER_HOME_PATH}\\Music`;
const ONEDRIVE_PATH = `${USER_HOME_PATH}\\OneDrive`;
const PLAYGROUND_PATH = "C:\\Users\\angel\\OneDrive\\Documentos\\Playground";
const COMMANDPILOT_PATH = `${PLAYGROUND_PATH}\\commandpilot`;
const ECHO_TEST_FOLDER_PATH = `${DESKTOP_PATH}\\Echo Test Folder`;
const ECHO_APPS_FOLDER_PATH = `${ECHO_TEST_FOLDER_PATH}\\Apps`;
const APPROVED_ROOTS = [DESKTOP_PATH, DOCUMENTS_PATH].map((path) => path.toLowerCase());
const MAX_TYPE_TEXT_LENGTH = 1200;
const DANGEROUS_TYPED_COMMANDS = [
  /\bgit\s+reset\s+--hard\b/i,
  /\bdel(?:ete)?\b/i,
  /\brm\s+-rf\b/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown\b/i,
  /\bpower(shell)?\b/i,
  /\bcmd\s*\/c\b/i
];

function cleanQuotedText(value: string): string {
  return value
    .trim()
    .replace(/^["']+/, "")
    .replace(/["']+$/, "")
    .replace(/^the\s+/i, "")
    .trim();
}

function ensureTextFileExtension(fileName: string): string {
  return /\.[a-z0-9]{1,8}$/i.test(fileName) ? fileName : `${fileName}.txt`;
}

function ensureWordFileExtension(fileName: string): string {
  return /\.[a-z0-9]{1,8}$/i.test(fileName) ? fileName : `${fileName}.rtf`;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").trim();
}

function resolveDocumentTargetFolder(rawTarget?: string): string | null {
  if (!rawTarget) {
    return ECHO_TEST_FOLDER_PATH;
  }

  return resolveKnownFolder(rawTarget);
}

function resolveKnownFolder(rawTarget: string): string | null {
  const normalizedTarget = cleanQuotedText(rawTarget)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const targetWithoutFolderWord = normalizedTarget
    .toLowerCase()
    .replace(/\b(folder|directory)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^[a-z]:\\/i.test(rawTarget.trim())) {
    return rawTarget.trim();
  }

  if (
    normalizedTarget.includes("echo test folder") ||
    targetWithoutFolderWord.includes("echo test") ||
    normalizedTarget === "echo folder" ||
    normalizedTarget === "my echo folder" ||
    targetWithoutFolderWord === "echo"
  ) {
    return ECHO_TEST_FOLDER_PATH;
  }

  if (
    normalizedTarget.includes("echo apps") ||
    normalizedTarget.includes("apps in my echo") ||
    normalizedTarget.includes("apps in the echo") ||
    normalizedTarget.includes("echo folder apps")
  ) {
    return ECHO_APPS_FOLDER_PATH;
  }

  if (targetWithoutFolderWord === "desktop" || targetWithoutFolderWord === "my desktop") {
    return DESKTOP_PATH;
  }

  if (targetWithoutFolderWord === "documents" || targetWithoutFolderWord === "documentos" || targetWithoutFolderWord === "my documents") {
    return DOCUMENTS_PATH;
  }

  if (targetWithoutFolderWord === "downloads" || targetWithoutFolderWord === "my downloads") {
    return DOWNLOADS_PATH;
  }

  if (targetWithoutFolderWord === "pictures" || targetWithoutFolderWord === "my pictures") {
    return PICTURES_PATH;
  }

  if (targetWithoutFolderWord === "videos" || targetWithoutFolderWord === "my videos") {
    return VIDEOS_PATH;
  }

  if (targetWithoutFolderWord === "music" || targetWithoutFolderWord === "my music") {
    return MUSIC_PATH;
  }

  if (targetWithoutFolderWord === "onedrive" || targetWithoutFolderWord === "my onedrive") {
    return ONEDRIVE_PATH;
  }

  if (targetWithoutFolderWord === "playground" || targetWithoutFolderWord === "my playground") {
    return PLAYGROUND_PATH;
  }

  if (targetWithoutFolderWord === "commandpilot" || targetWithoutFolderWord === "command pilot") {
    return COMMANDPILOT_PATH;
  }

  return null;
}

function basename(targetPath: string): string {
  const segments = targetPath.split("\\").filter(Boolean);
  return segments[segments.length - 1] ?? targetPath;
}

function normalizeApprovedRoots(approvedRoots: string[]): string[] {
  return [...new Set(approvedRoots.map((path) => path.trim().toLowerCase()).filter(Boolean))];
}

function isPathInsideApprovedRoots(targetPath: string, approvedRoots: string[]): boolean {
  const normalizedPath = targetPath.toLowerCase();
  return approvedRoots.some(
    (root) => normalizedPath === root || normalizedPath.startsWith(`${root}\\`)
  );
}

function getPathSafetyLevel(targetPath: string, approvedRoots: string[]): SafetyLevel {
  return isPathInsideApprovedRoots(targetPath, approvedRoots) ? "safe" : "confirm";
}

function extractWindowsPath(text: string): string | null {
  const match = text.match(/[a-zA-Z]:\\[^"<>|?*\r\n]+/);
  if (!match?.[0]) {
    return null;
  }

  return match[0]
    .trim()
    .replace(/\s+(folder|directory)$/i, "")
    .trim();
}

function resolveWebsiteTarget(
  rawTarget: string,
  trustedWebsiteHosts?: string[]
): { url: string; label: string; host: string } | null {
  return resolveTrustedWebsiteTarget(cleanQuotedText(rawTarget), trustedWebsiteHosts);
}

function isPotentialWebsiteTarget(rawTarget: string): boolean {
  return parseWebsiteTarget(cleanQuotedText(rawTarget)) !== null;
}

function extractWebsiteHost(rawTarget: string): string {
  return parseWebsiteTarget(cleanQuotedText(rawTarget))?.host ?? "that site";
}

function buildTrustedWebsitesHint(limit = 4, trustedWebsiteHosts?: string[]): string {
  if (trustedWebsiteHosts && trustedWebsiteHosts.length > 0) {
    return trustedWebsiteHosts.slice(0, limit).join(", ");
  }

  return trustedWebsiteLabels.slice(0, limit).join(", ");
}

function planWebsiteSafetyBlock(
  commandText: string,
  host: string,
  trustedWebsiteHosts?: string[]
): CommandPlan {
  const trustedHint = buildTrustedWebsitesHint(4, trustedWebsiteHosts);
  return planConversationalReply(
    commandText,
    "blocked_untrusted_website",
    `blocked untrusted website ${host}`,
    `I paused that because ${host} isn't in your trusted websites allowlist yet. I can open approved sites like ${trustedHint}.`,
    ["Open Chrome", "Open Gmail in Chrome"]
  );
}

function planLinkedAppNotApproved(commandText: string, appName: string): CommandPlan {
  return planConversationalReply(
    commandText,
    "blocked_unapproved_app",
    `blocked ${appName}`,
    `${appName} is not enabled in your approved app list yet. Add it in Settings, then I can launch it for you.`,
    ["Open Settings", "Show me approved apps"]
  );
}

export interface PlannerRuntimeOptions {
  approvedRoots?: string[];
  trustedWebsiteHosts?: string[];
  approvedLinkedAppKeys?: string[];
}

function getTypeTextSafetyLevel(typedText: string, pressEnter: boolean): SafetyLevel {
  if (!pressEnter) {
    return "safe";
  }

  return DANGEROUS_TYPED_COMMANDS.some((pattern) => pattern.test(typedText)) ? "confirm" : "safe";
}

function shouldTypeTextRequireApproval(typedText: string, pressEnter: boolean): boolean {
  return getTypeTextSafetyLevel(typedText, pressEnter) === "confirm";
}

function isLikelyLinkedAppLaunchCommand(normalizedText: string): boolean {
  return /^(open|launch|start|bring up)\b/i.test(normalizedText.trim());
}

function isLikelyLinkedAppStatusCommand(normalizedText: string): boolean {
  return (
    /^is\b/i.test(normalizedText) ||
    /^check\b/i.test(normalizedText) ||
    /^what'?s\b/i.test(normalizedText) ||
    normalizedText.includes(" status") ||
    normalizedText.includes(" running") ||
    normalizedText.includes(" online")
  );
}

function shouldClarifyLinkedAppChoice(candidates: LinkedAppTextCandidate[]): boolean {
  if (candidates.length < 2) {
    return false;
  }

  const [best, runnerUp] = candidates;
  return best.score - runnerUp.score <= 0.12;
}

function joinAppNamesForSpeech(appNames: string[]): string {
  if (appNames.length <= 1) {
    return appNames[0] ?? "";
  }

  if (appNames.length === 2) {
    return `${appNames[0]} or ${appNames[1]}`;
  }

  return `${appNames.slice(0, -1).join(", ")}, or ${appNames[appNames.length - 1]}`;
}

function planLinkedAppClarification(
  text: string,
  mode: "open" | "status",
  candidates: LinkedAppTextCandidate[]
): CommandPlan {
  const topCandidates = candidates.slice(0, 3);
  const appNames = topCandidates.map((candidate) => candidate.app.name);
  const lead = appNames[0] ?? "that app";
  const optionsText = joinAppNamesForSpeech(appNames);
  const reply =
    mode === "status"
      ? `I found a couple close matches: ${optionsText}. Say "Is ${lead} running" and I'll check right away.`
      : `I found a couple close matches: ${optionsText}. Say "Open ${lead}" and I'll launch it right away.`;

  return planConversationalReply(
    text,
    mode === "status" ? "clarify_linked_app_status" : "clarify_linked_app_open",
    "asked which linked app you meant",
    reply,
    appNames.slice(0, 2).map((name) => (mode === "status" ? `Is ${name} running` : `Open ${name}`))
  );
}

function planConversationalReply(
  text: string,
  intent: string,
  summary: string,
  reply: string,
  suggestedFollowUps: string[]
): CommandPlan {
  return {
    id: createId("cmd"),
    text,
    normalizedText: normalizeCommand(text),
    intent,
    summary,
    executionTarget: "orchestrator",
    safetyLevel: "safe",
    status: "planning",
    selectedSkills: [],
    steps: [],
    echo: {
      thinking: reply,
      success: reply,
      approvalRequired: reply,
      blocked: reply,
      failed: reply
    },
    suggestedFollowUps
  };
}

function matchConversationalReply(normalized: string): {
  intent: string;
  summary: string;
  reply: string;
  suggestedFollowUps: string[];
} | null {
  if (/^(thanks|thank you|thank you echo|thanks echo)( so much)?[.! ]*$/i.test(normalized)) {
    return {
      intent: "conversational_thanks",
      summary: "responded to your thanks",
      reply: "You're welcome, Angel.",
      suggestedFollowUps: ["Open my work setup", "Open Chrome"]
    };
  }

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)[.! ]*$/i.test(normalized)) {
    const greetingReply =
      normalized.startsWith("good morning")
        ? "Good morning, Angel. I'm ready when you are."
        : normalized.startsWith("good afternoon")
          ? "Good afternoon, Angel. What would you like me to handle?"
          : normalized.startsWith("good evening")
            ? "Good evening, Angel. I'm here and ready."
            : "Hello, Angel. I'm here and ready.";

    return {
      intent: "conversational_greeting",
      summary: "responded to your greeting",
      reply: greetingReply,
      suggestedFollowUps: ["Open my work setup", "Show me today's priorities"]
    };
  }

  if (/^(how are you|how are you doing)[?!. ]*$/.test(normalized)) {
    return {
      intent: "conversational_status",
      summary: "answered your check-in",
      reply: "I'm fully online and ready to help, Angel.",
      suggestedFollowUps: ["Open Chrome", "Open the Echo Test Folder on my Desktop"]
    };
  }

  if (/^(what can you do|help|what do you do|what can you help with)[?!. ]*$/.test(normalized)) {
    return {
      intent: "conversational_help",
      summary: "explained what Echo can do",
      reply:
        "I can open your apps and folders, launch Chrome, search the web, and keep your workspace moving.",
      suggestedFollowUps: ["Open Clientflow", "Open Downloads"]
    };
  }

  if (/^(who are you|introduce yourself)[?!. ]*$/.test(normalized)) {
    return {
      intent: "conversational_identity",
      summary: "introduced Echo",
      reply: "I'm Echo, your personal CommandPilot assistant.",
      suggestedFollowUps: ["Open my work setup", "Open Chrome"]
    };
  }

  if (/^(bye|goodbye|see you|talk later)[.! ]*$/.test(normalized)) {
    return {
      intent: "conversational_goodbye",
      summary: "wrapped the conversation",
      reply: "Anytime, Angel. I'll be here when you need me.",
      suggestedFollowUps: ["Open my work setup", "Show me today's priorities"]
    };
  }

  return null;
}

function normalizeTypedContent(rawContent: string): string {
  return cleanQuotedText(rawContent)
    .replace(/\s+new line\s+/gi, "\n")
    .replace(/\s+newline\s+/gi, "\n")
    .replace(/\s+new paragraph\s+/gi, "\n\n")
    .trim();
}

function inferSafetyLevel(steps: PlannedCommandStep[]): SafetyLevel {
  if (steps.some((step) => step.safetyLevel === "restricted")) {
    return "restricted";
  }

  if (steps.some((step) => step.safetyLevel === "confirm")) {
    return "confirm";
  }

  if (steps.some((step) => step.safetyLevel === "notice")) {
    return "notice";
  }

  return "safe";
}

function createPlanStep(template: WorkflowStepTemplate, index: number): PlannedCommandStep {
  return {
    id: `${template.id}-${index + 1}`,
    title: template.title,
    description: template.description,
    skillKey: template.skillKey,
    status: "pending",
    target: template.target,
    safetyLevel: template.safetyLevel,
    approvalRequired: template.approvalRequired,
    parameters: template.parameters
  };
}

function planFromWorkflow(
  text: string,
  intent: string,
  summary: string,
  workflow: WorkflowDefinition,
  suggestedFollowUps: string[]
): CommandPlan {
  const steps = workflow.steps.map(createPlanStep);
  const safetyLevel = inferSafetyLevel(steps);

  return {
    id: createId("cmd"),
    text,
    normalizedText: normalizeCommand(text),
    intent,
    summary,
    executionTarget: workflow.steps.some((step) => step.target === "android") ? "either" : "pc",
    safetyLevel,
    status: "planning",
    selectedSkills: [...new Set(workflow.steps.map((step) => step.skillKey))],
    steps,
    matchedWorkflowId: workflow.id,
    echo: {
      thinking: `Working on ${workflow.name.toLowerCase()}.`,
      success: `Done. I've ${summary.toLowerCase()}.`,
      approvalRequired: "That action needs approval before I continue.",
      blocked: "That workflow is blocked by your current safety settings.",
      failed: "I couldn't finish that workflow automatically, but I paused at the exact handoff."
    },
    suggestedFollowUps
  };
}

function planFromSteps(
  text: string,
  intent: string,
  summary: string,
  steps: WorkflowStepTemplate[],
  suggestedFollowUps: string[],
  target: CommandPlan["executionTarget"] = "pc"
): CommandPlan {
  const plannedSteps = steps.map(createPlanStep);
  const safetyLevel = inferSafetyLevel(plannedSteps);

  return {
    id: createId("cmd"),
    text,
    normalizedText: normalizeCommand(text),
    intent,
    summary,
    executionTarget: target,
    safetyLevel,
    status: "planning",
    selectedSkills: [...new Set(plannedSteps.map((step) => step.skillKey))],
    steps: plannedSteps,
    echo: {
      thinking: "I'm mapping the cleanest route for that task.",
      success: `Done. I've ${summary.toLowerCase()}.`,
      approvalRequired: "That action needs approval before I continue.",
      blocked: "That action is restricted in your current safety settings.",
      failed: "I couldn't complete that step automatically, but I've paused exactly where you need to continue."
    },
    suggestedFollowUps
  };
}

export function planCommand(commandText: string, options: PlannerRuntimeOptions = {}): CommandPlan {
  const normalized = normalizeCommand(commandText);
  const explicitPath = extractWindowsPath(commandText);
  const conversationalMatch = matchConversationalReply(normalized);
  const effectiveApprovedRoots = normalizeApprovedRoots(
    options.approvedRoots && options.approvedRoots.length > 0 ? options.approvedRoots : APPROVED_ROOTS
  );
  const trustedWebsiteHosts = normalizeTrustedWebsiteHosts(
    options.trustedWebsiteHosts && options.trustedWebsiteHosts.length > 0
      ? options.trustedWebsiteHosts
      : []
  );
  const approvedLinkedAppKeys = new Set(
    options.approvedLinkedAppKeys && options.approvedLinkedAppKeys.length > 0
      ? options.approvedLinkedAppKeys
      : []
  );
  const hasAppAllowlist = approvedLinkedAppKeys.size > 0;
  const isAppApproved = (appKey: string) => !hasAppAllowlist || approvedLinkedAppKeys.has(appKey);

  if (conversationalMatch) {
    return planConversationalReply(
      commandText,
      conversationalMatch.intent,
      conversationalMatch.summary,
      conversationalMatch.reply,
      conversationalMatch.suggestedFollowUps
    );
  }

  if (/^(open|launch|start)\s+(google\s+)?chrome$/i.test(normalized)) {
    return planFromSteps(
      commandText,
      "open_chrome",
      "opened Chrome",
      [
        {
          id: "open-chrome-1",
          title: "Open Chrome",
          description: "Launch Chrome with a fresh browser window.",
          skillKey: "open_website",
          target: "pc",
          safetyLevel: "safe",
          approvalRequired: false,
          parameters: {
            url: "about:blank",
            preferredBrowser: "chrome",
            successMessage: "Done. I've opened Chrome."
          }
        }
      ],
      ["Search Chrome for CommandPilot roadmap", "Open clientflow.com in Chrome"]
    );
  }

  const createAndTypeMatch =
    commandText.match(
      /^(?:hey\s+)?echo(?:\s+|,\s*)?create (?:a )?(?<kind>text file|text document|note|word file|word document|word doc|rich text file|document)(?: called| named)? (?<name>.+?)(?: (?:in|inside) (?<target>.+?))? and type (?<content>.+)$/i
    ) ??
    commandText.match(
      /^(?:hey\s+)?echo(?:\s+|,\s*)?(?:create|make) (?<content>.+?) in (?:a )?(?<kind>text file|text document|note|word file|word document|word doc|rich text file|document) (?:called|named) (?<name>.+?)(?: (?:in|inside) (?<target>.+))?$/i
    );

  if (createAndTypeMatch?.groups?.kind && createAndTypeMatch.groups.name && createAndTypeMatch.groups.content) {
    const targetFolder = resolveDocumentTargetFolder(createAndTypeMatch.groups.target);

    if (targetFolder) {
      const rawFileName = sanitizeFileName(cleanQuotedText(createAndTypeMatch.groups.name));
      const wantsWordFile = /word|rich text/i.test(createAndTypeMatch.groups.kind);
      const fileName = wantsWordFile
        ? ensureWordFileExtension(rawFileName)
        : ensureTextFileExtension(rawFileName);
      const typedContent = normalizeTypedContent(createAndTypeMatch.groups.content);
      const targetPath = `${targetFolder}\\${fileName}`;

      return planFromSteps(
        commandText,
        wantsWordFile ? "create_word_file_with_content" : "create_text_file_with_content",
        `created ${fileName} and added your text`,
        [
          {
            id: "create-dictated-file-1",
            title: wantsWordFile ? "Create Word-compatible file" : "Create text file",
            description: `Create ${fileName} and add the dictated text.`,
            skillKey: "create_text_file",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: {
              path: targetPath,
              content: typedContent
            }
          },
          {
            id: "create-dictated-file-2",
            title: "Open created file",
            description: `Open ${fileName} after it is created.`,
            skillKey: "open_file",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: {
              path: targetPath,
              successMessage: `Done. I created ${fileName} and added your text.`
            }
          }
        ],
        ["Show me the contents of the Echo Test Folder", `Open the file ${fileName} in the Echo Test Folder`]
      );
    }
  }

  const createDocumentMatch = commandText.match(
    /^(?:hey\s+)?echo(?:\s+|,\s*)?create (?:a )?(?<kind>text file|text document|note|word file|word document|word doc|rich text file|document)(?: called| named)? (?<name>.+?)(?: (?:in|inside) (?<target>.+))?$/i
  );
  if (createDocumentMatch?.groups?.kind && createDocumentMatch.groups.name) {
    const targetFolder = resolveDocumentTargetFolder(createDocumentMatch.groups.target);

    if (targetFolder) {
      const rawFileName = sanitizeFileName(cleanQuotedText(createDocumentMatch.groups.name));
      const wantsWordFile = /word|rich text/i.test(createDocumentMatch.groups.kind);
      const fileName = wantsWordFile
        ? ensureWordFileExtension(rawFileName)
        : ensureTextFileExtension(rawFileName);
      const targetPath = `${targetFolder}\\${fileName}`;

      return planFromSteps(
        commandText,
        wantsWordFile ? "create_word_file" : "create_text_file_named",
        `created ${fileName}`,
        [
          {
            id: "create-file-basic-1",
            title: wantsWordFile ? "Create Word-compatible file" : "Create text file",
            description: `Create ${fileName}.`,
            skillKey: "create_text_file",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: {
              path: targetPath,
              content: wantsWordFile ? "" : "Echo created this file."
            }
          },
          {
            id: "create-file-basic-2",
            title: "Open created file",
            description: `Open ${fileName} after it is created.`,
            skillKey: "open_file",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: {
              path: targetPath,
              successMessage: `Done. I created ${fileName}.`
            }
          }
        ],
        ["Type into the active window", `Open the file ${fileName} in the Echo Test Folder`]
      );
    }
  }

  const typeTextMatch = commandText.match(
    /^(?:hey\s+)?echo(?:\s+|,\s*)?(?<force>force\s+)?(?:type|dictate|write)(?: into (?<target>chrome|active window|current window))? (?<content>.+?)(?<pressEnter>\s+(?:and|then)\s+press enter)?$/i
  );
  if (typeTextMatch?.groups?.content) {
    const typedContent = normalizeTypedContent(typeTextMatch.groups.content);
    const shouldPressEnter = Boolean(typeTextMatch.groups.pressEnter);
    const shouldForceType = Boolean(typeTextMatch.groups.force);
    const target = typeTextMatch.groups.target?.trim().toLowerCase() ?? "active window";

    if (typedContent.length > MAX_TYPE_TEXT_LENGTH) {
      return planConversationalReply(
        commandText,
        "typing_text_too_long",
        "blocked oversized typing payload",
        `That text is too long for direct typing in one pass. Keep it under ${MAX_TYPE_TEXT_LENGTH} characters or ask me to create a file instead.`,
        ["Create a text file called long-note in the Echo Test Folder", "Type hello world"]
      );
    }

    const typeSafetyLevel = getTypeTextSafetyLevel(typedContent, shouldPressEnter);
    const needsApproval = shouldTypeTextRequireApproval(typedContent, shouldPressEnter) && !shouldForceType;
    const typingStep: WorkflowStepTemplate = {
      id: "type-text-1",
      title: "Type into active window",
      description: shouldPressEnter
        ? "Paste the dictated text into the active window and press Enter."
        : "Paste the dictated text into the active window.",
      skillKey: "type_text",
      target: "pc",
      safetyLevel: needsApproval ? "confirm" : typeSafetyLevel,
      approvalRequired: needsApproval,
      parameters: {
        text: typedContent,
        pressEnter: shouldPressEnter ? "true" : "false",
        allowCommandExecution: shouldForceType ? "true" : "false",
        successMessage: shouldPressEnter
          ? "Done. I typed that and pressed Enter."
          : "Done. I typed that into the active window."
      }
    };

    if (target === "chrome") {
      return planFromSteps(
        commandText,
        "type_text_in_chrome",
        shouldPressEnter ? "opened Chrome, typed your text, and pressed Enter" : "opened Chrome and typed your text",
        [
          {
            id: "type-text-chrome-0",
            title: "Open Chrome",
            description: "Bring Chrome to the foreground before typing.",
            skillKey: "open_website",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: {
              url: "about:blank",
              preferredBrowser: "chrome"
            }
          },
          typingStep
        ],
        ["Search Chrome for CommandPilot roadmap", "Open Gmail in Chrome"]
      );
    }

    return planFromSteps(
      commandText,
      "type_text",
      shouldPressEnter ? "typed your text and pressed Enter" : "typed your text",
      [typingStep],
      ["Create a text file called quick-note and type hello world", "Open Chrome"]
    );
  }

  const chromeTaskMatch = matchChromeTaskCommand(commandText);
  if (chromeTaskMatch) {
    if (chromeTaskMatch.task.queryRequired && !chromeTaskMatch.query) {
      return planConversationalReply(
        commandText,
        "chrome_task_missing_query",
        `missing query for ${chromeTaskMatch.task.name.toLowerCase()}`,
        `Tell me what to search for and I'll run ${chromeTaskMatch.task.name} in Chrome.`,
        ["Search Chrome for commandpilot roadmap", "Open Gmail in Chrome"]
      );
    }

    const websiteTarget = resolveWebsiteTarget(chromeTaskMatch.url, trustedWebsiteHosts);
    if (!websiteTarget) {
      return planWebsiteSafetyBlock(commandText, chromeTaskMatch.task.host, trustedWebsiteHosts);
    }

    return planFromSteps(
      commandText,
      `run_chrome_task_${chromeTaskMatch.task.key}`,
      chromeTaskMatch.query
        ? `opened ${chromeTaskMatch.task.name} for ${chromeTaskMatch.query} in Chrome`
        : `opened ${chromeTaskMatch.task.name} in Chrome`,
      [
        {
          id: "chrome-task-1",
          title: "Run Chrome task",
          description: chromeTaskMatch.task.description,
          skillKey: "open_website",
          target: "pc",
          safetyLevel: "safe",
          approvalRequired: false,
          parameters: {
            url: websiteTarget.url,
            preferredBrowser: "chrome",
            successMessage: chromeTaskMatch.query
              ? `Done. I've opened ${chromeTaskMatch.task.name} for ${chromeTaskMatch.query} in Chrome.`
              : `Done. I've opened ${chromeTaskMatch.task.name} in Chrome.`
          }
        }
      ],
      chromeTaskMatch.task.followUps
    );
  }

  const chromeSearchMatch =
    commandText.match(/^(?:echo,\s*)?search (?<query>.+?) in (?:google\s+)?chrome$/i) ??
    commandText.match(/^(?:echo,\s*)?search (?:chrome|google chrome) for (?<query>.+)$/i) ??
    commandText.match(/^(?:echo,\s*)?(?:in )?(?:google\s+)?chrome(?:,)?\s*search(?: for)? (?<query>.+)$/i);

  if (chromeSearchMatch?.groups?.query) {
    const searchQuery = cleanQuotedText(chromeSearchMatch.groups.query);
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    return planFromSteps(
      commandText,
      "search_chrome",
      `searched Chrome for ${searchQuery}`,
      [
        {
          id: "search-chrome-1",
          title: "Search in Chrome",
          description: `Open Chrome and search for ${searchQuery}.`,
          skillKey: "open_website",
          target: "pc",
          safetyLevel: "safe",
          approvalRequired: false,
          parameters: {
            url: searchUrl,
            preferredBrowser: "chrome",
            successMessage: `Done. I've searched Chrome for ${searchQuery}.`
          }
        }
      ],
      ["Open Chrome", "Open google.com in Chrome"]
    );
  }

  const googleSearchMatch =
    commandText.match(/^(?:echo,\s*)?search (?:google\s+)?for (?<query>.+)$/i) ??
    commandText.match(/^(?:echo,\s*)?(?:google(?:\s+search)?|search google)\s+(?<query>.+)$/i) ??
    commandText.match(/^(?:can|could|would|will)\s+(?:you|u)\s+search (?:google\s+)?for (?<query>.+)$/i) ??
    commandText.match(/^please\s+search (?:google\s+)?for (?<query>.+)$/i);

  if (googleSearchMatch?.groups?.query) {
    const searchQuery = cleanQuotedText(googleSearchMatch.groups.query);
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    return planFromSteps(
      commandText,
      "search_google",
      `searched Google for ${searchQuery}`,
      [
        {
          id: "search-google-1",
          title: "Search Google",
          description: `Search Google for ${searchQuery}.`,
          skillKey: "open_website",
          target: "pc",
          safetyLevel: "safe",
          approvalRequired: false,
          parameters: {
            url: searchUrl,
            successMessage: `Done. I've searched Google for ${searchQuery}.`
          }
        }
      ],
      ["Open Chrome", "Search Chrome for CommandPilot roadmap"]
    );
  }

  const openInChromeMatch = commandText.match(
    /^(?:echo,\s*)?(?:open|launch|start) (?<target>.+?) in (?:google\s+)?chrome$/i
  ) ??
  commandText.match(
    /^(?:echo,\s*)?(?:in )?(?:google\s+)?chrome(?:,)?\s*(?:open|go to|navigate to) (?<target>.+)$/i
  );
  if (openInChromeMatch?.groups?.target) {
    const websiteTarget = resolveWebsiteTarget(openInChromeMatch.groups.target, trustedWebsiteHosts);

    if (websiteTarget) {
      return planFromSteps(
        commandText,
        "open_chrome_website",
        `opened ${websiteTarget.label} in Chrome`,
        [
          {
            id: "open-chrome-site-1",
            title: "Open website in Chrome",
            description: `Open ${websiteTarget.label} in Chrome.`,
            skillKey: "open_website",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: {
              url: websiteTarget.url,
              preferredBrowser: "chrome",
              successMessage: `Done. I've opened ${websiteTarget.label} in Chrome.`
            }
          }
        ],
        ["Search Chrome for CommandPilot", "Open Chrome"]
      );
    }

    if (isPotentialWebsiteTarget(openInChromeMatch.groups.target)) {
      return planWebsiteSafetyBlock(
        commandText,
        extractWebsiteHost(openInChromeMatch.groups.target),
        trustedWebsiteHosts
      );
    }
  }

  if (normalized.includes("show me the contents of") || normalized.includes("list the contents of") || normalized.includes("what's in") || normalized.includes("what is in")) {
    const targetText =
      normalized.split("contents of")[1] ??
      normalized.split("what's in")[1] ??
      normalized.split("what is in")[1];
    const targetPath = targetText ? resolveKnownFolder(targetText) : null;

    if (targetPath) {
      return planFromSteps(
        commandText,
        "list_folder_contents",
        `checked the contents of ${basename(targetPath)}`,
        [
          {
            id: "list-folder-1",
            title: "List folder contents",
            description: `Inspect the items inside ${basename(targetPath)}.`,
            skillKey: "list_folder_contents",
            target: "pc",
            safetyLevel: "notice",
            approvalRequired: false,
            parameters: {
              path: targetPath
            }
          }
        ],
        ["Open the Echo Test Folder on my Desktop", "Create a folder called Notes Archive in the Echo Test Folder"]
      );
    }
  }

  const createFolderByPathMatch = commandText.match(
    /create (?:a )?folder (?:at|in) (?<path>[a-zA-Z]:\\[^"<>|?*\r\n]+)$/i
  );
  if (createFolderByPathMatch?.groups?.path) {
    const targetPath = createFolderByPathMatch.groups.path.trim();
    const safetyLevel = getPathSafetyLevel(targetPath, effectiveApprovedRoots);
    return planFromSteps(
      commandText,
      "create_folder_by_path",
      `created ${basename(targetPath)}`,
      [
        {
          id: "create-folder-path-1",
          title: "Create folder by path",
          description: `Create folder at ${targetPath}.`,
          skillKey: "create_folder",
          target: "pc",
          safetyLevel,
          approvalRequired: safetyLevel === "confirm",
          parameters: {
            path: targetPath
          }
        }
      ],
      ["Open the folder you just created", "Show me the contents of the Echo Test Folder"]
    );
  }

  const createFileByPathMatch = commandText.match(
    /create (?:a )?(?:note|text file|file|document) (?:at|in) (?<path>[a-zA-Z]:\\[^"<>|?*\r\n]+)$/i
  );
  if (createFileByPathMatch?.groups?.path) {
    const rawPath = createFileByPathMatch.groups.path.trim();
    const targetPath = /\.[a-z0-9]{1,8}$/i.test(rawPath) ? rawPath : `${rawPath}.txt`;
    const safetyLevel = getPathSafetyLevel(targetPath, effectiveApprovedRoots);
    return planFromSteps(
      commandText,
      "create_text_file_by_path",
      `created ${basename(targetPath)}`,
      [
        {
          id: "create-file-path-1",
          title: "Create file by path",
          description: `Create text file at ${targetPath}.`,
          skillKey: "create_text_file",
          target: "pc",
          safetyLevel,
          approvalRequired: safetyLevel === "confirm",
          parameters: {
            path: targetPath,
            content: `Echo created ${basename(targetPath)}.`
          }
        }
      ],
      ["Open the file you just created", "Type into active window"]
    );
  }

  const createFolderMatch = commandText.match(
    /create (?:a )?folder (?:called |named )?(?<name>.+?) (?:in|inside) (?<target>.+)$/i
  );
  if (createFolderMatch?.groups?.name && createFolderMatch.groups.target) {
    const parentPath = resolveKnownFolder(createFolderMatch.groups.target);
    if (parentPath) {
      const folderName = cleanQuotedText(createFolderMatch.groups.name);
      return planFromSteps(
        commandText,
        "create_folder",
        `created ${folderName}`,
        [
          {
            id: "create-folder-1",
            title: "Create folder",
            description: `Create ${folderName} inside ${basename(parentPath)}.`,
            skillKey: "create_folder",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: {
              path: `${parentPath}\\${folderName}`
            }
          }
        ],
        ["Show me the contents of the Echo Test Folder", `Open the folder ${folderName} in the Echo Test Folder`]
      );
    }
  }

  const createFileMatch = commandText.match(
    /create (?:a )?(?:note|text file|file) (?:called |named )?(?<name>.+?) (?:in|inside) (?<target>.+)$/i
  );
  if (createFileMatch?.groups?.name && createFileMatch.groups.target) {
    const parentPath = resolveKnownFolder(createFileMatch.groups.target);
    if (parentPath) {
      const requestedName = cleanQuotedText(createFileMatch.groups.name);
      const fileName = ensureTextFileExtension(requestedName);
      const defaultContent = `Echo created ${fileName} on ${new Date().toLocaleDateString("en-US")}.`;

      return planFromSteps(
        commandText,
        "create_text_file",
        `created ${fileName}`,
        [
          {
            id: "create-file-1",
            title: "Create text file",
            description: `Create ${fileName} inside ${basename(parentPath)}.`,
            skillKey: "create_text_file",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: {
              path: `${parentPath}\\${fileName}`,
              content: defaultContent
            }
          }
        ],
        ["Show me the contents of the Echo Test Folder", `Open the file ${fileName} in the Echo Test Folder`]
      );
    }
  }

  const openFileInFolderMatch = commandText.match(
    /open (?:the )?(?:file|note|document) (?<name>.+?) (?:in|inside) (?<target>.+)$/i
  );
  if (openFileInFolderMatch?.groups?.name && openFileInFolderMatch.groups.target) {
    const parentPath = resolveKnownFolder(openFileInFolderMatch.groups.target);
    if (parentPath) {
      const fileName = ensureTextFileExtension(cleanQuotedText(openFileInFolderMatch.groups.name));
      return planFromSteps(
        commandText,
        "open_file_in_folder",
        `opened ${fileName}`,
        [
          {
            id: "open-file-1",
            title: "Open file",
            description: `Open ${fileName} from ${basename(parentPath)}.`,
            skillKey: "open_file",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: {
              path: `${parentPath}\\${fileName}`
            }
          }
        ],
        ["Show me the contents of the Echo Test Folder", "Open the Echo Test Folder on my Desktop"]
      );
    }
  }

  const openFolderInFolderMatch = commandText.match(
    /open (?:the )?(?:folder|subfolder) (?<name>.+?) (?:in|inside) (?<target>.+)$/i
  );
  if (openFolderInFolderMatch?.groups?.name && openFolderInFolderMatch.groups.target) {
    const parentPath = resolveKnownFolder(openFolderInFolderMatch.groups.target);
    if (parentPath) {
      const folderName = cleanQuotedText(openFolderInFolderMatch.groups.name);
      return planFromSteps(
        commandText,
        "open_folder_in_folder",
        `opened ${folderName}`,
        [
          {
            id: "open-subfolder-1",
            title: "Open folder",
            description: `Open ${folderName} from ${basename(parentPath)}.`,
            skillKey: "open_folder",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: {
              path: `${parentPath}\\${folderName}`
            }
          }
        ],
        ["Show me the contents of the Echo Test Folder", "Create a note called quick-test in the Echo Test Folder"]
      );
    }
  }

  const linkedAppRouteMatch = findLinkedAppRouteMatch(normalized);
  if (linkedAppRouteMatch) {
    if (!isAppApproved(linkedAppRouteMatch.app.key)) {
      return planLinkedAppNotApproved(commandText, linkedAppRouteMatch.app.name);
    }

    return planFromSteps(
      commandText,
      "open_linked_app_route",
      `opened ${linkedAppRouteMatch.app.name} ${linkedAppRouteMatch.route.name}`,
      [
        {
          id: "open-linked-app-route-1",
          title: "Open linked app route",
          description: `Open ${linkedAppRouteMatch.route.name} in ${linkedAppRouteMatch.app.name}.`,
          skillKey: "open_app",
          target: "pc",
          safetyLevel: "safe",
          approvalRequired: false,
          parameters: {
            appName: linkedAppRouteMatch.app.name,
            appKey: linkedAppRouteMatch.app.key,
            routePath: linkedAppRouteMatch.route.path,
            routeName: linkedAppRouteMatch.route.name
          }
        }
      ],
      [`Open ${linkedAppRouteMatch.app.name}`, `Is ${linkedAppRouteMatch.app.name} running`]
    );
  }

  const echoFolderAppMatch =
    isLikelyLinkedAppLaunchCommand(normalized) &&
    /(echo test folder|echo folder|echo apps)/i.test(normalized)
      ? findLinkedAppByText(normalized)
      : null;

  if (echoFolderAppMatch) {
    if (!isAppApproved(echoFolderAppMatch.key)) {
      return planLinkedAppNotApproved(commandText, echoFolderAppMatch.name);
    }

    return planFromSteps(
      commandText,
      "open_echo_folder_app_shortcut",
      `opened ${echoFolderAppMatch.name} from your Echo folder`,
      [
        {
          id: "open-echo-app-shortcut-1",
          title: "Launch Echo folder app",
          description: `Launch ${echoFolderAppMatch.name} from your Echo Apps folder.`,
          skillKey: "open_app",
          target: "pc",
          safetyLevel: "safe",
          approvalRequired: false,
          parameters: {
            appName: echoFolderAppMatch.name,
            appKey: echoFolderAppMatch.key
          }
        }
      ],
      ["Show me the contents of the Echo apps folder", `Open ${echoFolderAppMatch.name}`]
    );
  }

  const statusCandidates = isLikelyLinkedAppStatusCommand(normalized)
    ? findLinkedAppCandidatesByText(normalized, 0.5, 3).filter((candidate) =>
        isAppApproved(candidate.app.key)
      )
    : [];
  const statusDirectMatch = findLinkedAppStatusMatch(normalized);
  const linkedAppStatusMatch =
    (statusDirectMatch && isAppApproved(statusDirectMatch.key) ? statusDirectMatch : null) ??
    (statusCandidates[0]?.score >= 0.62 ? statusCandidates[0].app : null);

  if (statusDirectMatch && !isAppApproved(statusDirectMatch.key)) {
    return planLinkedAppNotApproved(commandText, statusDirectMatch.name);
  }

  if (!linkedAppStatusMatch && shouldClarifyLinkedAppChoice(statusCandidates)) {
    return planLinkedAppClarification(commandText, "status", statusCandidates);
  }

  if (linkedAppStatusMatch) {
    return planFromSteps(
      commandText,
      "check_linked_app_status",
      `checked ${linkedAppStatusMatch.name} status`,
      [
        {
          id: "check-app-status-1",
          title: "Check linked app status",
          description: `See whether ${linkedAppStatusMatch.name} is already running.`,
          skillKey: "check_app_status",
          target: "pc",
          safetyLevel: "notice",
          approvalRequired: false,
          parameters: {
            appName: linkedAppStatusMatch.name,
            appKey: linkedAppStatusMatch.key
          }
        }
      ],
      [`Open ${linkedAppStatusMatch.name}`, "Open the Echo Test Folder on my Desktop"]
    );
  }

  const launchCandidates = isLikelyLinkedAppLaunchCommand(normalized)
    ? findLinkedAppCandidatesByText(normalized, 0.5, 3).filter((candidate) =>
        isAppApproved(candidate.app.key)
      )
    : [];
  const launchDirectMatch = findLinkedAppLaunchMatch(normalized);
  const linkedAppLaunchMatch =
    (launchDirectMatch && isAppApproved(launchDirectMatch.key) ? launchDirectMatch : null) ??
    (launchCandidates[0]?.score >= 0.62 ? launchCandidates[0].app : null);

  if (launchDirectMatch && !isAppApproved(launchDirectMatch.key)) {
    return planLinkedAppNotApproved(commandText, launchDirectMatch.name);
  }

  if (!linkedAppLaunchMatch && shouldClarifyLinkedAppChoice(launchCandidates)) {
    return planLinkedAppClarification(commandText, "open", launchCandidates);
  }

  if (linkedAppLaunchMatch) {
    return planFromSteps(
      commandText,
      "open_linked_app",
      `opened ${linkedAppLaunchMatch.name}`,
      [
        {
          id: "open-linked-app-1",
          title: "Launch linked app",
          description: `Open ${linkedAppLaunchMatch.name} and bring it forward.`,
          skillKey: "open_app",
          target: "pc",
          safetyLevel: "safe",
          approvalRequired: false,
          parameters: {
            appName: linkedAppLaunchMatch.name,
            appKey: linkedAppLaunchMatch.key
          }
        }
      ],
      [`Is ${linkedAppLaunchMatch.name} running`, "Open the Echo Test Folder on my Desktop"]
    );
  }

  const genericWebsiteOpenMatch = commandText.match(
    /^(?:echo,\s*)?(?:open|launch|start) (?<target>.+)$/i
  );
  if (genericWebsiteOpenMatch?.groups?.target) {
    const websiteTarget = resolveWebsiteTarget(genericWebsiteOpenMatch.groups.target, trustedWebsiteHosts);

    if (websiteTarget) {
      return planFromSteps(
        commandText,
        "open_website",
        `opened ${websiteTarget.label}`,
        [
          {
            id: "open-website-1",
            title: "Open website",
            description: `Open ${websiteTarget.label} in the browser.`,
            skillKey: "open_website",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: {
              url: websiteTarget.url,
              successMessage: `Done. I've opened ${websiteTarget.label}.`
            }
          }
        ],
        ["Open Chrome", "Search Chrome for CommandPilot roadmap"]
      );
    }

    if (isPotentialWebsiteTarget(genericWebsiteOpenMatch.groups.target)) {
      return planWebsiteSafetyBlock(
        commandText,
        extractWebsiteHost(genericWebsiteOpenMatch.groups.target),
        trustedWebsiteHosts
      );
    }
  }

  if (explicitPath && normalized.startsWith("open ")) {
    const skillKey = /\.[a-z0-9]{1,8}$/i.test(explicitPath) ? "open_file" : "open_folder";
    const itemLabel = basename(explicitPath);
    const safetyLevel = getPathSafetyLevel(explicitPath, effectiveApprovedRoots);
    return planFromSteps(
      commandText,
      "open_explicit_path",
      `opened ${itemLabel}`,
      [
        {
          id: "open-explicit-path-1",
          title: skillKey === "open_file" ? "Open file path" : "Open folder path",
          description: `Open ${explicitPath}.`,
          skillKey,
          target: "pc",
          safetyLevel,
          approvalRequired: safetyLevel === "confirm",
          parameters: {
            path: explicitPath
          }
        }
      ],
      ["Show me the contents of the Echo Test Folder", "Open the Echo Test Folder on my Desktop"]
    );
  }

  if (normalized.startsWith("open ")) {
    const aliasTarget = resolveKnownFolder(normalized.replace(/^open\s+/, ""));
    if (aliasTarget) {
      const safetyLevel = getPathSafetyLevel(aliasTarget, effectiveApprovedRoots);
      return planFromSteps(
        commandText,
        "open_known_folder",
        `opened ${basename(aliasTarget)}`,
        [
          {
            id: "open-known-folder-1",
            title: "Open known folder",
            description: `Open ${basename(aliasTarget)}.`,
            skillKey: "open_folder",
            target: "pc",
            safetyLevel,
            approvalRequired: safetyLevel === "confirm",
            parameters: {
              path: aliasTarget
            }
          }
        ],
        ["Show me the contents of the Echo Test Folder", "Open the Echo Test Folder on my Desktop"]
      );
    }
  }

  if (normalized.includes("echo test folder") && normalized.includes("desktop")) {
    return planFromSteps(
      commandText,
      "open_echo_test_folder",
      "opened your Echo Test Folder",
      [
        {
          id: "echo-test-folder-1",
          title: "Open Echo Test Folder",
          description: "Open the personal Desktop test folder for Echo.",
          skillKey: "open_folder",
          target: "pc",
          safetyLevel: "safe",
          approvalRequired: false,
          parameters: {
            path: "C:\\Users\\angel\\OneDrive\\Desktop\\Echo Test Folder"
          }
        }
      ],
      ["Open my work setup", "Show me today's priorities"]
    );
  }

  if (normalized.includes("open my work setup")) {
    return planFromWorkflow(
      commandText,
      "open_work_setup",
      "opened your work setup",
      workflowCatalog.find((workflow) => workflow.id === "work-setup")!,
      ["Show me today's priorities", "Open my inbox next"]
    );
  }

  if (normalized.includes("show me today's priorities") || normalized.includes("show me todays priorities")) {
    return planFromSteps(
      commandText,
      "show_priorities",
      "pulled today's priorities and sent the summary to your phone",
      [
        {
          id: "priorities-1",
          title: "Read priorities file",
          description: "Open the configured priorities source.",
          skillKey: "summarize_text_file",
          target: "either",
          safetyLevel: "notice",
          approvalRequired: false,
          parameters: { path: "C:\\Users\\angel\\Documents\\Daily\\priorities.md" }
        },
        {
          id: "priorities-2",
          title: "Send phone summary",
          description: "Push the final summary to the paired Android device.",
          skillKey: "send_phone_notification",
          target: "android",
          safetyLevel: "notice",
          approvalRequired: false,
          parameters: { message: "Today's priorities are ready in CommandPilot." }
        }
      ],
      ["Read my next meeting note", "Open my work setup"],
      "either"
    );
  }

  const invoiceMatch = normalized.match(/latest invoice(?: for)? (?<client>.+)$/);
  if (invoiceMatch?.groups?.client) {
    const client = invoiceMatch.groups.client.trim();
    return planFromSteps(
      commandText,
      "find_latest_invoice",
      `found the latest invoice for ${client} and synced the result to your phone`,
      [
        {
          id: "invoice-1",
          title: "Search approved folders",
          description: `Find the best invoice match for ${client}.`,
          skillKey: "find_file",
          target: "pc",
          safetyLevel: "notice",
          approvalRequired: false,
          parameters: { query: `${client} invoice` }
        },
        {
          id: "invoice-2",
          title: "Open the file",
          description: "Open the invoice on Windows once found.",
          skillKey: "open_app",
          target: "pc",
          safetyLevel: "safe",
          approvalRequired: false,
          parameters: { appName: "Invoice Viewer" }
        },
        {
          id: "invoice-3",
          title: "Send phone status",
          description: "Notify the paired device that the invoice is ready.",
          skillKey: "send_phone_notification",
          target: "android",
          safetyLevel: "notice",
          approvalRequired: false,
          parameters: { message: `The latest invoice for ${client} is open on your PC.` }
        }
      ],
      ["Summarize this invoice", "Open the client folder"],
      "either"
    );
  }

  if (normalized.includes("open promptpilot studio")) {
    return planFromSteps(
      commandText,
      "launch_custom_page",
      "opened PromptPilot Studio",
      [
        {
          id: "promptpilot-1",
          title: "Launch custom app page",
          description: "Open the configured local PromptPilot destination.",
          skillKey: "launch_custom_app_page",
          target: "pc",
          safetyLevel: "safe",
          approvalRequired: false,
          parameters: { destination: "PromptPilot Studio" }
        }
      ],
      ["Open my work setup", "Run invoice summary"]
    );
  }

  if (normalized.includes("run invoice summary")) {
    return planFromSteps(
      commandText,
      "run_invoice_summary",
      "ran the invoice summary workflow",
      [
        {
          id: "invoice-summary-1",
          title: "Confirm workflow launch",
          description: "Ask for approval before starting the invoice summary script.",
          skillKey: "run_script",
          target: "pc",
          safetyLevel: "confirm",
          approvalRequired: true,
          parameters: { scriptKey: "invoice-summary" }
        },
        {
          id: "invoice-summary-2",
          title: "Send completion notification",
          description: "Keep the phone in sync once the summary is ready.",
          skillKey: "send_phone_notification",
          target: "android",
          safetyLevel: "notice",
          approvalRequired: false,
          parameters: { message: "Invoice summary has finished." }
        }
      ],
      ["Show me the result", "Open the latest client file and summarize it"],
      "either"
    );
  }

  if (normalized.includes("start content mode")) {
    return planFromWorkflow(
      commandText,
      "start_content_mode",
      "started content mode",
      workflowCatalog.find((workflow) => workflow.id === "content-mode")!,
      ["Notify me when this finishes", "Open my work setup"]
    );
  }

  if (normalized.includes("notify me when this finishes")) {
    return planFromSteps(
      commandText,
      "notify_on_finish",
      "attached a mobile notification to the current task",
      [
        {
          id: "notify-1",
          title: "Create mobile notification hook",
          description: "Attach a paired-device completion notice.",
          skillKey: "send_phone_notification",
          target: "android",
          safetyLevel: "notice",
          approvalRequired: false,
          parameters: { message: "I'll notify you on Android when the active task finishes." }
        }
      ],
      ["Show my running tasks", "Open approvals"],
      "android"
    );
  }

  if (normalized.includes("bank export workflow")) {
    return planFromWorkflow(
      commandText,
      "run_bank_export",
      "queued your bank export workflow",
      workflowCatalog.find((workflow) => workflow.id === "bank-export")!,
      ["Open approvals", "Show me the running tasks"]
    );
  }

  if (normalized.includes("open the latest client file and summarize it")) {
    return planFromSteps(
      commandText,
      "open_and_summarize_client_file",
      "opened the latest client file and prepared a summary",
      [
        {
          id: "client-file-1",
          title: "Find latest client file",
          description: "Search approved locations for the newest client document.",
          skillKey: "find_file",
          target: "pc",
          safetyLevel: "notice",
          approvalRequired: false,
          parameters: { query: "latest client file" }
        },
        {
          id: "client-file-2",
          title: "Summarize the file",
          description: "Read supported text and generate a concise recap.",
          skillKey: "summarize_text_file",
          target: "either",
          safetyLevel: "notice",
          approvalRequired: false,
          parameters: { path: "C:\\Users\\angel\\Documents\\Clients\\latest-client-note.md" }
        }
      ],
      ["Send the summary to my phone", "Open the client folder"],
      "either"
    );
  }

  if (normalized.includes("run month-end pack")) {
    return planFromWorkflow(
      commandText,
      "run_month_end_pack",
      "queued the month-end pack",
      workflowCatalog.find((workflow) => workflow.id === "month-end-pack")!,
      ["Open approvals", "Show finance activity"]
    );
  }

  if (normalized.startsWith("open ") && normalized.includes("http")) {
    const target = normalized.replace(/^open\s+/, "");
    const websiteTarget = resolveWebsiteTarget(target, trustedWebsiteHosts);
    if (websiteTarget) {
      return planFromSteps(
        commandText,
        "open_website_generic",
        "opened the trusted website",
        [
          {
            id: "generic-open-site-1",
            title: "Open trusted website",
            description: "Launch the requested website on Windows.",
            skillKey: "open_website",
            target: "pc",
            safetyLevel: "safe",
            approvalRequired: false,
            parameters: { url: websiteTarget.url }
          }
        ],
        ["Pin this site as a quick action"]
      );
    }

    if (isPotentialWebsiteTarget(target)) {
      return planWebsiteSafetyBlock(commandText, extractWebsiteHost(target), trustedWebsiteHosts);
    }
  }

  return planConversationalReply(
    commandText,
    "generic_assistant_request",
    "explained Echo's current capabilities",
    "I haven't been wired for that yet, but I can open your apps, folders, Echo folder shortcuts, and Chrome tasks.",
    ["Open my work setup", "Open Chrome"]
  );
}

export function simulateExecution(plan: CommandPlan): CommandExecutionResult {
  const start = nowIso();
  const approvalsRequested: ApprovalRecord[] = [];
  const activityLog: ActivityLogRecord[] = [
    {
      id: createId("log"),
      commandId: plan.id,
      title: "Command received",
      details: plan.text,
      type: "command",
      status: "info",
      createdAt: start
    }
  ];

  let status: CommandStatus = "running";
  const steps = plan.steps.map((step, index) => {
    const startedAt = new Date(Date.now() + index * 1000).toISOString();
    const completedAt = new Date(Date.now() + index * 1000 + 650).toISOString();

    if (step.safetyLevel === "restricted") {
      status = "blocked";
      activityLog.push({
        id: createId("log"),
        commandId: plan.id,
        title: "Restricted action blocked",
        details: step.title,
        type: "step",
        status: "error",
        createdAt: startedAt
      });
      return { ...step, status: "failed" as const, startedAt, errorMessage: "Blocked by restricted safety settings." };
    }

    if (step.approvalRequired && status !== "blocked") {
      status = "awaiting_approval";
      const approval: ApprovalRecord = {
        id: createId("approval"),
        commandId: plan.id,
        title: step.title,
        description: step.description,
        status: "pending",
        requestedAt: startedAt,
        requestedOn: ["windows", "android"],
        safetyLevel: step.safetyLevel,
        target: step.target
      };
      approvalsRequested.push(approval);
      activityLog.push({
        id: createId("log"),
        commandId: plan.id,
        title: "Approval requested",
        details: step.title,
        type: "approval",
        status: "warning",
        createdAt: startedAt
      });
      return { ...step, status: "awaiting_approval" as const, startedAt };
    }

    if (status === "awaiting_approval" || status === "blocked") {
      return { ...step, status: "pending" as const };
    }

    activityLog.push({
      id: createId("log"),
      commandId: plan.id,
      title: "Step completed",
      details: `${step.title} via ${step.skillKey}`,
      type: "step",
      status: "success",
      createdAt: completedAt
    });

    return { ...step, status: "completed" as const, startedAt, completedAt };
  });

  if (status === "running") {
    status = "completed";
  }

  const finalPlan: CommandPlan = { ...plan, steps, status };
  const completionSummary = buildEchoSummary(finalPlan, status);

  activityLog.push({
    id: createId("log"),
    commandId: plan.id,
    title: "Command finished",
    details: completionSummary,
    type: "command",
    status: status === "completed" ? "success" : status === "failed" ? "error" : "warning",
    createdAt: nowIso()
  });

  return {
    plan: finalPlan,
    status,
    echoMessage: completionSummary,
    completionSummary,
    steps,
    approvalsRequested,
    activityLog
  };
}

export function autoApproveExecutionResult(
  result: CommandExecutionResult,
  message: string
): CommandExecutionResult {
  if (result.approvalsRequested.length === 0 && result.status !== "awaiting_approval") {
    return result;
  }

  const timestamp = nowIso();
  const steps = result.steps.map((step) => {
    if (step.status === "awaiting_approval") {
      return {
        ...step,
        status: "completed" as const,
        completedAt: timestamp,
        errorMessage: undefined
      };
    }

    if (step.status === "pending") {
      return {
        ...step,
        status: "completed" as const,
        completedAt: timestamp
      };
    }

    return step;
  });

  return {
    ...result,
    status: "completed",
    echoMessage: message,
    completionSummary: message,
    approvalsRequested: [],
    steps,
    plan: {
      ...result.plan,
      status: "completed",
      steps
    },
    activityLog: [
      {
        id: createId("log"),
        commandId: result.plan.id,
        title: "Demo auto-approved",
        details: message,
        type: "approval",
        status: "success",
        createdAt: timestamp
      },
      ...result.activityLog.filter(
        (log) => !(log.type === "approval" && log.title === "Approval requested")
      )
    ]
  };
}
