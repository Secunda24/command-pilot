import { linkedApps, trustedWebsiteRules } from "@commandpilot/core";

export type PageId =
  | "dashboard"
  | "command-center"
  | "running-tasks"
  | "activity-log"
  | "approvals"
  | "skills"
  | "settings"
  | "pairing";

export const navigationItems: Array<{
  id: PageId;
  label: string;
  description: string;
}> = [
  { id: "dashboard", label: "Dashboard", description: "Overview and quick commands" },
  { id: "command-center", label: "Command Center", description: "Chat and execution steps" },
  { id: "running-tasks", label: "Running Tasks", description: "Long-running work and watchers" },
  { id: "activity-log", label: "Activity Log", description: "Timeline of everything Echo touched" },
  { id: "approvals", label: "Approvals", description: "Sensitive actions waiting on you" },
  { id: "skills", label: "Skills & Workflows", description: "Configured actions and bundles" },
  { id: "settings", label: "Settings", description: "Voice, trust boundaries, and preferences" },
  { id: "pairing", label: "Device Pairing", description: "Trusted phone connection" }
];

export const approvedApps = [
  ...linkedApps.map((app) => app.name),
  "Google Chrome",
  "Adobe Premiere Pro",
  "Power Automate Desktop"
];

export const approvedFolders = [
  "C:\\Users\\angel\\Documents\\Clients",
  "C:\\Users\\angel\\Documents\\Finance",
  "C:\\Users\\angel\\Documents\\Daily"
];

export const trustedWebsites = trustedWebsiteRules.map((rule) => `${rule.label} - ${rule.defaultUrl}`);

export const settingsSections = [
  {
    title: "Assistant",
    description: "Core Echo identity and response behavior.",
    items: ["Assistant name: Echo", "Tone: Calm futuristic", "Zero-token local mode by default"]
  },
  {
    title: "Voice",
    description: "v1 local/system speech controls with future upgrade placeholders.",
    items: ["Local TTS enabled", "Speech rate adjustable", "No cloud speech dependency required"]
  },
  {
    title: "Trust Boundaries",
    description: "Approved routes Echo can use without leaving the safe lane.",
    items: ["Approved folders", "Approved desktop apps", "Trusted websites", "Chrome safe mode allowlist"]
  }
];

export const pairingChecklist = [
  "Start the remote relay and copy your AUTH_TOKEN.",
  "Open the mobile remote URL on any phone, tablet, or browser.",
  "Enter your token and wait for the PC agent to connect.",
  "Render only hosts the relay and mobile UI. The AI still runs locally on your PC through Ollama.",
  "Echo will sync remote commands, approvals, and live status updates."
];

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
