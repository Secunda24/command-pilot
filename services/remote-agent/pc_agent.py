"""
pc_agent.py - CommandPilot Remote PC Agent
==========================================
Run this on your PC. It connects to the relay and executes commands coming
from your phone.

Execution priority:
  1) CommandPilot local bridge (/api/command/execute)
  2) Jarvis skills fallback (if available)
  3) Ollama chat fallback
"""

import asyncio
import json
import os
import subprocess
import sys
import threading
from urllib import error as urllib_error
from urllib import request as urllib_request

import websockets

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)


def load_dotenv():
    repo_root = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
    candidate_files = [
        os.path.join(repo_root, ".env.local"),
        os.path.join(repo_root, ".env"),
    ]

    for env_path in candidate_files:
        if not os.path.exists(env_path):
            continue

        try:
            with open(env_path, "r", encoding="utf-8") as handle:
                for raw_line in handle:
                    line = raw_line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue

                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip().strip("\"'")
                    if key and key not in os.environ:
                        os.environ[key] = value
        except Exception as exc:
            print(f"[AGENT] Could not load env file {env_path}: {exc}")


load_dotenv()

# Prevent Windows console encoding issues from crashing fallback logs/skills.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Configuration
RELAY_URL = os.getenv("RELAY_URL", "wss://your-relay-url.onrender.com")
AUTH_TOKEN = os.getenv("AUTH_TOKEN", "change-me-in-env")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
COMMANDPILOT_BRIDGE_URL = os.getenv("COMMANDPILOT_BRIDGE_URL", "http://127.0.0.1:8787")
COMMANDPILOT_BRIDGE_TIMEOUT = int(os.getenv("COMMANDPILOT_BRIDGE_TIMEOUT", "45"))
RECONNECT_DELAY = 5

# Optional modules are loaded lazily to avoid delaying relay connection.
HAS_JARVIS = False
HAS_OLLAMA = False
HAS_TTS = False
detect_and_run = None
process_action_queue = None
_ollama = None
_tts = None

_jarvis_init_done = False
_ollama_init_done = False
_tts_init_done = False
_jarvis_init_lock = threading.Lock()
_ollama_init_lock = threading.Lock()
_tts_init_lock = threading.Lock()

_ws_ref = [None]
_loop_ref = [None]
_conversation = []
_conversation_lock = threading.Lock()


def send_to_phone(ws, msg: dict):
    """Thread-safe send from worker thread to websocket loop."""
    loop = _loop_ref[0]
    if loop is None or loop.is_closed():
        return

    try:
        asyncio.run_coroutine_threadsafe(ws.send(json.dumps(msg)), loop)
    except Exception as exc:
        print(f"[SEND ERROR] {exc}")


def append_conversation(role: str, text: str):
    if role not in ("assistant", "user"):
        return
    cleaned = (text or "").strip()
    if not cleaned:
        return

    with _conversation_lock:
        _conversation.append({"role": role, "text": cleaned})
        if len(_conversation) > 8:
            del _conversation[:-8]


def recent_conversation():
    with _conversation_lock:
        return list(_conversation[-6:])


def truncate_for_voice(text: str, limit: int = 260) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 3].rsplit(" ", 1)[0] + "..."


def ensure_jarvis_loaded() -> bool:
    global HAS_JARVIS, detect_and_run, process_action_queue, _jarvis_init_done
    if _jarvis_init_done:
        return HAS_JARVIS

    with _jarvis_init_lock:
        if _jarvis_init_done:
            return HAS_JARVIS

        try:
            from jarvis_skills import detect_and_run as _detect_and_run
            from jarvis_skills import process_action_queue as _process_action_queue

            detect_and_run = _detect_and_run
            process_action_queue = _process_action_queue
            HAS_JARVIS = True
            print("[AGENT] Jarvis skills loaded")
        except ImportError:
            HAS_JARVIS = False
            print("[AGENT] jarvis_skills.py not found - running without skills fallback")
        except Exception as exc:
            HAS_JARVIS = False
            print(f"[AGENT] Jarvis skills failed to initialize: {exc}")
        finally:
            _jarvis_init_done = True

    return HAS_JARVIS


