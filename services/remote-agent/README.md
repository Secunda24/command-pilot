# CommandPilot Remote PC Agent

Run this agent on your Windows PC to connect the mobile remote UI (via relay) to your local machine.
The agent now routes commands through the local CommandPilot bridge first, so desktop and mobile use one execution engine.

## Files

- `pc_agent.py`: Relay-connected command executor.
- `jarvis_skills.py`: Local command/skill routing.
- `jarvis_core.py`: Optional wake-word local voice loop.
- `jarvis_ui.py` and `jarvis_ui_v5.py`: Optional desktop visual voice UI variants.
- `jarvis_bridge.py`: Optional local WebSocket bridge used by the Tkinter UI.

## Quick start

1. Install Python dependencies:

```bash
pip install websockets
pip install ollama
pip install pyttsx3
```

2. Set environment variables:

```powershell
set RELAY_URL=wss://your-relay-host.onrender.com
set AUTH_TOKEN=your-shared-token
set COMMANDPILOT_BRIDGE_URL=http://127.0.0.1:8787
set OLLAMA_MODEL=gemma:2b
```

3. Start the agent:

```bash
python pc_agent.py
```

Keep the process running while you use the mobile remote app.
