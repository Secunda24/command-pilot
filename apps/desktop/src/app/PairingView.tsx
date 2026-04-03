import type { DemoSnapshot } from "@commandpilot/core";
import { Smartphone } from "lucide-react";
import { pairingChecklist } from "../data/viewModels";
import { SectionHeading } from "./ui";

export function PairingView({ snapshot }: { snapshot: DemoSnapshot }) {
  return (
    <section className="page">
      <div className="content-grid content-grid--two">
        <section className="panel pairing-hero">
          <SectionHeading
            title="Trusted Device Pairing"
            copy="Bridge Windows execution with Android approvals and notifications."
          />
          <div className="pairing-code">
            <span className="eyebrow">Pairing code</span>
            <strong>{snapshot.devices.find((device) => device.platform === "android")?.pairingCode}</strong>
          </div>
          <div className="qr-placeholder">
            <div />
            <div />
            <div />
          </div>
          <div className="pill-row">
            <span className="status-pill status-pill--success">Trusted phone paired</span>
            <span className="status-pill status-pill--info">Local auth token active</span>
          </div>
        </section>

        <section className="panel">
          <SectionHeading title="How Pairing Works" copy="A simple secure flow for v1 personal use." />
          <ul className="bullet-list">
            {pairingChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="notification-preview">
            <Smartphone size={18} />
            <div>
              <strong>Echo Companion Pixel</strong>
              <p className="muted">
                Ready for remote commands, approval prompts, and completion notifications.
              </p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
