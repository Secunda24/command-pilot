"""
jarvis_core.py  v4
Voice loop → intent detection → skill or Ollama → speak response.
"""

import numpy as np
import sounddevice as sd
import whisper, pyttsx3, ollama, time, warnings
warnings.filterwarnings('ignore')

from jarvis_skills import detect_and_run, process_action_queue

VERSION = "v4"

class JarvisCore:
    def __init__(self, ui_callback=None, master=None):
        self.ui_callback  = ui_callback
        self.master       = master
        self.model_name   = "gemma:2b"
        self.tts_engine   = None          # init on core thread
        self.wake_word    = "hello"

        print(f"[CORE {VERSION}] Loading Whisper (tiny)...")
        self.stt = whisper.load_model("tiny")
        print(f"[CORE {VERSION}] Ready.")

    # ── UI ───────────────────────────────────────────────────────────────────
    def ui(self, status, text=""):
        if self.ui_callback:
            try: self.ui_callback(status, text)
            except: pass

    # ── TTS ──────────────────────────────────────────────────────────────────
    def speak(self, text):
        self.ui("SPEAKING", text)
        print(f"[JARVIS SPEAKS] {text}")
        if len(text) > 220:
            text = text[:220].rsplit(' ',1)[0] + "..."
        self.tts_engine.say(text)
        self.tts_engine.runAndWait()
        self.ui("STANDBY")

    # ── STT ──────────────────────────────────────────────────────────────────
    def listen(self, seconds=4):
        self.ui("LISTENING")
        print(f"[LISTEN] Recording {seconds}s — speak now...")
        rec = sd.rec(int(seconds*16000), samplerate=16000,
                     channels=1, dtype=np.float32, blocksize=512)
        sd.wait()
        rec = rec * 3.0
        result = self.stt.transcribe(rec.flatten(), fp16=False, language='en')
        text = result["text"].strip().lower()
        print(f"[HEARD] '{text}'")
        return text

    # ── Ollama fallback ───────────────────────────────────────────────────────
    def ask_ollama(self, q):
        self.ui("THINKING")
        try:
            r = ollama.chat(
                model=self.model_name,
                messages=[
                    {"role":"system","content":
                     "You are JARVIS. Reply in 1-2 sentences, witty and helpful."},
                    {"role":"user","content":q}
                ],
                options={"temperature":0.6,"num_predict":60,"num_ctx":512}
            )
            return r['message']['content'].strip()
        except Exception as e:
            print(f"[OLLAMA ERROR] {e}")
            return "My AI core is unavailable right now, sir."

    # ── drain OS action queue (called from Tkinter main thread) ──────────────
    def drain_queue(self):
        process_action_queue()
        if self.master:
            self.master.after(100, self.drain_queue)

    # ── main voice loop ───────────────────────────────────────────────────────
    def run(self):
        print(f"[CORE {VERSION}] Initialising TTS on this thread...")
        self.tts_engine = pyttsx3.init()
        self.tts_engine.setProperty('rate', 185)
        self.tts_engine.setProperty('volume', 1.0)
        print(f"[CORE {VERSION}] TTS ready. Starting voice loop.")

        self.speak("JARVIS online. Say hello to activate me.")

        while True:
            try:
                # ── listen for wake word ──────────────────────────────────
                audio = self.listen(seconds=3)

                if self.wake_word not in audio:
                    continue

                # ── wake word detected ────────────────────────────────────
                print("[WAKE] Wake word detected!")
                self.speak("Yes, sir?")

                # ── listen for command (longer window) ────────────────────
                command = self.listen(seconds=6)

                if len(command) < 2:
                    self.speak("I did not catch that, sir. Please try again.")
                    continue

                # ── route to skill ────────────────────────────────────────
                print(f"[COMMAND] Processing: '{command}'")
                self.ui("THINKING")

                intent, response = detect_and_run(command)

                if intent == "chat" or response is None:
                    response = self.ask_ollama(command)

                # ── speak the response ────────────────────────────────────
                print(f"[RESPONSE] intent={intent}  text='{response}'")
                self.speak(response)

                if intent == "stop":
                    break

                time.sleep(0.3)

            except KeyboardInterrupt:
                self.speak("Goodbye, sir.")
                break
            except Exception as e:
                print(f"[LOOP ERROR] {e}")
                import traceback; traceback.print_exc()
                time.sleep(1)
