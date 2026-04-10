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
const DEFAULT_OLLAMA_MODEL = "gemma:2b";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const REQUEST_TIMEOUT_MS = 45000;

type AiProviderPreference = "auto" | "openai" | "ollama";

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

function getOllamaConfig(): { baseUrl: string; model: string } {
  loadCommandPilotEnv();

  const baseUrl = (process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;

  return { baseUrl, model };
}

function getAiProviderPreference(): AiProviderPreference {
  loadCommandPilotEnv();

  const configured = process.env.COMMANDPILOT_AI_PROVIDER?.trim().toLowerCase();
  if (configured === "openai" || configured === "ollama") {
    return configured;
  }

  return "auto";
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

function buildOllamaInstructions(): string {
  return [
    "You are Echo, the assistant inside CommandPilot.",
    "Return JSON only with keys: mode, normalized_command, assistant_reply.",
    "mode must be execute or respond.",
    "Default to respond unless the user explicitly asks Echo to perform an action.",
    "Use execute for imperative task requests like: open, launch, start, run, create, show, check, find, search, type, go to, navigate.",
    "Use respond for greetings, casual conversation, and general Q&A.",
    "For execute mode, normalized_command should be concise and start with Echo,.",
    "For respond mode, normalized_command must be null.",
    "assistant_reply must be short and helpful."
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

function extractOllamaResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as {
    message?: { content?: unknown };
    response?: unknown;
  };

  if (typeof record.message?.content === "string" && record.message.content.trim()) {
    return record.message.content.trim();
  }

  if (typeof record.response === "string" && record.response.trim()) {
    return record.response.trim();
  }

  return "";
}

function ensureEchoPrefix(command: string): string {
  return /^echo,\s*/i.test(command) ? command.trim() : `Echo, ${command.trim()}`;
}

function parseInterpretation(rawText: string): EchoAiInterpretation {
  if (!rawText.trim()) {
    throw new EchoAiBridgeError("AI returned an empty interpretation.", 502);
  }

  let parsed: {
    mode?: unknown;
    normalized_command?: unknown;
    assistant_reply?: unknown;
  };

  try {
    parsed = JSON.parse(rawText) as typeof parsed;
  } catch {
    throw new EchoAiBridgeError("AI returned invalid JSON for the interpretation.", 502);
  }

  if (parsed.mode !== "execute" && parsed.mode !== "respond") {
    throw new EchoAiBridgeError("AI returned an unsupported interpretation mode.", 502);
  }

  if (typeof parsed.assistant_reply !== "string") {
    throw new EchoAiBridgeError("AI returned an invalid assistant reply.", 502);
  }

  const assistantReply = parsed.assistant_reply.trim();
  if (!assistantReply) {
    throw new EchoAiBridgeError("AI returned a blank assistant reply.", 502);
  }

  if (parsed.mode === "respond") {
    return {
      mode: "respond",
      normalizedCommand: null,
      assistantReply
    };
  }

  if (typeof parsed.normalized_command !== "string" || !parsed.normalized_command.trim()) {
    throw new EchoAiBridgeError("AI returned execute mode without a command.", 502);
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

  const record = payload as {
    error?: { message?: unknown } | unknown;
  };

  if (typeof record.error === "string") {
    return record.error;
  }

  if (record.error && typeof record.error === "object") {
    const errorObject = record.error as { message?: unknown };
    if (typeof errorObject.message === "string") {
      return errorObject.message;
    }
  }

  return null;
}

export function isOpenAiConfigured(): boolean {
  return getOpenAiConfig() !== null;
}

export function isOllamaConfigured(): boolean {
  const config = getOllamaConfig();
  return Boolean(config.baseUrl && config.model);
}

export function isAiConfigured(): boolean {
  const provider = getAiProviderPreference();

  if (provider === "openai") {
    return isOpenAiConfigured();
  }

  if (provider === "ollama") {
    return isOllamaConfigured();
  }

  return isOllamaConfigured() || isOpenAiConfigured();
}

export function isEchoAiBridgeError(error: unknown): error is EchoAiBridgeError {
  return error instanceof EchoAiBridgeError;
}

async function interpretCommandWithOpenAiInternal(
  payload: EchoAiInterpretRequest
): Promise<Omit<EchoAiInterpretResponse, "ok">> {
  const command = payload.command.trim();
  if (!command) {
    throw new EchoAiBridgeError("A command is required for AI interpretation.", 400);
  }

  const config = getOpenAiConfig();
  if (!config) {
    throw new EchoAiBridgeError("OPENAI_API_KEY is not configured for the local CommandPilot bridge.", 503);
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

async function interpretCommandWithOllamaInternal(
  payload: EchoAiInterpretRequest
): Promise<Omit<EchoAiInterpretResponse, "ok">> {
  const command = payload.command.trim();
  if (!command) {
    throw new EchoAiBridgeError("A command is required for AI interpretation.", 400);
  }

  const config = getOllamaConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        format: "json",
        messages: [
          {
            role: "system",
            content: buildOllamaInstructions()
          },
          {
            role: "user",
            content: buildConversationInput(payload)
          }
        ],
        options: {
          temperature: 0.1,
          num_predict: 48,
          num_ctx: 512
        }
      }),
      signal: controller.signal
    });

    const responsePayload = (await response.json()) as unknown;

    if (!response.ok) {
      throw new EchoAiBridgeError(
        getErrorMessage(responsePayload) || "Ollama could not interpret the request right now.",
        502
      );
    }

    return {
      provider: "ollama",
      model: config.model,
      interpretation: parseInterpretation(extractOllamaResponseText(responsePayload))
    };
  } catch (error) {
    if (error instanceof EchoAiBridgeError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new EchoAiBridgeError("Ollama took too long to answer the request.", 504);
    }

    throw new EchoAiBridgeError(
      error instanceof Error ? error.message : "Ollama interpretation failed unexpectedly.",
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function interpretCommandWithAi(
  payload: EchoAiInterpretRequest
): Promise<Omit<EchoAiInterpretResponse, "ok">> {
  const provider = getAiProviderPreference();

  if (provider === "openai") {
    return interpretCommandWithOpenAiInternal(payload);
  }

  if (provider === "ollama") {
    return interpretCommandWithOllamaInternal(payload);
  }

  try {
    return await interpretCommandWithOllamaInternal(payload);
  } catch (ollamaError) {
    if (isOpenAiConfigured()) {
      return interpretCommandWithOpenAiInternal(payload);
    }

    if (isEchoAiBridgeError(ollamaError)) {
      throw ollamaError;
    }

    throw new EchoAiBridgeError("No AI provider is currently available on this machine.", 503);
  }
}