def ensure_ollama_loaded() -> bool:
    global HAS_OLLAMA, _ollama, _ollama_init_done
    if _ollama_init_done:
        return HAS_OLLAMA

    with _ollama_init_lock:
        if _ollama_init_done:
            return HAS_OLLAMA

        try:
            import ollama as _ollama_module

            _ollama = _ollama_module
            HAS_OLLAMA = True
            print(f"[AGENT] Ollama loaded (model: {OLLAMA_MODEL})")
        except ImportError:
            HAS_OLLAMA = False
            print("[AGENT] ollama package not installed - pip install ollama")
        except Exception as exc:
            HAS_OLLAMA = False
            print(f"[AGENT] Ollama failed to initialize: {exc}")
        finally:
            _ollama_init_done = True

    return HAS_OLLAMA


def ensure_tts_loaded() -> bool:
    global HAS_TTS, _tts, _tts_init_done
    if _tts_init_done:
        return HAS_TTS

    with _tts_init_lock:
        if _tts_init_done:
            return HAS_TTS

        try:
            import pyttsx3 as _pyttsx3_module

            _tts = _pyttsx3_module.init()
            _tts.setProperty("rate", 185)
            _tts.setProperty("volume", 1.0)
            HAS_TTS = True
            print("[AGENT] pyttsx3 fallback TTS loaded")
        except Exception:
            HAS_TTS = False
            print("[AGENT] pyttsx3 not available - SAPI only")
        finally:
            _tts_init_done = True

    return HAS_TTS


def warm_optional_modules():
    """Best-effort warmup after relay auth to reduce first-command latency."""
    ensure_jarvis_loaded()
    ensure_ollama_loaded()


def speak_with_sapi(text: str) -> bool:
    """Speak via Windows SAPI using same profile as user's Jarvis setup."""
    escaped = text.replace("'", "''")
    script = (
        "Add-Type -AssemblyName System.Speech;"
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;"
        "$voices = $s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name };"
        "$preferred = $voices | Where-Object { $_ -match 'Zira|Aria|Jenny|Female' } | Select-Object -First 1;"
        "if ($preferred) { $s.SelectVoice($preferred) };"
        "$s.Volume = 100;"
        "$s.Rate = 0;"
        f"$s.Speak('{escaped}');"
    )

    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            timeout=25,
            check=False,
        )
        return result.returncode == 0
    except Exception as exc:
        print(f"[SAPI ERROR] {exc}")
        return False


def speak_local(text: str):
    clipped = truncate_for_voice(text)
    if not clipped:
        return

    if speak_with_sapi(clipped):
        return

    if ensure_tts_loaded():
        try:
            _tts.say(clipped)
            _tts.runAndWait()
        except Exception as exc:
            print(f"[TTS ERROR] {exc}")


def ask_ollama(question: str) -> str:
    if not ensure_ollama_loaded():
        return "Ollama is not installed on this PC. Run: pip install ollama"

    try:
        messages = [
            {
                "role": "system",
                "content": "You are JARVIS. Reply in 1-2 sentences, helpful and concise.",
            }
        ]
        messages.extend(recent_conversation())
        messages.append({"role": "user", "content": question})

        reply = _ollama.chat(
            model=OLLAMA_MODEL,
            messages=messages,
            options={"temperature": 0.5, "num_predict": 120, "num_ctx": 1024},
        )
        content = reply.get("message", {}).get("content", "")
        return content.strip() or "I could not generate a response just now."
    except Exception as exc:
        return f"Ollama error: {exc}"


