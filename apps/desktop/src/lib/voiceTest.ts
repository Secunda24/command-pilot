const preferredVoicePatterns = [/zira/i, /aria/i, /jenny/i, /female/i, /susan/i, /english/i];

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const pattern of preferredVoicePatterns) {
    const match = voices.find((voice) => pattern.test(voice.name));
    if (match) {
      return match;
    }
  }

  return voices[0] ?? null;
}

async function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const existingVoices = synth.getVoices();

  if (existingVoices.length > 0) {
    return existingVoices;
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      synth.onvoiceschanged = null;
      resolve(synth.getVoices());
    }, 1500);

    synth.onvoiceschanged = () => {
      window.clearTimeout(timeout);
      synth.onvoiceschanged = null;
      resolve(synth.getVoices());
    };
  });
}

interface SpeakEchoOptions {
  rate: number;
  pitch?: number;
}

async function speakWithEchoVoice(
  text: string,
  { rate, pitch = 1 }: SpeakEchoOptions
): Promise<string> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    throw new Error("Speech synthesis is not available in this browser.");
  }

  const voices = await getAvailableVoices();
  const voice = pickBestVoice(voices);
  const utterance = new SpeechSynthesisUtterance(text);

  utterance.voice = voice;
  utterance.lang = voice?.lang || "en-US";
  utterance.rate = rate;
  utterance.pitch = pitch;

  window.speechSynthesis.cancel();

  return new Promise((resolve, reject) => {
    utterance.onend = () => resolve(voice?.name ?? "System Default");
    utterance.onerror = () => reject(new Error("The browser could not play Echo's voice preview."));
    window.speechSynthesis.speak(utterance);
  });
}

export async function speakEchoPreview(rate: number): Promise<string> {
  return speakWithEchoVoice("Hello, I am Echo. Your desktop assistant is online.", { rate });
}

export async function speakEchoReply(text: string, rate: number): Promise<string> {
  return speakWithEchoVoice(text, { rate });
}
