import { Bell, Mic, Volume2, VolumeX } from "lucide-react";
import { VoiceOrb } from "../voice/VoiceOrb";

interface TopBarProps {
  status: string;
  voiceCommandStatus: string;
  approvalCount: number;
  voiceEnabled: boolean;
  voiceSupported: boolean;
  listening: boolean;
  muted: boolean;
  onMicAction: () => void;
  onToggleMute: () => void;
}

export function TopBar({
  status,
  voiceCommandStatus,
  approvalCount,
  voiceEnabled,
  voiceSupported,
  listening,
  muted,
  onMicAction,
  onToggleMute
}: TopBarProps) {
  const micLabel = !voiceSupported
    ? "Voice Unavailable"
    : !voiceEnabled
      ? "Enable Voice"
      : listening
        ? "Stop Listening"
        : "Start Listening";

  return (
    <header className="topbar">
      <div className="topbar__copy">
        <span className="eyebrow">Echo Presence</span>
        <h1>Calm control across your PC and phone.</h1>
        <p className="muted topbar__status-text">{voiceCommandStatus}</p>
      </div>

      <div className="topbar__actions">
        <VoiceOrb active={listening || (voiceEnabled && !muted)} muted={muted} label={status} />
        <button
          type="button"
          className={`icon-button ${listening ? "is-listening" : ""}`}
          onClick={onMicAction}
          disabled={!voiceSupported}
        >
          <Mic size={16} />
          <span>{micLabel}</span>
        </button>
        <button type="button" className="icon-button" onClick={onToggleMute}>
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          <span>{muted ? "Unmute" : "Mute"}</span>
        </button>
        <div className="notification-pill">
          <Bell size={16} />
          <span>{approvalCount} pending approvals</span>
        </div>
      </div>
    </header>
  );
}
