import type { ReactNode } from "react";
import type { ApprovalRecord, CommandStatus, StepStatus } from "@commandpilot/core";

export function SectionHeading({ title, copy }: { title: string; copy: string }) {
  return (
    <header className="section-heading">
      <div>
        <h3>{title}</h3>
        <p className="muted">{copy}</p>
      </div>
    </header>
  );
}

export function StatusBadge({
  status,
  compact = false
}: {
  status: CommandStatus | ApprovalRecord["status"] | StepStatus | "pending";
  compact?: boolean;
}) {
  const tone =
    status === "completed" || status === "approved"
      ? "success"
      : status === "awaiting_approval" || status === "pending"
        ? "warning"
        : status === "failed" || status === "denied" || status === "blocked"
          ? "danger"
          : "info";

  return (
    <span className={`status-pill status-pill--${tone} ${compact ? "status-pill--compact" : ""}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p className="muted">{copy}</p>
    </div>
  );
}

export function ResourceList({ icon, items }: { icon: ReactNode; items: string[] }) {
  return (
    <div className="stack">
      {items.map((item) => (
        <article key={item} className="resource-row">
          <span>{icon}</span>
          <p>{item}</p>
        </article>
      ))}
    </div>
  );
}

export function mapSafetyTone(safety: string): "info" | "warning" | "danger" | "success" {
  if (safety === "safe") {
    return "success";
  }

  if (safety === "notice") {
    return "info";
  }

  if (safety === "confirm") {
    return "warning";
  }

  return "danger";
}
