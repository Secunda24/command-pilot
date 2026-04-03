import type { SkillDefinition } from "../types/domain";

export const skillCatalog: SkillDefinition[] = [
  {
    key: "open_app",
    name: "Open App",
    description: "Launches a registered desktop app or linked local workspace on Windows.",
    parameters: [
      {
        key: "appName",
        label: "App Name",
        type: "string",
        required: true,
        description: "The approved app to launch.",
        placeholder: "PromptPilot Studio"
      }
    ],
    safetyLevel: "safe",
    executionTarget: "pc",
    requiresApproval: false,
    executionMode: "direct",
    tags: ["desktop", "launcher", "workspace"],
    demoHandler: "desktop.launchApp"
  },
  {
    key: "check_app_status",
    name: "Check App Status",
    description: "Checks whether a linked app is already running on the local machine.",
    parameters: [
      {
        key: "appName",
        label: "App Name",
        type: "string",
        required: true,
        description: "The linked app to inspect.",
        placeholder: "FlowPilot"
      }
    ],
    safetyLevel: "notice",
    executionTarget: "pc",
    requiresApproval: false,
    executionMode: "analysis",
    tags: ["desktop", "launcher", "status"],
    demoHandler: "desktop.checkAppStatus"
  },
  {
    key: "open_website",
    name: "Open Website",
    description: "Opens a trusted website in the browser.",
    parameters: [
      {
        key: "url",
        label: "Website URL",
        type: "url",
        required: true,
        description: "A trusted website URL.",
        placeholder: "https://mail.google.com"
      }
    ],
    safetyLevel: "safe",
    executionTarget: "pc",
    requiresApproval: false,
    executionMode: "browser",
    tags: ["browser", "trusted-sites"],
    demoHandler: "desktop.openWebsite"
  },
  {
    key: "open_folder",
    name: "Open Folder",
    description: "Opens an approved folder on Windows.",
    parameters: [
      {
        key: "path",
        label: "Folder Path",
        type: "path",
        required: true,
        description: "A path inside an approved location.",
        placeholder: "C:\\Users\\angel\\Documents\\Clients"
      }
    ],
    safetyLevel: "safe",
    executionTarget: "pc",
    requiresApproval: false,
    executionMode: "direct",
    tags: ["desktop", "files", "approved-paths"],
    demoHandler: "desktop.openFolder"
  },
  {
    key: "open_file",
    name: "Open File",
    description: "Opens a file inside an approved root on Windows.",
    parameters: [
      {
        key: "path",
        label: "File Path",
        type: "path",
        required: true,
        description: "The file path to open.",
        placeholder: "C:\\Users\\angel\\OneDrive\\Desktop\\Echo Test Folder\\Notes\\welcome.txt"
      }
    ],
    safetyLevel: "safe",
    executionTarget: "pc",
    requiresApproval: false,
    executionMode: "direct",
    tags: ["desktop", "files", "approved-paths"],
    demoHandler: "desktop.openFile"
  },
  {
    key: "list_folder_contents",
    name: "List Folder Contents",
    description: "Lists the files and folders inside an approved folder.",
    parameters: [
      {
        key: "path",
        label: "Folder Path",
        type: "path",
        required: true,
        description: "The folder to inspect.",
        placeholder: "C:\\Users\\angel\\OneDrive\\Desktop\\Echo Test Folder"
      }
    ],
    safetyLevel: "notice",
    executionTarget: "pc",
    requiresApproval: false,
    executionMode: "analysis",
    tags: ["desktop", "files", "directory-listing"],
    demoHandler: "desktop.listFolderContents"
  },
  {
    key: "create_folder",
    name: "Create Folder",
    description: "Creates a folder inside an approved root.",
    parameters: [
      {
        key: "path",
        label: "Folder Path",
        type: "path",
        required: true,
        description: "The folder path to create.",
        placeholder: "C:\\Users\\angel\\OneDrive\\Desktop\\Echo Test Folder\\Projects"
      }
    ],
    safetyLevel: "safe",
    executionTarget: "pc",
    requiresApproval: false,
    executionMode: "direct",
    tags: ["desktop", "files", "create"],
    demoHandler: "desktop.createFolder"
  },
  {
    key: "create_text_file",
    name: "Create Text File",
    description: "Creates a text or Word-compatible file inside an approved root.",
    parameters: [
      {
        key: "path",
        label: "File Path",
        type: "path",
        required: true,
        description: "The file path to create.",
        placeholder: "C:\\Users\\angel\\OneDrive\\Desktop\\Echo Test Folder\\Notes\\ideas.txt"
      },
      {
        key: "content",
        label: "File Content",
        type: "string",
        required: false,
        description: "Optional initial content for the file.",
        placeholder: "Echo created this note."
      }
    ],
    safetyLevel: "safe",
    executionTarget: "pc",
    requiresApproval: false,
    executionMode: "direct",
    tags: ["desktop", "files", "create"],
    demoHandler: "desktop.createTextFile"
  },
  {
    key: "type_text",
    name: "Type Text",
    description: "Types or pastes dictated text into the active desktop window.",
    parameters: [
      {
        key: "text",
        label: "Text",
        type: "string",
        required: true,
        description: "The text to type into the active window.",
        placeholder: "Hello Angel, your workspace is ready."
      }
    ],
    safetyLevel: "safe",
    executionTarget: "pc",
    requiresApproval: false,
    executionMode: "direct",
    tags: ["desktop", "typing", "voice"],
    demoHandler: "desktop.typeText"
  },
  {
    key: "find_file",
    name: "Find File",
    description: "Searches approved folders for the best matching file.",
    parameters: [
      {
        key: "query",
        label: "Query",
        type: "string",
        required: true,
        description: "Search text such as a client name or document type.",
        placeholder: "Acme invoice"
      }
    ],
    safetyLevel: "notice",
    executionTarget: "pc",
    requiresApproval: false,
    executionMode: "analysis",
    tags: ["search", "documents", "desktop"],
    demoHandler: "desktop.findFile"
  },
  {
    key: "run_script",
    name: "Run Script",
    description: "Runs a configured local script or workflow wrapper.",
    parameters: [
      {
        key: "scriptKey",
        label: "Script Key",
        type: "enum",
        required: true,
        description: "A configured script identifier.",
        options: ["invoice-summary", "month-end-prep", "daily-priorities"]
      }
    ],
    safetyLevel: "confirm",
    executionTarget: "pc",
    requiresApproval: true,
    executionMode: "script",
    tags: ["automation", "script", "desktop"],
    demoHandler: "desktop.runScript"
  },
  {
    key: "run_power_automate_flow",
    name: "Run Power Automate Flow",
    description: "Triggers a pre-approved Power Automate desktop flow.",
    parameters: [
      {
        key: "flowName",
        label: "Flow Name",
        type: "string",
        required: true,
        description: "The configured Power Automate flow to launch.",
        placeholder: "bank-export"
      }
    ],
    safetyLevel: "confirm",
    executionTarget: "pc",
    requiresApproval: true,
    executionMode: "power_automate",
    tags: ["power-automate", "desktop", "finance"],
    demoHandler: "desktop.runPowerAutomateFlow"
  },
  {
    key: "send_phone_notification",
    name: "Send Phone Notification",
    description: "Sends a result, alert, or approval event to the paired Android device.",
    parameters: [
      {
        key: "message",
        label: "Message",
        type: "string",
        required: true,
        description: "The notification payload to send.",
        placeholder: "Invoice summary is ready."
      }
    ],
    safetyLevel: "notice",
    executionTarget: "android",
    requiresApproval: false,
    executionMode: "direct",
    tags: ["android", "notifications", "paired-device"],
    demoHandler: "android.sendNotification"
  },
  {
    key: "create_reminder_placeholder",
    name: "Create Reminder Placeholder",
    description: "Creates a reminder placeholder that can later connect to mobile reminders or calendar.",
    parameters: [
      {
        key: "title",
        label: "Reminder Title",
        type: "string",
        required: true,
        description: "Reminder title.",
        placeholder: "Send the invoice by 15:00"
      }
    ],
    safetyLevel: "safe",
    executionTarget: "android",
    requiresApproval: false,
    executionMode: "direct",
    tags: ["android", "reminder", "future-ready"],
    demoHandler: "android.createReminder"
  },
  {
    key: "summarize_text_file",
    name: "Summarize Text File",
    description: "Reads supported text content and returns a concise summary.",
    parameters: [
      {
        key: "path",
        label: "File Path",
        type: "path",
        required: true,
        description: "The text file to summarize.",
        placeholder: "C:\\Users\\angel\\Documents\\priorities.md"
      }
    ],
    safetyLevel: "notice",
    executionTarget: "either",
    requiresApproval: false,
    executionMode: "analysis",
    tags: ["summary", "analysis", "documents"],
    demoHandler: "service.summarizeTextFile"
  },
  {
    key: "launch_custom_app_page",
    name: "Launch Custom App Page",
    description: "Opens a custom local app, dashboard, or route.",
    parameters: [
      {
        key: "destination",
        label: "Destination",
        type: "string",
        required: true,
        description: "Configured app shortcut or page key.",
        placeholder: "PromptPilot Studio"
      }
    ],
    safetyLevel: "safe",
    executionTarget: "pc",
    requiresApproval: false,
    executionMode: "direct",
    tags: ["launcher", "custom-app", "desktop"],
    demoHandler: "desktop.launchCustomPage"
  }
];
