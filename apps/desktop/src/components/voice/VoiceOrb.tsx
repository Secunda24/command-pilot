import { useEffect, useMemo, useRef } from "react";

export type EchoRingState =
  | "STANDBY"
  | "LISTENING"
  | "THINKING"
  | "MUTED"
  | "DISABLED"
  | "ALERT";

interface VoiceOrbProps {
  state: EchoRingState;
  label: string;
  detail: string;
}

const STATUS_COLORS: Record<EchoRingState, string> = {
  STANDBY: "#00e5ff",
  LISTENING: "#ff4455",
  THINKING: "#ffb700",
  MUTED: "#7f8ca8",
  DISABLED: "#4f5d7d",
  ALERT: "#ff8f98"
};

const ACTIVE_WAVE_STATES = new Set<EchoRingState>(["LISTENING", "THINKING"]);

export function VoiceOrb({ state, label, detail }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateColor = STATUS_COLORS[state];
  const stateLabel = useMemo(() => state.replaceAll("_", " "), [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const size = 152;
    const center = size / 2;
    let frame = 0;
    let angle = 0;
    let pulse = 0;
    let waveform = new Array(24).fill(0);

    const render = () => {
      frame = window.requestAnimationFrame(render);

      angle += 1.5;
      pulse += 0.08;

      context.clearRect(0, 0, size, size);
      context.fillStyle = "#060810";
      context.fillRect(0, 0, size, size);

      context.save();
      context.translate(center, center);
      context.rotate((angle * Math.PI) / 180);
      context.strokeStyle = "rgba(0, 128, 255, 0.32)";
      context.lineWidth = 1;
      context.setLineDash([5, 4]);
      context.beginPath();
      context.arc(0, 0, 68, 0, Math.PI * 2);
      context.stroke();
      context.restore();
      context.setLineDash([]);

      const pulseSize = 4 * Math.sin(pulse);
      context.strokeStyle = stateColor;
      context.lineWidth = 2.2;
      context.beginPath();
      context.arc(center, center, 56 + pulseSize, 0, Math.PI * 2);
      context.stroke();

      context.strokeStyle = "rgba(0, 128, 255, 0.45)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(center, center, 45, 0, Math.PI * 2);
      context.stroke();

      context.fillStyle = "#010612";
      context.beginPath();
      context.arc(center, center, 35, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = `${stateColor}bb`;
      context.lineWidth = 1.5;
      context.stroke();

      for (let index = 0; index < 12; index += 1) {
        const tickAngle = ((index * 30 + angle) * Math.PI) / 180;
        const radius = 58 + 3 * Math.sin(pulse + index * 0.5);
        context.strokeStyle = `${stateColor}77`;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(
          center + 47 * Math.cos(tickAngle),
          center + 47 * Math.sin(tickAngle)
        );
        context.lineTo(center + radius * Math.cos(tickAngle), center + radius * Math.sin(tickAngle));
        context.stroke();
      }

      const active = ACTIVE_WAVE_STATES.has(state);
      waveform = waveform.map((value) => (active ? (Math.random() - 0.5) * 18 : value * 0.82));
      const barWidth = 3;
      const gap = 2;
      const total = waveform.length * (barWidth + gap);
      const startX = center - total / 2;

      for (let index = 0; index < waveform.length; index += 1) {
        const height = Math.max(Math.abs(waveform[index]), 1);
        context.fillStyle = `${stateColor}88`;
        context.fillRect(startX + index * (barWidth + gap), center - height, barWidth, height * 2);
      }
    };

    render();

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [state, stateColor]);

  return (
    <div className="voice-orb">
      <canvas
        ref={canvasRef}
        className="voice-orb__canvas"
        width={152}
        height={152}
        aria-hidden="true"
      />
      <div className="voice-orb__meta">
        <span className="voice-orb__status" style={{ color: stateColor }}>
          {stateLabel}
        </span>
        <strong className="voice-orb__label">{label}</strong>
        <small className="voice-orb__detail">{detail}</small>
      </div>
    </div>
  );
}
