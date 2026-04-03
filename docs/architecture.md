# CommandPilot Architecture

## Core Principles

- Personal-use only in v1
- Local-first execution
- Direct integrations before UI automation
- Safety visibility before convenience
- Shared domain model across Windows and Android

## Module Responsibilities

### `packages/core`

Shared contracts and logic used by both the desktop UI and local orchestrator:

- Domain types
- Skill registry
- Workflow catalog
- Command planner
- Echo persona and voice settings
- Demo seed data

### `services/local-orchestrator`

Local execution brain and persistence boundary:

- Planner entrypoint
- Adapter interfaces for Windows, Android, and analysis actions
- In-memory repository for demo mode
- SQLite schema for future persistent storage
- Seed bootstrap for smoke/demo flows

### `apps/desktop`

Primary execution interface for the Windows machine:

- Dashboard
- Command center
- Running tasks
- Approvals
- Activity log
- Skills/workflows explorer
- Settings
- Device pairing view

### `apps/android`

Remote control and trust companion:

- Quick commands
- Command/voice placeholder view
- Notifications
- Approvals
- Settings

## Safety Flow

1. User submits a command
2. Planner interprets the intent
3. Skills and workflows are selected
4. Safety level is inferred from the planned steps
5. Any `confirm` step pauses in the approval queue
6. Approval events surface on desktop and mobile
7. Execution continues or stops cleanly

## Upgrade Path

The scaffold is prepared for later additions:

- Better model-based reasoning
- Real websocket sync between devices
- Browser automation
- UI automation / computer use
- Calendar, email, and message integrations
- Premium voice provider routing
- Cloud sync if desired later
