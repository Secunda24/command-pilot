# CommandPilot

CommandPilot is a private, personal device-assistant system with a calm assistant persona named **Echo**.
It is now wired for **local-first AI by default**, using **Ollama on your own Windows machine** so the core experience can run without token spend.

This v1 scaffold includes:

- A Tauri-ready Windows desktop shell built with React + TypeScript
- A Jetpack Compose Android companion shell
- A mobile-web remote UI for phone/tablet/browser control
- A shared TypeScript core for skills, workflows, command planning, safety rules, and demo data
- A local orchestrator service scaffold with SQLite schema and seed bootstrap
- A relay service + PC agent bundle for remote command delivery

## Product Shape

CommandPilot is designed for one trusted owner, not multi-tenant SaaS.

- **Windows desktop app**: primary execution agent for PC tasks
- **Android app**: remote control, approval, notification, and mobile companion
- **Mobile web remote app**: browser-based control from any device
- **Shared orchestrator**: command parsing, planning, routing, safety, and activity logging
- **Remote relay + PC agent**: internet bridge for phone/browser command routing

## Cost Model

CommandPilot is configured to avoid token expenses by default.

- **Desktop + local bridge + PC agent** run on your own machine.
- **Ollama** handles local AI inference on your PC.
- **Render** only hosts the relay and mobile web UI so your phone can reach your PC.
- **OpenAI is optional** and only used if you explicitly change `COMMANDPILOT_AI_PROVIDER=openai`.

## Repo Layout

```text
commandpilot/
  apps/
    android/                 # Kotlin + Jetpack Compose companion app
    desktop/                 # Tauri-ready React + TypeScript desktop shell
    mobile-remote/           # Mobile web remote UI (phone/tablet/browser)
  packages/
    core/                    # Shared domain types, skill registry, planner, demo seeds, Echo voice model
  services/
    local-orchestrator/      # Local service scaffold, SQLite schema, adapters, in-memory repo
    remote-relay/            # WebSocket relay server for remote device access
    remote-agent/            # PC-side Python agent bundle used by remote relay
  docs/
    architecture.md          # System responsibilities and future expansion notes
```

## MVP Coverage

The scaffold covers the requested v1 building blocks:

- Echo persona with a calm, premium assistant voice
- Windows dashboard, command center, running tasks, approvals, activity log, settings, skills, and pairing pages
- Android home, command, notifications, approvals, and settings shell screens
- Modular skill registry for the ten requested MVP skills
- Safety model with `safe`, `notice`, `confirm`, and `restricted`
- Approval handling flow in the desktop UI
- Local SQLite schema for commands, steps, approvals, skills, workflows, devices, notifications, settings, and activity logs
- Demo workflows and seeded command history
- Voice abstraction settings for local/system speech in v1

## Demo Commands

These are wired into the planner and seeded demo flows:

1. `Echo, open my work setup`
2. `Echo, show me today's priorities`
3. `Echo, find the latest invoice for Acme`
4. `Echo, open PromptPilot Studio`
5. `Echo, run invoice summary`
6. `Echo, start content mode`
7. `Echo, notify me when this finishes`
8. `Echo, run my bank export workflow`
9. `Echo, open the latest client file and summarize it`
10. `Echo, run month-end pack`

Extra desktop control commands now available:

- `Echo, open Gmail in Chrome`
- `Echo, Chrome search for commandpilot roadmap`
- `Echo, create folder at C:\Users\angel\Downloads\EchoScratch`
- `Echo, create file at C:\Users\angel\Downloads\EchoScratch\notes`
- `Echo, type into chrome hello team and press enter`

## Desktop Setup

### Prerequisites

- Node.js 20.x
- npm 10.x
- Rust toolchain
- Tauri prerequisites for Windows

### Install

```bash
npm install
```

### Configure local Ollama mode

Copy `.env.example` to `.env` and keep the default local values:

```powershell
Copy-Item .env.example .env
```

Default local-first config:

```dotenv
COMMANDPILOT_AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5-coder:7b
```

Install Ollama, then pull the default model once:

```bash
ollama pull qwen2.5-coder:7b
```

### Launch CommandPilot from your desktop

CommandPilot now includes a Windows launcher that:

- starts Ollama if available
- builds the desktop frontend if needed
- starts the local bridge
- opens the built desktop app in its own app-style window

```bash
npm run launch:desktop
```

To create a real desktop shortcut:

```bash
npm run install:desktop-shortcut
```

After that, you can launch `CommandPilot` directly from your Windows desktop.

### Developer mode

```bash
npm run dev:desktop
npm run dev:bridge
```

## Local Orchestrator

