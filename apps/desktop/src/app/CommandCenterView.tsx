import type { CommandExecutionResult } from "@commandpilot/core";
import { Send } from "lucide-react";
import { formatTimestamp } from "../data/viewModels";
import type { ChatMessage } from "./App";
import { SectionHeading, StatusBadge, mapSafetyTone } from "./ui";

interface CommandCenterViewProps {
  activeExecution: CommandExecutionResult;
  commandInput: string;
  conversation: ChatMessage[];
  onCommandInputChange: (value: string) => void;
  onSubmitCommand: (command: string) => void;
}

export function CommandCenterView({
  activeExecution,
  commandInput,
  conversation,
  onCommandInputChange,
  onSubmitCommand
}: CommandCenterViewProps) {
  return (
    <section className="page page--split">
      <section className="panel chat-panel">
        <SectionHeading
          title="Command Center"
          copy="Type or speak to Echo, then watch the execution path unfold."
        />

        <div className="chat-thread">
          {conversation.map((message) => (
            <article
              key={message.id}
              className={`chat-bubble ${message.role === "assistant" ? "is-assistant" : "is-user"}`}
            >
              <small>{message.role === "assistant" ? "Echo" : "You"}</small>
              <p>{message.text}</p>
              <time>{formatTimestamp(message.timestamp)}</time>
            </article>
          ))}
        </div>

        <form
          className="composer composer--bottom"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitCommand(commandInput);
          }}
        >
          <div className="composer__row">
            <input
              value={commandInput}
              onChange={(event) => onCommandInputChange(event.target.value)}
              placeholder="Ask Echo to handle something"
            />
            <button type="submit" className="primary-button">
              <Send size={16} />
              Send
            </button>
          </div>
        </form>
      </section>

      <aside className="panel inspector-panel">
        <SectionHeading title="Execution Plan" copy="Echo's interpretation, routing, and safety posture." />

        <div className="inspector-highlight">
          <div className="list-card__row">
            <strong>{activeExecution.plan.summary}</strong>
            <StatusBadge status={activeExecution.status} />
          </div>
          <p className="muted">{activeExecution.echoMessage}</p>
          <div className="pill-row">
            <span className="status-pill status-pill--info">{activeExecution.plan.executionTarget}</span>
            <span className={`status-pill status-pill--${mapSafetyTone(activeExecution.plan.safetyLevel)}`}>
              {activeExecution.plan.safetyLevel}
            </span>
            <span className="status-pill status-pill--info">
              {activeExecution.plan.selectedSkills.length} skills
            </span>
          </div>
        </div>

        <div className="stack">
          {activeExecution.steps.map((step) => (
            <article key={step.id} className="step-card">
              <div className="list-card__row">
                <strong>{step.title}</strong>
                <StatusBadge status={step.status} />
              </div>
              <p className="muted">{step.description}</p>
              <small>
                {step.skillKey} · {step.target}
              </small>
            </article>
          ))}
        </div>

        <div className="stack">
          <SectionHeading title="Suggested follow-ups" copy="Fast next moves from the planner." />
          <div className="pill-row">
            {activeExecution.plan.suggestedFollowUps.map((item) => (
              <button
                key={item}
                type="button"
                className="chip-button"
                onClick={() => onCommandInputChange(`Echo, ${item.toLowerCase()}`)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
