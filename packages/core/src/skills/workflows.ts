import type { WorkflowDefinition } from "../types/domain";

export const workflowCatalog: WorkflowDefinition[] = [
  {
    id: "work-setup",
    name: "Open My Work Setup",
    description: "Launches the default work stack for the day.",
    tags: ["focus", "workspace", "desktop"],
    status: "ready",
    promptExamples: ["Echo, open my work setup"],
    steps: [
      {
        id: "work-setup-1",
        title: "Launch PromptPilot Studio",
        description: "Open the user's main client workspace.",
        skillKey: "open_app",
        target: "pc",
        safetyLevel: "safe",
        approvalRequired: false,
        parameters: {
          appName: "PromptPilot Studio"
        }
      },
      {
        id: "work-setup-2",
        title: "Open Gmail",
        description: "Bring the work inbox online.",
        skillKey: "open_website",
        target: "pc",
        safetyLevel: "safe",
        approvalRequired: false,
        parameters: {
          url: "https://mail.google.com"
        }
      },
      {
        id: "work-setup-3",
        title: "Open Client Files",
        description: "Open the approved working folder.",
        skillKey: "open_folder",
        target: "pc",
        safetyLevel: "safe",
        approvalRequired: false,
        parameters: {
          path: "C:\\Users\\angel\\Documents\\Clients"
        }
      }
    ]
  },
  {
    id: "content-mode",
    name: "Start Content Mode",
    description: "Launches the creative app bundle and focus placeholders.",
    tags: ["creative", "focus", "desktop"],
    status: "ready",
    promptExamples: ["Echo, start content mode"],
    steps: [
      {
        id: "content-mode-1",
        title: "Launch editor",
        description: "Open the content workspace application.",
        skillKey: "open_app",
        target: "pc",
        safetyLevel: "safe",
        approvalRequired: false,
        parameters: {
          appName: "Adobe Premiere Pro"
        }
      },
      {
        id: "content-mode-2",
        title: "Open inspiration board",
        description: "Open the trusted moodboard website.",
        skillKey: "open_website",
        target: "pc",
        safetyLevel: "safe",
        approvalRequired: false,
        parameters: {
          url: "https://www.notion.so"
        }
      },
      {
        id: "content-mode-3",
        title: "Create reminder placeholder",
        description: "Set a light reminder to review the export.",
        skillKey: "create_reminder_placeholder",
        target: "android",
        safetyLevel: "safe",
        approvalRequired: false,
        parameters: {
          title: "Review content export in 45 minutes"
        }
      }
    ]
  },
  {
    id: "bank-export",
    name: "Run Bank Export Workflow",
    description: "Triggers the finance export workflow with explicit approval.",
    tags: ["finance", "power-automate", "desktop"],
    status: "ready",
    promptExamples: ["Echo, run my bank export workflow"],
    steps: [
      {
        id: "bank-export-1",
        title: "Confirm finance automation",
        description: "Request approval before running the bank export flow.",
        skillKey: "run_power_automate_flow",
        target: "pc",
        safetyLevel: "confirm",
        approvalRequired: true,
        parameters: {
          flowName: "bank-export"
        }
      },
      {
        id: "bank-export-2",
        title: "Send phone status",
        description: "Notify the paired device when the export starts.",
        skillKey: "send_phone_notification",
        target: "android",
        safetyLevel: "notice",
        approvalRequired: false,
        parameters: {
          message: "Bank export workflow has started on your PC."
        }
      }
    ]
  },
  {
    id: "month-end-pack",
    name: "Run Month-End Pack",
    description: "Runs the multi-step month-end preparation workflow.",
    tags: ["finance", "monthly", "workflow"],
    status: "ready",
    promptExamples: ["Echo, run month-end pack"],
    steps: [
      {
        id: "month-end-1",
        title: "Approve month-end pack",
        description: "Confirm that the month-end workflow can access finance scripts.",
        skillKey: "run_script",
        target: "pc",
        safetyLevel: "confirm",
        approvalRequired: true,
        parameters: {
          scriptKey: "month-end-prep"
        }
      },
      {
        id: "month-end-2",
        title: "Run bank export",
        description: "Collect the latest export from the finance system.",
        skillKey: "run_power_automate_flow",
        target: "pc",
        safetyLevel: "confirm",
        approvalRequired: true,
        parameters: {
          flowName: "bank-export"
        }
      },
      {
        id: "month-end-3",
        title: "Summarize output",
        description: "Produce a concise status summary for the dashboard.",
        skillKey: "summarize_text_file",
        target: "either",
        safetyLevel: "notice",
        approvalRequired: false,
        parameters: {
          path: "C:\\Users\\angel\\Documents\\Finance\\month-end-pack.txt"
        }
      }
    ]
  }
];
