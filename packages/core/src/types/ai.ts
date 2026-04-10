export type EchoAiMode = "execute" | "respond";

export interface EchoAiConversationMessage {
  role: "assistant" | "user";
  text: string;
}

export interface EchoAiInterpretRequest {
  command: string;
  conversation: EchoAiConversationMessage[];
}

export interface EchoAiInterpretation {
  mode: EchoAiMode;
  normalizedCommand: string | null;
  assistantReply: string;
}

export interface EchoAiInterpretResponse {
  ok: boolean;
  provider: "openai" | "ollama";
  model: string;
  interpretation: EchoAiInterpretation;
}