def execute_with_commandpilot(command_text: str):
    endpoint = COMMANDPILOT_BRIDGE_URL.rstrip("/") + "/api/command/execute"
    payload = {
        "command": command_text,
        "conversation": recent_conversation(),
        "autoApprove": True,
    }

    request_body = json.dumps(payload).encode("utf-8")
    request_obj = urllib_request.Request(
        endpoint,
        data=request_body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib_request.urlopen(request_obj, timeout=COMMANDPILOT_BRIDGE_TIMEOUT) as response:
            raw = response.read().decode("utf-8", errors="replace").strip()
    except urllib_error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        return None, f"Bridge HTTP {exc.code}: {error_body[:240]}"
    except Exception as exc:
        return None, f"Bridge unavailable: {exc}"

    if not raw:
        return None, "Bridge returned an empty response."

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None, "Bridge returned invalid JSON."

    if not isinstance(parsed, dict):
        return None, "Bridge returned an invalid payload."

    return parsed, None


def run_command(ws, raw: str):
    """Execute a command from phone. Runs in a daemon worker thread."""
    print(f"\n[CMD] Received: '{raw}'")
    send_to_phone(ws, {"type": "status", "status": "THINKING", "text": ""})

    response = None
    intent = "chat"

    # 1) CommandPilot local bridge first (shared execution engine with desktop)
    bridge_data, bridge_error = execute_with_commandpilot(raw)
    if bridge_data is not None:
        bridge_message = str(bridge_data.get("message", "")).strip()
        bridge_ok = bool(bridge_data.get("ok"))
        bridge_status = str(bridge_data.get("status", "")).strip().lower()
        bridge_intent = str(bridge_data.get("intent", "")).strip()
        provider = bridge_data.get("provider")
        model = bridge_data.get("model")

        if provider and model:
            print(f"[CMD] bridge provider={provider} model={model}")

        if bridge_message:
            response = bridge_message
            if bridge_ok:
                intent = "chat" if bridge_status == "responded" else (bridge_intent or "commandpilot")
            else:
                intent = "error" if bridge_status == "failed" else "chat"

            append_conversation("user", raw)
            append_conversation("assistant", response)

    # 2) Fallback path if bridge unavailable
    if response is None:
        if bridge_error:
            print(f"[BRIDGE] {bridge_error}")

        if ensure_jarvis_loaded():
            try:
                intent, response = detect_and_run(raw)
                process_action_queue()
            except Exception as exc:
                print(f"[SKILL ERROR] {exc}")
                intent, response = "error", f"Skill error: {exc}"

        if intent in ("chat", None) or response is None:
            send_to_phone(ws, {"type": "status", "status": "THINKING", "text": "Asking Ollama..."})
            response = ask_ollama(raw)
            intent = "chat"

        append_conversation("user", raw)
        append_conversation("assistant", response)

    response = str(response or "Done.").strip()
    print(f"[CMD] intent={intent} response='{response}'")

    if intent != "error":
        threading.Thread(target=speak_local, args=(response,), daemon=True).start()

    send_to_phone(
        ws,
        {
            "type": "response",
            "intent": intent,
            "text": response,
            "status": "STANDBY",
        },
    )


async def agent_loop():
    while True:
        print(f"[AGENT] Connecting to {RELAY_URL} ...")
        try:
            async with websockets.connect(
                RELAY_URL,
                ping_interval=20,
                ping_timeout=30,
                open_timeout=15,
            ) as ws:
                _ws_ref[0] = ws
                _loop_ref[0] = asyncio.get_running_loop()
                print("[AGENT] Connected")

                await ws.send(
                    json.dumps(
                        {
                            "type": "auth",
                            "token": AUTH_TOKEN,
                            "role": "pc",
                        }
                    )
                )

                async for raw in ws:
                    try:
                        data = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    msg_type = data.get("type")
                    print(f"[MSG] type={msg_type}")

                    if msg_type == "auth_ok":
                        print(f"[AGENT] Auth OK - {data.get('message', '')}")
                        threading.Thread(target=warm_optional_modules, daemon=True).start()
                        await ws.send(
                            json.dumps(
                                {
                                    "type": "status",
                                    "status": "STANDBY",
                                    "text": "",
                                }
                            )
                        )

                    elif msg_type == "command":
                        cmd = data.get("text", "").strip()
                        if cmd:
                            threading.Thread(target=run_command, args=(ws, cmd), daemon=True).start()

                    elif msg_type == "error":
                        print(f"[SERVER ERROR] {data.get('message', '')}")

        except (
            websockets.exceptions.ConnectionClosed,
            websockets.exceptions.WebSocketException,
            OSError,
        ) as exc:
            print(f"[AGENT] Disconnected: {exc}")
        except Exception as exc:
            print(f"[AGENT] Unexpected error: {exc}")

        _ws_ref[0] = None
        _loop_ref[0] = None
        print(f"[AGENT] Reconnecting in {RECONNECT_DELAY}s ...")
        await asyncio.sleep(RECONNECT_DELAY)


if __name__ == "__main__":
    print("=" * 64)
    print("  CommandPilot Remote - PC Agent")
    print(f"  Relay   : {RELAY_URL}")
    print(f"  Bridge  : {COMMANDPILOT_BRIDGE_URL}")
    print(f"  Ollama  : {OLLAMA_MODEL}")
    print("  Jarvis  : on-demand")
    print("=" * 64)

    if RELAY_URL == "wss://your-relay-url.onrender.com":
        print("\n[WARN] RELAY_URL is still a placeholder.")
    if AUTH_TOKEN == "change-me-in-env":
        print("[WARN] AUTH_TOKEN is still a placeholder.\n")

    try:
        asyncio.run(agent_loop())
    except KeyboardInterrupt:
        print("\n[AGENT] Stopped.")
