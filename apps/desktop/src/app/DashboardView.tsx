import type { ApprovalRecord, CommandExecutionResult, DemoSnapshot } from "@commandpilot/core";
import {
  ArrowRight,
  Laptop2,
  PlayCircle,
  Send,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { appCommandPacks, dashboardQuickCommands } from "@commandpilot/core";
import { MetricCard } from "../components/cards/MetricCard";
import { formatTimestamp } from "../data/viewModels";
import { EmptyState, SectionHeading, StatusBadge } from "./ui";

interface DashboardViewProps {
  snapshot: DemoSnapshot;
  commandInput: string;
  approvedAppKeys: string[];
  onCommandInputChange: (value: string) => void;
  onSubmitCommand: (command: string) => void;
  onOpenExecution: (execution: CommandExecutionResult) => void;
  onResolveApproval: (approval: ApprovalRecord, decision: "approved" | "denied") => void;
}

export function DashboardView({
  snapshot,
  commandInput,
  approvedAppKeys,
  onCommandInputChange,
  onSubmitCommand,
  onOpenExecution,
  onResolveApproval
}: DashboardViewProps) {
  const hasApprovedAppFilter = approvedAppKeys.length > 0;
  const visibleCommandPacks = appCommandPacks.filter(
    (pack) => !hasApprovedAppFilter || approvedAppKeys.includes(pack.appKey)
  );

  return (
    <section className="page">
      <div className="hero panel">
        <div className="hero__copy">
          <span className="eyebrow">Echo Ready</span>
          <h2>Good morning, {snapshot.profile.name}. Your private assistant stack is live.</h2>
          <p className="hero__text">
            Echo is tuned for your Windows workstation, paired Android device, and
            approval-first automation flow. Local actions go first. Riskier steps stay visible.
          </p>
        </div>

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitCommand(commandInput);
          }}
        >
          <label className="composer__label" htmlFor="dashboard-command">
            Quick command
          </label>
          <div className="composer__row">
            <input
              id="dashboard-command"
              value={commandInput}
              onChange={(event) => onCommandInputChange(event.target.value)}
              placeholder="Tell Echo what to do"
            />
            <button type="submit" className="primary-button">
              <Send size={16} />
              Run
            </button>
          </div>
        </form>

        <div className="quick-command-grid">
          {dashboardQuickCommands.map((item) => (
            <button
              key={item.label}
              type="button"
              className="quick-command"
              onClick={() => onSubmitCommand(item.command)}
            >
              <strong>{item.label}</strong>
              <p>{item.description}</p>
              <span>
                {item.command}
                <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
      </div>

      <section className="panel app-packs-panel">
        <SectionHeading title="App Command Packs" copy="Pinned action bundles for your linked apps." />
        <div className="app-pack-grid">
          {visibleCommandPacks.map((pack) => (
            <article key={pack.appKey} className="workflow-card">
              <div className="list-card__row">
                <strong>{pack.appName}</strong>
                <span className="status-pill status-pill--info">3 actions</span>
              </div>
              <p className="muted">{pack.description}</p>
              <div className="pill-row">
                {pack.commands.map((command) => (
                  <button
                    key={`${pack.appKey}-${command.label}`}
                    type="button"
                    className="chip-button"
                    onClick={() => onSubmitCommand(command.command)}
                  >
                    {command.label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard
          eyebrow="Devices"
          value={`${snapshot.devices.filter((device) => device.trusted).length}`}
          detail="Trusted endpoints online and synced"
          accent="blue"
          icon={<Laptop2 size={18} />}
        />
        <MetricCard
          eyebrow="Running"
          value={`${snapshot.runningTasks.length}`}
          detail="Tasks still active or awaiting approval"
          accent="teal"
          icon={<PlayCircle size={18} />}
        />
        <MetricCard
          eyebrow="Approvals"
          value={`${snapshot.pendingApprovals.length}`}
          detail="Sensitive actions waiting on you"
          accent="violet"
          icon={<ShieldAlert size={18} />}
        />
        <MetricCard
          eyebrow="Skills"
          value={`${snapshot.skills.length}`}
          detail="Registered actions available to Echo"
          accent="blue"
          icon={<Sparkles size={18} />}
        />
      </div>

      <div className="content-grid">
        <section className="panel">
          <SectionHeading title="Running Tasks" copy="Live tasks and queued automation bundles." />
          <div className="stack">
            {snapshot.runningTasks.map((task) => (
              <button
                key={task.plan.id}
                type="button"
                className="list-card"
                onClick={() => onOpenExecution(task)}
              >
                <div className="list-card__row">
                  <strong>{task.plan.summary}</strong>
                  <StatusBadge status={task.status} />
                </div>
                <p className="muted">{task.echoMessage}</p>
                <small>{task.steps.length} planned steps</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionHeading title="Recent Commands" copy="The latest things Echo has already handled." />
          <div className="stack">
            {snapshot.recentCommands.map((command) => (
              <button
                key={command.plan.id}
                type="button"
                className="list-card"
                onClick={() => onOpenExecution(command)}
              >
                <div className="list-card__row">
                  <strong>{command.plan.text}</strong>
                  <StatusBadge status={command.status} />
                </div>
                <p className="muted">{command.echoMessage}</p>
                <small>{formatTimestamp(command.activityLog[0]?.createdAt ?? new Date().toISOString())}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionHeading title="Devices" copy="Primary endpoints in the trusted mesh." />
          <div className="device-grid">
            {snapshot.devices.map((device) => (
              <article key={device.id} className="device-card">
                <div className="list-card__row">
                  <strong>{device.name}</strong>
                  <span className={`status-pill status-pill--${device.status === "online" ? "success" : "info"}`}>
                    {device.status}
                  </span>
                </div>
                <p className="muted">
                  {device.platform === "windows" ? "Windows desktop executor" : "Android companion"}
                </p>
                <small>
                  Battery {device.batteryPercent ?? 100}% · {device.network}
                </small>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionHeading title="Pending Approvals" copy="High-trust actions pause here until you decide." />
          <div className="stack">
            {snapshot.pendingApprovals.length === 0 && (
              <EmptyState title="No approvals waiting" copy="Echo can continue automatically right now." />
            )}
            {snapshot.pendingApprovals.map((approval) => (
              <article key={approval.id} className="approval-card">
                <div className="list-card__row">
                  <strong>{approval.title}</strong>
                  <span className="status-pill status-pill--warning">{approval.safetyLevel}</span>
                </div>
                <p className="muted">{approval.description}</p>
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
                    Approve
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
