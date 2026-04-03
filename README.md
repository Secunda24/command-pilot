# CommandPilot

CommandPilot is a private, personal device-assistant system with a calm assistant persona named **Echo**.

This v1 scaffold includes:

- A Tauri-ready Windows desktop shell built with React + TypeScript
- A Jetpack Compose Android companion shell
- A shared TypeScript core for skills, workflows, command planning, safety rules, and demo data
- A local orchestrator service scaffold with SQLite schema and seed bootstrap

## Product Shape

CommandPilot is designed for one trusted owner, not multi-tenant SaaS.

- **Windows desktop app**: primary execution agent for PC tasks
- **Android app**: remote control, approval, notification, and mobile companion
- **Shared orchestrator**: command parsing, planning, routing, safety, and activity logging

## Repo Layout

```text
commandpilot/
  apps/
    android/                 # Kotlin + Jetpack Compose companion app
    desktop/                 # Tauri-ready React + TypeScript desktop shell
  packages/
    core/                    # Shared domain types, skill registry, planner, demo seeds, Echo voice model
  services/
    local-orchestrator/      # Local service scaffold, SQLite schema, adapters, in-memory repo
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

### Run the desktop app

```bash
npm run dev:desktop
```

### Build the desktop frontend

```bash
npm run build:desktop
```

## Local Orchestrator

The orchestrator is intentionally modular.

- `packages/core` contains command planning and Echo's tone-aware messaging
- `services/local-orchestrator` contains the local service scaffold, adapters, and SQLite schema
- `services/local-orchestrator/src/db/schema.sql` is the source of truth for local persistence

## OpenAI Responses API

CommandPilot can use OpenAI's Responses API on the local bridge so Echo can interpret natural language and answer non-execution chat without exposing your API key in the browser.

1. Copy `.env.example` to `.env`
2. Set `OPENAI_API_KEY`
3. Optionally change `OPENAI_MODEL` if you want something other than `gpt-5-mini`

Example:

```powershell
Copy-Item .env.example .env
```

```dotenv
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5-mini
```

How it works:

- The desktop app sends your raw command plus recent conversation to the local bridge
- The local bridge calls OpenAI's Responses API with `store: false`
- Echo either returns a short conversational reply or normalizes the request into a canonical CommandPilot command
- The existing local planner, safety rules, approvals, and runtime bridge still execute the action
- If no API key is configured, CommandPilot falls back to the local planner automatically

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

## Voice Support

Voice is designed as a provider abstraction for v1:

- Desktop: browser/system speech synthesis placeholder
- Android: device TTS placeholder
- Future: premium provider hook without reworking the UI

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
