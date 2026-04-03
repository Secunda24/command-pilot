export const quickCommands = [
  {
    label: "FlowPilot",
    command: "Echo, open FlowPilot",
    description: "Launch the FlowPilot workspace."
  },
  {
    label: "Clientflow",
    command: "Echo, open Clientflow",
    description: "Launch the Clientflow portal."
  },
  {
    label: "Clientflow Approvals",
    command: "Echo, open Clientflow approvals",
    description: "Open the Clientflow request queue."
  },
  {
    label: "FlowPilot Jobs",
    command: "Echo, open FlowPilot jobs",
    description: "Open the FlowPilot jobs board."
  },
  {
    label: "Gmail Inbox",
    command: "Echo, open Gmail inbox in Chrome",
    description: "Run Chrome task for inbox view."
  },
  {
    label: "Maps Search",
    command: "Echo, open maps for Secunda Mall in Chrome",
    description: "Run Chrome task for map search."
  },
  {
    label: "Echo Test Folder",
    command: "Echo, open the Echo Test Folder on my Desktop",
    description: "Create and open the desktop test folder."
  },
  {
    label: "List Test Folder",
    command: "Echo, show me the contents of the Echo Test Folder",
    description: "See the current test files and folders."
  },
  {
    label: "Work Setup",
    command: "Echo, open my work setup",
    description: "Launch the weekday desktop stack."
  },
  {
    label: "Today's Priorities",
    command: "Echo, show me today's priorities",
    description: "Summarize the priorities file and send it to mobile."
  },
  {
    label: "PromptPilot",
    command: "Echo, open PromptPilot Studio",
    description: "Open the custom local app page."
  },
  {
    label: "Content Mode",
    command: "Echo, start content mode",
    description: "Bring creative apps and reminders online."
  }
] as const;

export interface AppCommandPack {
  appKey: string;
  appName: string;
  description: string;
  commands: Array<{
    label: string;
    command: string;
  }>;
}

export const appCommandPacks: AppCommandPack[] = [
  {
    appKey: "clientflow",
    appName: "Clientflow",
    description: "Client operations and approvals.",
    commands: [
      { label: "Open App", command: "Echo, open Clientflow" },
      { label: "Open Approvals", command: "Echo, open Clientflow approvals" },
      { label: "Status", command: "Echo, is Clientflow running" }
    ]
  },
  {
    appKey: "flowpilot",
    appName: "FlowPilot",
    description: "Jobs, dispatch, and workflow ops.",
    commands: [
      { label: "Open App", command: "Echo, open FlowPilot" },
      { label: "Open Jobs", command: "Echo, open FlowPilot jobs" },
      { label: "Status", command: "Echo, is FlowPilot running" }
    ]
  },
  {
    appKey: "fieldops",
    appName: "FieldOps",
    description: "Field ops dispatch and technicians.",
    commands: [
      { label: "Open App", command: "Echo, open FieldOps" },
      { label: "Open Dispatch", command: "Echo, open FieldOps dispatch" },
      { label: "Status", command: "Echo, is FieldOps running" }
    ]
  },
  {
    appKey: "accounting",
    appName: "Accounting",
    description: "Bookkeeping and finance workspace.",
    commands: [
      { label: "Open App", command: "Echo, open Accounting" },
      { label: "Run Invoice Summary", command: "Echo, run invoice summary" },
      { label: "Status", command: "Echo, is Accounting running" }
    ]
  },
  {
    appKey: "maps",
    appName: "Maps",
    description: "Street finder and map lookup.",
    commands: [
      { label: "Open App", command: "Echo, open Maps" },
      { label: "Open in Chrome", command: "Echo, open google maps in chrome" },
      { label: "Status", command: "Echo, is Maps running" }
    ]
  }
];

export const supportedDemoCommands = [
  "Echo, open the Echo Test Folder on my Desktop",
  "Echo, show me the contents of the Echo Test Folder",
  "Echo, create a folder called Notes Archive in the Echo Test Folder",
  "Echo, create a note called voice-test in the Echo Test Folder",
  "Echo, open the file welcome.txt in the Echo Test Folder",
  "Echo, open FlowPilot",
  "Echo, open FlowPilot jobs",
  "Echo, open FlowPilot dispatch",
  "Echo, open Clientflow",
  "Echo, open Clientflow approvals",
  "Echo, open Clientflow invoices",
  "Echo, open FieldOps",
  "Echo, open FieldOps dispatch",
  "Echo, open FieldOps technicians",
  "Echo, open Accounting",
  "Echo, open Maps",
  "Echo, open Gmail inbox in Chrome",
  "Echo, open Google Calendar today in Chrome",
  "Echo, open maps for Secunda Mall in Chrome",
  "Echo, open ChatGPT Codex in Chrome",
  "Echo, open Gmail in Chrome",
  "Echo, Chrome search for project timeline template",
  "Echo, type into chrome hello team and press enter",
  "Echo, is FlowPilot running",
  "Echo, open my work setup",
  "Echo, show me today's priorities",
  "Echo, find the latest invoice for Acme",
  "Echo, open PromptPilot Studio",
  "Echo, run invoice summary",
  "Echo, start content mode",
  "Echo, notify me when this finishes",
  "Echo, run my bank export workflow",
  "Echo, open the latest client file and summarize it",
  "Echo, run month-end pack"
] as const;
