import { useState } from "react";
import { Bot, FolderOpen, Globe, Laptop2 } from "lucide-react";
import { settingsSections } from "../data/viewModels";
import type { AiRuntimeStatus } from "../lib/aiBridge";
import { ResourceList, SectionHeading } from "./ui";

interface LinkedAppOption {
  key: string;
  name: string;
}

interface SettingsViewProps {
  voiceEnabled: boolean;
  muted: boolean;
  voiceRate: number;
  preferredTone: string;
  demoAutoApprove: boolean;
  voiceTestStatus: string;
  runtimeSettingsStatus: string;
  aiRuntimeStatus: AiRuntimeStatus;
  aiRuntimeStatusMessage: string;
  approvedFolders: string[];
  trustedWebsiteHosts: string[];
  approvedAppKeys: string[];
  linkedAppOptions: LinkedAppOption[];
  onToggleVoice: () => void;
  onToggleMute: () => void;
  onVoiceRateChange: (value: number) => void;
  onToneChange: (value: string) => void;
  onToggleDemoAutoApprove: () => void;
  onTestVoice: () => void;
  onAddApprovedFolder: (value: string) => void;
  onRemoveApprovedFolder: (value: string) => void;
  onAddTrustedWebsiteHost: (value: string) => void;
  onRemoveTrustedWebsiteHost: (value: string) => void;
  onToggleApprovedApp: (appKey: string) => void;
}

