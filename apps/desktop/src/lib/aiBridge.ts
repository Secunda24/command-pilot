import type {
  EchoAiConversationMessage,
  EchoAiInterpretResponse
} from "@commandpilot/core";
import { BRIDGE_BASE_URL } from "./runtimeBridge";

export interface AiRuntimeStatus {
  preferredProvider: "openai" | "ollama";
  zeroTokenMode: boolean;
  localOnly: boolean;
  message: string;
  ollama: {
    baseUrl: string;
    model: string;
    reachable: boolean;
    modelAvailable: boolean;
    message: string;
  };
  openai: {
    configured: boolean;
    model: string | null;
  };
}

export async function interpretCommandWithAi(
  command: string,
  conversation: EchoAiConversationMessage[]
): Promise<EchoAiInterpretResponse | null> {
  try {
    const response = await fetch(`${BRIDGE_BASE_URL}/api/ai/interpret`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        command,
        conversation
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as EchoAiInterpretResponse;
    return data.ok ? data : null;
  } catch (error) {
    console.warn("Echo AI interpretation is unavailable, falling back to local planning.", error);
    return null;
  }
}

export async function fetchAiRuntimeStatus(): Promise<AiRuntimeStatus> {
  const response = await fetch(`${BRIDGE_BASE_URL}/api/ai/status`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error("Could not load the AI runtime status.");
  }

  return (await response.json()) as AiRuntimeStatus;
}
