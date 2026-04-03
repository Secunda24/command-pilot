import type {
  EchoAiConversationMessage,
  EchoAiInterpretResponse
} from "@commandpilot/core";
import { BRIDGE_BASE_URL } from "./runtimeBridge";

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
