import type { ApprovalRecord, DemoSnapshot } from "@commandpilot/core";
import { EmptyState, SectionHeading, mapSafetyTone } from "./ui";

interface ApprovalsViewProps {
  snapshot: DemoSnapshot;
  onResolveApproval: (approval: ApprovalRecord, decision: "approved" | "denied") => void;
}

export function ApprovalsView({ snapshot, onResolveApproval }: ApprovalsViewProps) {
  return (
    <section className="page">
      <section className="panel">
        <SectionHeading
          title="Approvals"
          copy="Visible, deliberate control for sensitive or high-trust actions."
        />
        {snapshot.pendingApprovals.length === 0 ? (
          <EmptyState title="No pending approvals" copy="Echo has a clear lane right now." />
        ) : (
          <div className="task-grid">
            {snapshot.pendingApprovals.map((approval) => (
              <article key={approval.id} className="approval-card approval-card--large">
                <div className="list-card__row">
                  <strong>{approval.title}</strong>
                  <span className={`status-pill status-pill--${mapSafetyTone(approval.safetyLevel)}`}>
                    {approval.safetyLevel}
                  </span>
                </div>
                <p className="muted">{approval.description}</p>
                <small>Requested on {approval.requestedOn.join(" + ")}</small>
                <div className="approval-card__actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onResolveApproval(approval, "denied")}
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => onResolveApproval(approval, "approved")}
                  >
                    Approve and continue
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
