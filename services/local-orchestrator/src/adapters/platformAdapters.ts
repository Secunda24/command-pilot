export interface DesktopAdapter {
  launchApp(name: string): Promise<string>;
  checkAppStatus(name: string): Promise<string>;
  openWebsite(url: string): Promise<string>;
  openFolder(path: string): Promise<string>;
  runScript(scriptKey: string): Promise<string>;
  runPowerAutomateFlow(flowName: string): Promise<string>;
}

export interface AndroidAdapter {
  sendNotification(message: string): Promise<string>;
  createReminder(title: string): Promise<string>;
}

export interface AnalysisAdapter {
  summarizeFile(path: string): Promise<string>;
}

export interface PlatformAdapters {
  desktop: DesktopAdapter;
  android: AndroidAdapter;
  analysis: AnalysisAdapter;
}

export function createDemoAdapters(): PlatformAdapters {
  return {
    desktop: {
      async launchApp(name) {
        return `Launched ${name}`;
      },
      async checkAppStatus(name) {
        return `Checked ${name} status`;
      },
      async openWebsite(url) {
        return `Opened ${url}`;
      },
      async openFolder(path) {
        return `Opened ${path}`;
      },
      async runScript(scriptKey) {
        return `Ran script ${scriptKey}`;
      },
      async runPowerAutomateFlow(flowName) {
        return `Triggered Power Automate flow ${flowName}`;
      }
    },
    android: {
      async sendNotification(message) {
        return `Sent Android notification: ${message}`;
      },
      async createReminder(title) {
        return `Created reminder placeholder: ${title}`;
      }
    },
    analysis: {
      async summarizeFile(path) {
        return `Summarized ${path}`;
      }
    }
  };
}
