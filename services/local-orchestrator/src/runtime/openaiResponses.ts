import {
  getLinkedRoutesForApp,
  linkedApps,
  type EchoAiInterpretRequest,
  type EchoAiInterpretResponse,
  type EchoAiInterpretation
} from "@commandpilot/core";
import { loadCommandPilotEnv } from "./env";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const REQUEST_TIMEOUT_MS = 15000;

const interpretationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: {
      type: "string",
      enum: ["execute", "respond"]
    },
    normalized_command: {
      type: ["string", "null"]
    },
    assistant_reply: {
      type: "string"
    }
  },
  required: ["mode", "normalized_command", "assistant_reply"]
} as const;

class EchoAiBridgeError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "EchoAiBridgeError";
    this.statusCode = statusCode;
  }
}

function getOpenAiConfig(): { apiKey: string; model: string } | null {
  loadCommandPilotEnv();

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL
  };
}

function truncateText(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 3)}...`;
}

function buildSupportedCommandGuide(): string {
  const coreCommands = [
    "Echo, open my work setup",
    "Echo, show me today's priorities",
    "Echo, find the latest invoice for Acme",
    "Echo, open PromptPilot Studio",
    "Echo, run invoice summary",
    "Echo, start content mode",
    "Echo, notify me when this finishes",
    "Echo, run my bank export workflow",
    "Echo, open the latest client file and summarize it",
    "Echo, run month-end pack",
    "Echo, open the Echo Test Folder on my Desktop",
    "Echo, show me the contents of the Echo Test Folder",
    "Echo, create a folder called Notes Archive in the Echo Test Folder",
    "Echo, create a note called quick-test in the Echo Test Folder",
    "Echo, open the file welcome.txt in the Echo Test Folder",
    "Echo, open the folder Notes in the Echo Test Folder",
    "Echo, open Desktop",
    "Echo, open Documents",
    "Echo, open C:\\Users\\angel\\OneDrive\\Desktop\\Echo Test Folder"
  ];

  const appCommands = linkedApps.map((app) => `Echo, open ${app.name}`);
  const statusCommands = linkedApps.map((app) => `Echo, is ${app.name} running`);
  const routeCommands = linkedApps.flatMap((app) =>
    getLinkedRoutesForApp(app.key).map((route) => `Echo, open ${app.name} ${route.name}`)
  );

  return [...coreCommands, ...appCommands, ...routeCommands, ...statusCommands]
    .map((command) => `- ${command}`)
    .join("\n");
}

function buildInstructions(): string {
  return [
    "You are Echo, the assistant inside CommandPilot.",
    "Your tone is calm, intelligent, confident, and slightly futuristic.",
    "Decide whether the latest user message should execute a supported CommandPilot action or receive a short conversational reply.",
    "When the user is asking CommandPilot to do something it already supports, return mode execute and rewrite the request as a single canonical command that CommandPilot already understands.",
    "Use the exact command surface below whenever possible. Prefer commands that start with 'Echo,'.",
    "When the request is conversational, unsupported, ambiguous, or asks for a capability CommandPilot does not have yet, return mode respond with normalized_command set to null.",
    "Never invent tool names, routes, or capabilities that are not in the supported command list.",
    "Keep assistant_reply short and natural. Do not mention JSON, schemas, or hidden system behavior.",
    "Supported canonical commands:",
    buildSupportedCommandGuide()
  ].join("\n");
}

function buildConversationInput(payload: EchoAiInterpretRequest): string {
  const conversationLines =
    payload.conversation.length === 0
      ? "Recent conversation: none."
      : [
          "Recent conversation:",
          ...payload.conversation.slice(-6).map((message) => {
            const speaker = message.role === "assistant" ? "Echo" : "User";
            return `${speaker}: ${truncateText(message.text.trim(), 280)}`;
          })
        ].join("\n");

  return `${conversationLines}\n\nLatest user request:\n${payload.command.trim()}`;
}

function extractResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown; value?: unknown }> }>;
  };

  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text.trim();
  }

  const fragments: string[] = [];
  for (const item of record.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        fragments.push(content.text.trim());
        continue;
      }

      if (typeof content.value === "string" && content.value.trim()) {
        fragments.push(content.value.trim());
      }
    }
  }

  return fragments.join("\n").trim();
}

function ensureEchoPrefix(command: string): string {
  return /^echo,\s*/i.test(command) ? command.trim() : `Echo, ${command.trim()}`;
}

function parseInterpretation(rawText: string): EchoAiInterpretation {
  if (!rawText.trim()) {
    throw new EchoAiBridgeError("OpenAI returned an empty interpretation.", 502);
  }

  let parsed: {
    mode?: unknown;
    normalized_command?: unknown;
    assistant_reply?: unknown;
  };

  try {
    parsed = JSON.parse(rawText) as typeof parsed;
  } catch {
    throw new EchoAiBridgeError("OpenAI returned invalid JSON for the interpretation.", 502);
  }

  if (parsed.mode !== "execute" && parsed.mode !== "respond") {
    throw new EchoAiBridgeError("OpenAI returned an unsupported interpretation mode.", 502);
  }

  if (typeof parsed.assistant_reply !== "string") {
    throw new EchoAiBridgeError("OpenAI returned an invalid assistant reply.", 502);
  }

  const assistantReply = parsed.assistant_reply.trim();
  if (!assistantReply) {
    throw new EchoAiBridgeError("OpenAI returned a blank assistant reply.", 502);
  }

  if (parsed.mode === "respond") {
    return {
      mode: "respond",
      normalizedCommand: null,
      assistantReply
    };
  }

  if (typeof parsed.normalized_command !== "string" || !parsed.normalized_command.trim()) {
    throw new EchoAiBridgeError("OpenAI returned an executable mode without a command.", 502);
  }

  return {
    mode: "execute",
    normalizedCommand: ensureEchoPrefix(parsed.normalized_command),
    assistantReply
  };
}

function getErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as { error?: { message?: unknown } };
  return typeof record.error?.message === "string" ? record.error.message : null;
}

export function isOpenAiConfigured(): boolean {
  return getOpenAiConfig() !== null;
}

export function isEchoAiBridgeError(error: unknown): error is EchoAiBridgeError {
  return error instanceof EchoAiBridgeError;
}

export async function interpretCommandWithOpenAi(
  payload: EchoAiInterpretRequest
): Promise<Omit<EchoAiInterpretResponse, "ok">> {
  const command = payload.command.trim();
  if (!command) {
    throw new EchoAiBridgeError("A command is required for AI interpretation.", 400);
  }

  const config = getOpenAiConfig();
  if (!config) {
    throw new EchoAiBridgeError(
      "OPENAI_API_KEY is not configured for the local CommandPilot bridge.",
      503
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        store: false,
        instructions: buildInstructions(),
        input: buildConversationInput(payload),
        max_output_tokens: 220,
        text: {
          format: {
            type: "json_schema",
            name: "commandpilot_interpretation",
            strict: true,
            schema: interpretationSchema
          }
        }
      }),
      signal: controller.signal
    });

    const responsePayload = (await response.json()) as unknown;

    if (!response.ok) {
      throw new EchoAiBridgeError(
        getErrorMessage(responsePayload) || "OpenAI could not interpret the request right now.",
        502
      );
    }

    return {
      provider: "openai",
      model: config.model,
      interpretation: parseInterpretation(extractResponseText(responsePayload))
    };
  } catch (error) {
    if (error instanceof EchoAiBridgeError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new EchoAiBridgeError("OpenAI took too long to answer the request.", 504);
    }

    throw new EchoAiBridgeError(
      error instanceof Error ? error.message : "OpenAI interpretation failed unexpectedly.",
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}