export function SettingsView({
  voiceEnabled,
  muted,
  voiceRate,
  preferredTone,
  demoAutoApprove,
  voiceTestStatus,
  runtimeSettingsStatus,
  aiRuntimeStatus,
  aiRuntimeStatusMessage,
  approvedFolders,
  trustedWebsiteHosts,
  approvedAppKeys,
  linkedAppOptions,
  onToggleVoice,
  onToggleMute,
  onVoiceRateChange,
  onToneChange,
  onToggleDemoAutoApprove,
  onTestVoice,
  onAddApprovedFolder,
  onRemoveApprovedFolder,
  onAddTrustedWebsiteHost,
  onRemoveTrustedWebsiteHost,
  onToggleApprovedApp
}: SettingsViewProps) {
  const [folderInput, setFolderInput] = useState("");
  const [websiteInput, setWebsiteInput] = useState("");

  return (
    <section className="page">
      <div className="content-grid content-grid--two">
        <section className="panel">
          <SectionHeading title="Voice Settings" copy="Local/system TTS now, premium provider later." />
          <div className="settings-card">
            <div className="step-row">
              <span>Voice replies enabled</span>
              <button type="button" className="chip-button" onClick={onToggleVoice}>
                {voiceEnabled ? "On" : "Off"}
              </button>
            </div>
            <div className="step-row">
              <span>Muted</span>
              <button type="button" className="chip-button" onClick={onToggleMute}>
                {muted ? "Muted" : "Audible"}
              </button>
            </div>
            <label className="slider-field">
              <span>Speech rate</span>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.05"
                value={voiceRate}
                onChange={(event) => onVoiceRateChange(Number(event.target.value))}
              />
              <small>{voiceRate.toFixed(2)}x</small>
            </label>
            <label className="slider-field">
              <span>Assistant tone</span>
              <select value={preferredTone} onChange={(event) => onToneChange(event.target.value)}>
                <option>Calm futuristic</option>
                <option>Focused concise</option>
                <option>Warm precise</option>
              </select>
            </label>
            <div className="step-row">
              <span>Test Echo voice</span>
              <button type="button" className="primary-button" onClick={onTestVoice}>
                Play Test
              </button>
            </div>
            <small className="muted">{voiceTestStatus}</small>
          </div>
        </section>

        <section className="panel">
          <SectionHeading
            title="AI Runtime"
            copy="Local Ollama is the default so Echo can run without token spend."
          />
          <div className="settings-card">
            <div className="step-row">
              <span>Active mode</span>
              <strong>{aiRuntimeStatus.preferredProvider === "ollama" ? "Local Ollama" : "Cloud OpenAI"}</strong>
            </div>
            <div className="step-row">
              <span>Zero token spend</span>
              <button type="button" className="chip-button" disabled>
                {aiRuntimeStatus.zeroTokenMode ? "Locked" : "Off"}
              </button>
            </div>
            <div className="step-row">
              <span>Ollama model</span>
              <strong>{aiRuntimeStatus.ollama.model}</strong>
            </div>
            <div className="step-row">
              <span>Local runtime</span>
              <strong>{aiRuntimeStatus.ollama.reachable ? "Online" : "Offline"}</strong>
            </div>
            <div className="step-row">
              <span>Model pulled</span>
              <strong>{aiRuntimeStatus.ollama.modelAvailable ? "Ready" : "Missing"}</strong>
            </div>
            <div className="step-row">
              <span>Endpoint</span>
              <strong>{aiRuntimeStatus.ollama.baseUrl}</strong>
            </div>
            <small className="muted">{aiRuntimeStatusMessage}</small>
            <small className="muted">{aiRuntimeStatus.ollama.message}</small>
            {aiRuntimeStatus.preferredProvider !== "ollama" && (
              <small className="muted">
                CommandPilot will use cloud tokens until you set <code>COMMANDPILOT_AI_PROVIDER=ollama</code>.
              </small>
            )}
          </div>
          <ResourceList
            icon={<Bot size={16} />}
            items={[
              aiRuntimeStatus.zeroTokenMode
                ? "Local-only AI mode enabled"
                : "Cloud AI mode is currently enabled",
              aiRuntimeStatus.ollama.modelAvailable
                ? `${aiRuntimeStatus.ollama.model} is ready`
                : `Run ollama pull ${aiRuntimeStatus.ollama.model}`,
              aiRuntimeStatus.openai.configured
                ? `OpenAI key detected for optional cloud mode`
                : "No OpenAI key configured"
            ]}
          />
        </section>

        <section className="panel">
          <SectionHeading title="Configuration" copy="Approved resources and trust boundaries." />
          <div className="settings-card">
            <div className="step-row">
              <span>Demo auto-approve confirmations</span>
              <button type="button" className="chip-button" onClick={onToggleDemoAutoApprove}>
                {demoAutoApprove ? "On" : "Off"}
              </button>
            </div>
            <small className="muted">
              Personal demo mode can auto-approve confirm-level actions so Echo keeps moving.
            </small>
            <small className="muted">{runtimeSettingsStatus}</small>
          </div>
          <div className="stack">
            {settingsSections.map((section) => (
              <article key={section.title} className="settings-block">
                <strong>{section.title}</strong>
                <p className="muted">{section.description}</p>
                <ul className="bullet-list">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionHeading title="Approved Folders" copy="Safe file locations Echo can work inside." />
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (!folderInput.trim()) {
                return;
              }

              onAddApprovedFolder(folderInput.trim());
              setFolderInput("");
            }}
          >
            <div className="composer__row">
              <input
                value={folderInput}
                onChange={(event) => setFolderInput(event.target.value)}
                placeholder="C:\\Users\\angel\\OneDrive\\Desktop\\Echo Test Folder"
              />
              <button type="submit" className="secondary-button">
                Add
              </button>
            </div>
          </form>
          <ResourceList icon={<FolderOpen size={16} />} items={approvedFolders} />
          <div className="pill-row">
            {approvedFolders.map((folder) => (
              <button
                key={folder}
                type="button"
                className="chip-button"
                onClick={() => onRemoveApprovedFolder(folder)}
              >
                Remove {folder.split("\\").at(-1) ?? folder}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionHeading
            title="Trusted Websites"
            copy="Chrome website commands are gated by this allowlist."
          />
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              if (!websiteInput.trim()) {
                return;
              }

              onAddTrustedWebsiteHost(websiteInput.trim());
              setWebsiteInput("");
            }}
          >
            <div className="composer__row">
              <input
                value={websiteInput}
                onChange={(event) => setWebsiteInput(event.target.value)}
                placeholder="mail.google.com"
              />
              <button type="submit" className="secondary-button">
                Add
              </button>
            </div>
          </form>
          <ResourceList icon={<Globe size={16} />} items={trustedWebsiteHosts} />
          <div className="pill-row">
            {trustedWebsiteHosts.map((host) => (
              <button
                key={host}
                type="button"
                className="chip-button"
                onClick={() => onRemoveTrustedWebsiteHost(host)}
              >
                Remove {host}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionHeading title="Approved Apps" copy="Toggle which linked apps Echo can launch." />
          <div className="settings-card">
            {linkedAppOptions.map((app) => {
              const enabled = approvedAppKeys.includes(app.key);
              return (
                <div key={app.key} className="step-row">
                  <span>{app.name}</span>
                  <button
                    type="button"
                    className="chip-button"
                    onClick={() => onToggleApprovedApp(app.key)}
                  >
                    {enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              );
            })}
          </div>
          <ResourceList
            icon={<Laptop2 size={16} />}
            items={linkedAppOptions
              .filter((app) => approvedAppKeys.includes(app.key))
              .map((app) => app.name)}
          />
        </section>
      </div>
    </section>
  );
}

