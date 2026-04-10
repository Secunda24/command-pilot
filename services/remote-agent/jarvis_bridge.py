"""
jarvis_bridge.py  v1
WebSocket bridge — React CommandPilot  ↔  JarvisCore / Ollama
Listens on  ws://localhost:8765

Usage (standalone):      python jarvis_bridge.py
Usage (from jarvis_ui):  from jarvis_bridge import start_bridge_thread, broadcast
"""

import asyncio, json, threading, sys, os
import websockets

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jarvis_skills import detect_and_run, process_action_queue

# ── shared state ──────────────────────────────────────────────────────────────
CLIENTS: set = set()
_loop: asyncio.AbstractEventLoop | None = None
OLLAMA_MODEL = "qwen2.5-coder:7b"

# ── outbound broadcast (thread-safe) ─────────────────────────────────────────
def broadcast(data: dict):
    """Call from any thread to push a message to all React clients."""
    if not _loop or _loop.is_closed():
        return
    asyncio.run_coroutine_threadsafe(_async_broadcast(json.dumps(data)), _loop)

async def _async_broadcast(msg: str):
    dead = set()
    for ws in list(CLIENTS):
        try:
            await ws.send(msg)
        except Exception:
            dead.add(ws)
    CLIENTS.difference_update(dead)

# ── WebSocket handler ─────────────────────────────────────────────────────────
async def _handler(websocket):
    CLIENTS.add(websocket)
    print(f"[BRIDGE] React client connected  (total: {len(CLIENTS)})")
    try:
        await websocket.send(json.dumps({
            "type": "status", "status": "STANDBY",
            "text": "Jarvis Bridge online — Ollama model: " + OLLAMA_MODEL
        }))
        async for raw in websocket:
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            t = data.get("type")

            if t == "command":
                cmd = data.get("text", "").strip()
                if not cmd:
                    continue
                print(f"[BRIDGE] React command: '{cmd}'")
                # tell the client we're working
                await websocket.send(json.dumps(
                    {"type": "status", "status": "THINKING", "text": ""}
                ))
                # run blocking skill + Ollama in a worker thread
                threading.Thread(
                    target=_run_command, args=(cmd,), daemon=True
                ).start()

            elif t == "ping":
                await websocket.send(json.dumps({"type": "pong"}))

            elif t == "set_model":
                global OLLAMA_MODEL
                OLLAMA_MODEL = data.get("model", OLLAMA_MODEL)
                broadcast({"type": "info", "text": f"Model set to {OLLAMA_MODEL}"})

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        CLIENTS.discard(websocket)
        print(f"[BRIDGE] Client disconnected (remaining: {len(CLIENTS)})")

# ── command execution (runs in worker thread) ─────────────────────────────────
def _run_command(cmd: str):
    try:
        intent, response = detect_and_run(cmd)

        # skill matched — may have queued an OS action
        if intent not in ("chat", None) and response:
            # drain OS queue (safe on a background thread for non-GUI actions)
            process_action_queue()
            broadcast({
                "type": "response",
                "intent": intent,
                "text": response,
                "status": "STANDBY"
            })
            return

        # fallback to Ollama
        broadcast({"type": "status", "status": "THINKING", "text": "Asking Ollama…"})
        try:
            import ollama
            r = ollama.chat(
                model=OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content":
                     "You are JARVIS. Reply in 1–2 sentences, witty and helpful."},
                    {"role": "user", "content": cmd}
                ],
                options={"temperature": 0.6, "num_predict": 80, "num_ctx": 512}
            )
            response = r["message"]["content"].strip()
        except Exception as e:
            response = f"Ollama unavailable ({e}). Is it running?"

        broadcast({
            "type": "response",
            "intent": "chat",
            "text": response,
            "status": "STANDBY"
        })

    except Exception as e:
        broadcast({"type": "error", "text": str(e), "status": "STANDBY"})

# ── server lifecycle ──────────────────────────────────────────────────────────
async def _serve():
    async with websockets.serve(_handler, "localhost", 8765):
        print("[BRIDGE] WebSocket server listening on  ws://localhost:8765")
        await asyncio.Future()  # run until cancelled

def _run_loop():
    global _loop
    _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    try:
        _loop.run_until_complete(_serve())
    except Exception as e:
        print(f"[BRIDGE] Server stopped: {e}")

def start_bridge_thread() -> threading.Thread:
    """Start the bridge in a daemon thread. Safe to call from Tkinter startup."""
    t = threading.Thread(target=_run_loop, daemon=True, name="jarvis-bridge")
    t.start()
    print("[BRIDGE] Bridge thread started.")
    return t

# ── standalone entry point ────────────────────────────────────────────────────
if __name__ == "__main__":
    print("[BRIDGE] Starting standalone bridge…")
    _run_loop()
