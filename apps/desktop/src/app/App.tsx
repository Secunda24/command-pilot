import { useEffect, useState } from "react";
import {
  autoApproveExecutionResult,
  buildEchoStatus,
  demoSnapshot,
  linkedApps,
  planCommand,
  simulateExecution,
  type ApprovalRecord,
  type CommandExecutionResult,
  type DemoSnapshot,
  type PlannerRuntimeOptions
} from "@commandpilot/core";
import { Sidebar } from "../components/layout/Sidebar";
import { TopBar } from "../components/layout/TopBar";
import type { PageId } from "../data/viewModels";
import { ActivityView } from "./ActivityView";
import { ApprovalsView } from "./ApprovalsView";
import { CommandCenterView } from "./CommandCenterView";
import { DashboardView } from "./DashboardView";
import { PairingView } from "./PairingView";
import { RunningTasksView } from "./RunningTasksView";
import { SettingsView } from "./SettingsView";
import { SkillsView } from "./SkillsView";
import { applyApprovalDecision, pushExecution, updateExecutionFromApproval } from "./state";
import { interpretCommandWithAi } from "../lib/aiBridge";
import {
  executeRuntimeActions,
  fetchRuntimeSafetySettings,
  updateRuntimeSafetySettings,
  type RuntimeSafetySettings
} from "../lib/runtimeBridge";
import { speakEchoPreview, speakEchoReply } from "../lib/voiceTest";
import { useEchoVoiceInput } from "../hooks/useEchoVoiceInput";

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  timestamp: string;
}

const initialExecution = demoSnapshot.runningTasks[0] ?? demoSnapshot.recentCommands[0];
const LOCAL_RUNTIME_SETTINGS_KEY = "commandpilot.runtimeSafetySettings.v1";
const defaultRuntimeSettings: RuntimeSafetySettings = {
  approvedRoots: [
    "C:\\Users\\angel\\OneDrive\\Desktop",
    "C:\\Users\\angel\\OneDrive\\Documentos"
  ],
  trustedWebsiteHosts: [
    "google.com",
    "mail.google.com",
    "calendar.google.com",
    "drive.google.com",
    "docs.google.com",
    "maps.google.com",
    "chatgpt.com",
    "notion.so",
    "app.clickup.com",
    "localhost",
    "127.0.0.1"
  ],
  approvedLinkedAppKeys: linkedApps.map((app) => app.key)
};

function shouldInterpretWithAi(commandText: string): boolean {
  const trimmed = commandText.trim();
  if (!trimmed) {
    return false;
  }

  if (/^(can|could|would|will)\s+(you|u)\b/i.test(trimmed) || /^please\b/i.test(trimmed)) {
    return true;
  }

  if (/^(?:hey\s+)?echo(?:\s+|,\s*)/i.test(trimmed)) {
    return false;
  }

  if (
    /^(open|launch|start|run|create|show|check|find|search|list|type|notify|lock|close|minimize|go)\b/i.test(
      trimmed
    )
  ) {
    return false;
  }

  return (
    /\?$/.test(trimmed) ||
    /^(what|why|how|who|when|where|tell me|explain|help)\b/i.test(trimmed)
  );
}

