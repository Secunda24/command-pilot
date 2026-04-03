import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

interface UseEchoVoiceInputOptions {
  enabled: boolean;
  onTranscriptFinal?: (transcript: string) => void | Promise<void>;
  onTranscriptChange?: (transcript: string) => void;
}

interface UseEchoVoiceInputResult {
  supported: boolean;
  listening: boolean;
  interimTranscript: string;
  lastTranscript: string;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearError: () => void;
}

function normalizeVoiceTranscript(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function useEchoVoiceInput({
  enabled,
  onTranscriptFinal,
  onTranscriptChange
}: UseEchoVoiceInputOptions): UseEchoVoiceInputResult {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onTranscriptFinal);
  const onChangeRef = useRef(onTranscriptChange);
  const sessionHeardResultRef = useRef(false);
  const sessionErrorRef = useRef<string | null>(null);
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onFinalRef.current = onTranscriptFinal;
    onChangeRef.current = onTranscriptChange;
  }, [onTranscriptFinal, onTranscriptChange]);

  const recognitionConstructor = useMemo<SpeechRecognitionConstructor | undefined>(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    return window.SpeechRecognition ?? window.webkitSpeechRecognition;
  }, []);

  const supported = Boolean(recognitionConstructor);

  useEffect(() => {
    if (!supported || !recognitionConstructor) {
      return;
    }

    const recognition = new recognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = window.navigator.language || "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      sessionHeardResultRef.current = false;
      sessionErrorRef.current = null;
      setError(null);
      setListening(true);
      setInterimTranscript("");
    };

    recognition.onend = () => {
      setListening(false);
      setInterimTranscript("");

      if (!sessionHeardResultRef.current && !sessionErrorRef.current) {
        setError("I didn't hear a command. Try again and start speaking right after clicking the mic.");
      }
    };

    recognition.onerror = (event) => {
      setListening(false);

      if (event.error === "not-allowed") {
        sessionErrorRef.current = "Microphone permission was denied.";
        setError("Microphone permission was denied.");
        return;
      }

      if (event.error === "no-speech") {
        sessionErrorRef.current = "I didn't catch anything that time.";
        setError("I didn't catch anything that time.");
        return;
      }

      sessionErrorRef.current = "Voice recognition could not continue.";
      setError("Voice recognition could not continue.");
    };

    recognition.onresult = (event) => {
      const transcripts = Array.from(event.results).map((result) => result[0]?.transcript ?? "");
      const combinedTranscript = normalizeVoiceTranscript(transcripts.join(" "));
      const finalizedTranscripts: string[] = [];

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) {
          finalizedTranscripts.push(result[0]?.transcript ?? "");
        }
      }

      if (combinedTranscript) {
        sessionHeardResultRef.current = true;
      }

      setInterimTranscript(combinedTranscript);
      onChangeRef.current?.(combinedTranscript);

      const normalizedFinal = normalizeVoiceTranscript(finalizedTranscripts.join(" "));
      if (normalizedFinal) {
        setLastTranscript(normalizedFinal);
        recognition.stop();
        void onFinalRef.current?.(normalizedFinal);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [recognitionConstructor, supported]);

  async function startListening() {
    if (!enabled) {
      setError("Voice commands are turned off.");
      return;
    }

    if (!recognitionRef.current) {
      setError("Voice recognition is not available in this browser.");
      return;
    }

    setError(null);

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        setError("Microphone permission was denied.");
        return;
      }
    }

    try {
      recognitionRef.current.start();
    } catch {
      setError("Voice recognition is already active.");
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function clearError() {
    setError(null);
  }

  return {
    supported,
    listening,
    interimTranscript,
    lastTranscript,
    error,
    startListening,
    stopListening,
    clearError
  };
}
