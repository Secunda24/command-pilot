interface VoiceOrbProps {
  active: boolean;
  muted: boolean;
  label: string;
}

export function VoiceOrb({ active, muted, label }: VoiceOrbProps) {
  return (
    <div className={`voice-orb ${active ? "is-active" : ""} ${muted ? "is-muted" : ""}`}>
      <div className="voice-orb__core" />
      <div className="voice-orb__ring voice-orb__ring--outer" />
      <div className="voice-orb__ring voice-orb__ring--inner" />
      <span className="voice-orb__label">{label}</span>
    </div>
  );
}