export function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("dashboard");
  const [snapshot, setSnapshot] = useState<DemoSnapshot>(demoSnapshot);
  const [commandInput, setCommandInput] = useState("Echo, open my work setup");
  const [activeExecution, setActiveExecution] = useState<CommandExecutionResult>(initialExecution);
  const [voiceEnabled, setVoiceEnabled] = useState(demoSnapshot.voice.enabled);
  const [muted, setMuted] = useState(demoSnapshot.voice.muted);
  const [voiceRate, setVoiceRate] = useState(demoSnapshot.voice.rate);
  const [preferredTone, setPreferredTone] = useState("Calm futuristic");
  const [demoAutoApprove, setDemoAutoApprove] = useState(true);
  const [voiceTestStatus, setVoiceTestStatus] = useState(
    "Ready to preview Echo's local/system voice."
  );
  const [voiceCommandStatus, setVoiceCommandStatus] = useState(
    "Click the mic to speak a command to Echo."
  );
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSafetySettings>(
    defaultRuntimeSettings
  );
  const [runtimeSettingsStatus, setRuntimeSettingsStatus] = useState(
    "Loading runtime safety settings..."
  );
  const [conversation, setConversation] = useState<ChatMessage[]>([
    {
      id: "assistant-start",
      role: "assistant",
      text: "CommandPilot is online. Tell me what you want handled, and I'll route it cleanly.",
      timestamp: new Date().toISOString()
    }
  ]);

  const echoStatus = buildEchoStatus(activeExecution.plan, activeExecution.status);
  const {
    supported: voiceCommandSupported,
    listening,
    interimTranscript,
    lastTranscript,
    error: voiceCommandError,
    startListening,
    stopListening,
    clearError: clearVoiceCommandError
  } = useEchoVoiceInput({
    enabled: voiceEnabled,
    onTranscriptChange: (transcript) => {
      if (transcript) {
        setCommandInput(transcript.toLowerCase().startsWith("echo") ? transcript : `Echo, ${transcript}`);
      }
    },
    onTranscriptFinal: async (transcript) => {
      const normalizedTranscript = transcript.toLowerCase().startsWith("echo")
        ? transcript
        : `Echo, ${transcript}`;
      setVoiceCommandStatus(`Heard: "${normalizedTranscript}"`);
      await submitCommand(normalizedTranscript);
    }
  });

  useEffect(() => {
    const cachedSettings = window.localStorage.getItem(LOCAL_RUNTIME_SETTINGS_KEY);
    if (cachedSettings) {
      try {
        const parsed = JSON.parse(cachedSettings) as RuntimeSafetySettings;
        if (
          Array.isArray(parsed.approvedRoots) &&
          Array.isArray(parsed.trustedWebsiteHosts) &&
          Array.isArray(parsed.approvedLinkedAppKeys)
        ) {
          setRuntimeSettings(parsed);
          setRuntimeSettingsStatus("Using cached runtime settings while syncing bridge...");
        }
      } catch {
        setRuntimeSettingsStatus("Local runtime settings cache was invalid. Reloaded defaults.");
      }
    }

    void (async () => {
      try {
        const bridgeSettings = await fetchRuntimeSafetySettings();
        setRuntimeSettings(bridgeSettings);
        window.localStorage.setItem(LOCAL_RUNTIME_SETTINGS_KEY, JSON.stringify(bridgeSettings));
        setRuntimeSettingsStatus("Runtime settings synced with local bridge.");
      } catch {
        setRuntimeSettingsStatus("Bridge settings unavailable. Running with local settings.");
      }
    })();
  }, []);

  async function persistRuntimeSettings(nextSettings: RuntimeSafetySettings) {
    setRuntimeSettings(nextSettings);
    window.localStorage.setItem(LOCAL_RUNTIME_SETTINGS_KEY, JSON.stringify(nextSettings));
    setRuntimeSettingsStatus("Saving runtime settings...");

    try {
      const syncedSettings = await updateRuntimeSafetySettings(nextSettings);
      setRuntimeSettings(syncedSettings);
      window.localStorage.setItem(LOCAL_RUNTIME_SETTINGS_KEY, JSON.stringify(syncedSettings));
      setRuntimeSettingsStatus("Runtime settings synced with local bridge.");
    } catch {
      setRuntimeSettingsStatus("Saved locally. Bridge sync failed, but Echo will still use local settings.");
    }
  }

  async function testVoice() {
    setVoiceTestStatus("Testing Echo's voice...");

    try {
      const voiceName = await speakEchoPreview(voiceRate);
      setVoiceTestStatus(`Echo voice test played using ${voiceName}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Echo's voice preview could not be played.";
      setVoiceTestStatus(message);
    }
  }

  async function deliverEchoReply(text: string) {
    if (!voiceEnabled || muted || !text.trim()) {
      return;
    }

    try {
      const voiceName = await speakEchoReply(text, voiceRate);
      setVoiceTestStatus(`Echo is speaking with ${voiceName}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Echo couldn't play her spoken reply.";
      setVoiceTestStatus(message);
    }
  }

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("voiceTest") !== "1") {
      return;
    }

    void testVoice();

    searchParams.delete("voiceTest");
    const nextQuery = searchParams.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    if (!voiceCommandSupported) {
      setVoiceCommandStatus("Voice commands aren't available in this browser.");
      return;
    }

    if (!voiceEnabled) {
      setVoiceCommandStatus("Voice commands are off. Click the mic to enable them.");
      return;
    }

    if (voiceCommandError) {
      setVoiceCommandStatus(voiceCommandError);
      return;
    }

    if (listening) {
      setVoiceCommandStatus(
        interimTranscript
          ? `Listening... "${interimTranscript}"`
          : "Listening... say a command for Echo."
      );
      return;
    }

    if (lastTranscript) {
      setVoiceCommandStatus(`Last voice command: "${lastTranscript}"`);
      return;
    }

    setVoiceCommandStatus("Click the mic to speak a command to Echo.");
  }, [
    interimTranscript,
    lastTranscript,
    listening,
    voiceCommandError,
    voiceCommandSupported,
    voiceEnabled
  ]);

  const plannerOptions: PlannerRuntimeOptions = {
    approvedRoots: runtimeSettings.approvedRoots,
    trustedWebsiteHosts: runtimeSettings.trustedWebsiteHosts,
    approvedLinkedAppKeys: runtimeSettings.approvedLinkedAppKeys
  };

  function normalizeWebsiteHostInput(input: string): string {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) {
      return "";
    }

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      return new URL(withProtocol).hostname.replace(/^www\./, "");
    } catch {
      return trimmed.replace(/^www\./, "");
    }
  }

  function addApprovedFolder(path: string) {
    const normalizedPath = path.trim();
    if (!normalizedPath) {
      return;
    }

    if (runtimeSettings.approvedRoots.includes(normalizedPath)) {
      return;
    }

    void persistRuntimeSettings({
      ...runtimeSettings,
      approvedRoots: [...runtimeSettings.approvedRoots, normalizedPath]
    });
  }

  function removeApprovedFolder(path: string) {
    const nextRoots = runtimeSettings.approvedRoots.filter((root) => root !== path);
    if (nextRoots.length === 0) {
      setRuntimeSettingsStatus("At least one approved folder is required.");
      return;
    }

    void persistRuntimeSettings({
      ...runtimeSettings,
      approvedRoots: nextRoots
    });
  }

  function addTrustedWebsiteHost(host: string) {
    const normalizedHost = normalizeWebsiteHostInput(host);
    if (!normalizedHost) {
      return;
    }

    if (runtimeSettings.trustedWebsiteHosts.includes(normalizedHost)) {
      return;
    }

    void persistRuntimeSettings({
      ...runtimeSettings,
      trustedWebsiteHosts: [...runtimeSettings.trustedWebsiteHosts, normalizedHost]
    });
  }

  function removeTrustedWebsiteHost(host: string) {
    const nextHosts = runtimeSettings.trustedWebsiteHosts.filter((entry) => entry !== host);
    if (nextHosts.length === 0) {
      setRuntimeSettingsStatus("At least one trusted website is required.");
      return;
    }

    void persistRuntimeSettings({
      ...runtimeSettings,
      trustedWebsiteHosts: nextHosts
    });
  }

  function toggleApprovedApp(appKey: string) {
    const enabled = runtimeSettings.approvedLinkedAppKeys.includes(appKey);
    const nextKeys = enabled
      ? runtimeSettings.approvedLinkedAppKeys.filter((key) => key !== appKey)
      : [...runtimeSettings.approvedLinkedAppKeys, appKey];

    if (nextKeys.length === 0) {
      setRuntimeSettingsStatus("At least one approved app is required.");
      return;
    }

    void persistRuntimeSettings({
      ...runtimeSettings,
      approvedLinkedAppKeys: nextKeys
    });
  }

  async function submitCommand(commandText: string) {
    const trimmedCommand = commandText.trim();
    if (!trimmedCommand) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      text: trimmedCommand,
      timestamp: new Date().toISOString()
    };
    const aiConversation = conversation
      .slice(-6)
      .map(({ role, text }) => ({ role, text }));
    const aiResponse = shouldInterpretWithAi(trimmedCommand)
      ? await interpretCommandWithAi(trimmedCommand, aiConversation)
      : null;

    if (aiResponse?.interpretation.mode === "respond") {
      const assistantReply = aiResponse.interpretation.assistantReply;
      setConversation((previous) => [
        ...previous,
        userMessage,
        {
          id: `assistant-${Date.now() + 1}`,
          role: "assistant",
          text: assistantReply,
          timestamp: new Date().toISOString()
        }
      ]);
      setCommandInput("");
      setCurrentPage("command-center");
      void deliverEchoReply(assistantReply);
      return;
    }

    const commandToExecute =
      aiResponse?.interpretation.mode === "execute" &&
      aiResponse.interpretation.normalizedCommand
        ? aiResponse.interpretation.normalizedCommand
        : trimmedCommand;

    const simulatedResult = simulateExecution(planCommand(commandToExecute, plannerOptions));
    const preparedResult =
      demoAutoApprove && simulatedResult.status === "awaiting_approval"
        ? autoApproveExecutionResult(simulatedResult, simulatedResult.plan.echo.success)
        : simulatedResult;
    const result = await executeRuntimeActions(preparedResult);
    setActiveExecution(result);
    setSnapshot((previous) => pushExecution(previous, result));
    setConversation((previous) => [
      ...previous,
      userMessage,
      {
        id: `assistant-${Date.now() + 1}`,
        role: "assistant",
        text: result.echoMessage,
        timestamp: new Date().toISOString()
      }
    ]);
    setCommandInput("");
    setCurrentPage("command-center");
    void deliverEchoReply(result.echoMessage);
  }

  async function resolveApproval(approval: ApprovalRecord, decision: "approved" | "denied") {
    const fallbackMessage =
      decision === "approved"
        ? "Approved. I've resumed and finished the task."
        : "Understood. I stopped that task and logged the denial.";
    const pendingExecution =
      activeExecution.plan.id === approval.commandId
        ? activeExecution
        : snapshot.recentCommands.find((result) => result.plan.id === approval.commandId) ?? null;

    if (decision === "approved" && pendingExecution) {
      const resumedExecution = updateExecutionFromApproval(pendingExecution, decision, fallbackMessage);
      const runtimeExecution = await executeRuntimeActions(resumedExecution);

      setSnapshot((previous) =>
        applyApprovalDecision(
          previous,
          approval,
          decision,
          runtimeExecution.echoMessage,
          runtimeExecution
        )
      );
      setActiveExecution((previous) =>
        previous.plan.id === approval.commandId ? runtimeExecution : previous
      );
      setConversation((previous) => [
        ...previous,
        {
          id: `assistant-approval-${Date.now()}`,
          role: "assistant",
          text: runtimeExecution.echoMessage,
          timestamp: new Date().toISOString()
        }
      ]);
      void deliverEchoReply(runtimeExecution.echoMessage);
      return;
    }

    setSnapshot((previous) => applyApprovalDecision(previous, approval, decision, fallbackMessage));
    setActiveExecution((previous) =>
      previous.plan.id === approval.commandId
        ? updateExecutionFromApproval(previous, decision, fallbackMessage)
        : previous
    );
    setConversation((previous) => [
      ...previous,
      {
        id: `assistant-approval-${Date.now()}`,
        role: "assistant",
        text: fallbackMessage,
        timestamp: new Date().toISOString()
      }
    ]);
    void deliverEchoReply(fallbackMessage);
  }

  function handleMicAction() {
    if (!voiceCommandSupported) {
      setVoiceCommandStatus("Voice commands aren't available in this browser.");
      return;
    }

    if (!voiceEnabled) {
      setVoiceEnabled(true);
      clearVoiceCommandError();
      setVoiceCommandStatus("Voice commands enabled. Listening now...");
      void startListening();
      return;
    }

    if (listening) {
      stopListening();
      setVoiceCommandStatus("Stopped listening.");
      return;
    }

    clearVoiceCommandError();
    void startListening();
  }

  return (
    <div className="app-shell">
      <div className="background-grid" />
      <Sidebar currentPage={currentPage} onSelect={setCurrentPage} />

      <main className="main-shell">
        <TopBar
          status={echoStatus}
          voiceCommandStatus={voiceCommandStatus}
          approvalCount={snapshot.pendingApprovals.length}
          voiceEnabled={voiceEnabled}
          voiceSupported={voiceCommandSupported}
          listening={listening}
          muted={muted}
          onMicAction={handleMicAction}
          onToggleMute={() => setMuted((value) => !value)}
        />

        {currentPage === "dashboard" && (
          <DashboardView
            snapshot={snapshot}
            commandInput={commandInput}
            approvedAppKeys={runtimeSettings.approvedLinkedAppKeys}
            onCommandInputChange={setCommandInput}
            onSubmitCommand={submitCommand}
            onOpenExecution={(execution) => {
              setActiveExecution(execution);
              setCurrentPage("command-center");
            }}
            onResolveApproval={resolveApproval}
          />
        )}

        {currentPage === "command-center" && (
          <CommandCenterView
            activeExecution={activeExecution}
            commandInput={commandInput}
            conversation={conversation}
            onCommandInputChange={setCommandInput}
            onSubmitCommand={submitCommand}
          />
        )}

        {currentPage === "running-tasks" && <RunningTasksView snapshot={snapshot} />}
        {currentPage === "activity-log" && <ActivityView snapshot={snapshot} />}
        {currentPage === "approvals" && <ApprovalsView snapshot={snapshot} onResolveApproval={resolveApproval} />}
        {currentPage === "skills" && <SkillsView snapshot={snapshot} />}
        {currentPage === "settings" && (
          <SettingsView
            voiceEnabled={voiceEnabled}
            muted={muted}
            voiceRate={voiceRate}
            preferredTone={preferredTone}
            demoAutoApprove={demoAutoApprove}
            voiceTestStatus={voiceTestStatus}
            runtimeSettingsStatus={runtimeSettingsStatus}
            approvedFolders={runtimeSettings.approvedRoots}
            trustedWebsiteHosts={runtimeSettings.trustedWebsiteHosts}
            approvedAppKeys={runtimeSettings.approvedLinkedAppKeys}
            linkedAppOptions={linkedApps.map((app) => ({ key: app.key, name: app.name }))}
            onToggleVoice={() => setVoiceEnabled((value) => !value)}
            onToggleMute={() => setMuted((value) => !value)}
            onVoiceRateChange={setVoiceRate}
            onToneChange={setPreferredTone}
            onToggleDemoAutoApprove={() => setDemoAutoApprove((value) => !value)}
            onTestVoice={testVoice}
            onAddApprovedFolder={addApprovedFolder}
            onRemoveApprovedFolder={removeApprovedFolder}
            onAddTrustedWebsiteHost={addTrustedWebsiteHost}
            onRemoveTrustedWebsiteHost={removeTrustedWebsiteHost}
            onToggleApprovedApp={toggleApprovedApp}
          />
        )}
        {currentPage === "pairing" && <PairingView snapshot={snapshot} />}
      </main>
    </div>
  );
}