The orchestrator is intentionally modular.

- `packages/core` contains command planning and Echo's tone-aware messaging
- `services/local-orchestrator` contains the local service scaffold, adapters, and SQLite schema
- `services/local-orchestrator/src/db/schema.sql` is the source of truth for local persistence

## AI Runtime

CommandPilot now defaults to **local Ollama mode**.

How it works:

- The desktop app sends your raw command plus recent conversation to the local bridge.
- The local bridge asks your local Ollama runtime to interpret the request.
- Echo either returns a short conversational reply or normalizes the request into a canonical CommandPilot command.
- The existing planner, safety rules, approvals, and runtime bridge still execute the action.
- The Settings page shows whether Ollama is online, which model is selected, and whether the model is already pulled.

### Optional paid cloud mode

Only enable this if you intentionally want cloud inference:

```dotenv
COMMANDPILOT_AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5-mini
```

If you leave `COMMANDPILOT_AI_PROVIDER=ollama`, CommandPilot stays in local-only mode and does not fall back to OpenAI automatically.

To run the demo bootstrap after installing dependencies:

```bash
npm run seed:demo
```

## Android Setup

### Prerequisites

- Android Studio
- Android SDK 35
- JDK 17

### Open the mobile app

Open `apps/android` in Android Studio and sync Gradle.

## Mobile Web Remote (Any Device)

The `apps/mobile-remote` UI can be opened on any phone, tablet, or desktop browser once the relay is running.

### Relay deployment

The repo root now includes a Render Blueprint file:

- `render.yaml`
- `services/remote-relay/src/server.js`

Deploy that web service to Render and set the relay `AUTH_TOKEN`.
This service does **not** run the model. It only relays commands between your phone and your PC.

### Render deployment flow

1. Push this repo to GitHub.
2. Create a new Render Blueprint or Web Service from the repo.
3. Use the root `render.yaml`.
4. Let Render generate `AUTH_TOKEN`.
5. Copy the final Render URL into your PC agent as `RELAY_URL`.

### PC agent

Run the Python agent from `services/remote-agent` on your Windows machine:

```bash
python services/remote-agent/pc_agent.py
```

Use environment variables to configure:

- `RELAY_URL` (e.g. `wss://your-relay-url.onrender.com`)
- `AUTH_TOKEN`
- `COMMANDPILOT_BRIDGE_URL` (optional, default `http://127.0.0.1:8787`)
- `OLLAMA_MODEL` (optional, default `qwen2.5-coder:7b`)

The PC agent now calls `POST /api/command/execute` on the local bridge first, so mobile and desktop run through the same planner and runtime actions.

## Voice Support

Voice currently supports:

- Desktop: browser/system speech synthesis
- Mobile web remote: Web Speech API mic input + spoken replies toggle
- PC agent: Windows SAPI voice profile (Volume 100 / Rate 0) with `pyttsx3` fallback

Settings already include:

- Voice on/off
- Mute/unmute
- Speech rate
- Tone preset placeholder
- Premium provider placeholder

## Safety Notes

- Chrome website opens are now constrained by a trusted website allowlist.
- If a site is outside the allowlist, Echo pauses and explains why.
- Typing commands now include guardrails for oversized payloads and command-like text with Enter.
- Runtime safety settings (approved folders, trusted websites, approved linked apps) can now be edited in the Desktop Settings page and are synced through the local bridge.

## App Command Packs

Dashboard now includes command packs for linked apps so you can one-tap:

- Open app
- Open key route/action
- Check running status

## Chrome Task Engine v1

Echo now supports structured Chrome task templates (domain-aware + allowlist-gated), for example:

- `Echo, open Gmail inbox in Chrome`
- `Echo, open Google Calendar today in Chrome`
- `Echo, open maps for Secunda Mall in Chrome`
- `Echo, open ChatGPT Codex in Chrome`

If a host is not on your trusted list, Echo pauses with a clear safety message.

## Current Validation Notes

This environment allowed scaffolding and structural validation, but not full native runtime validation yet.

- The React/Tauri shell is scaffolded and wired to shared planner logic
- The Android Compose app is scaffolded with the requested companion screens
- Full validation still depends on installing JavaScript dependencies plus local Rust/Android SDK tooling

## Next Steps

Recommended next milestones after dependency install:

1. Wire the local orchestrator into a real Fastify/FastAPI websocket bridge.
2. Add actual Windows adapters for launching approved apps, folders, and scripts.
3. Connect Android notifications and approval callbacks over websocket.
4. Persist live command history into SQLite instead of demo memory state.
5. Plug local speech recognition and TTS into the voice settings layer.
