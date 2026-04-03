import type { DemoSnapshot } from "@commandpilot/core";
import { SectionHeading, StatusBadge } from "./ui";

export function RunningTasksView({ snapshot }: { snapshot: DemoSnapshot }) {
  return (
    <section className="page">
      <section className="panel">
        <SectionHeading title="Running Tasks" copy="Everything Echo is still shepherding." />
        <div className="task-grid">
          {snapshot.runningTasks.map((task) => (
            <article key={task.plan.id} className="task-card">
              <div className="list-card__row">
                <strong>{task.plan.text}</strong>
                <StatusBadge status={task.status} />
              </div>
              <p className="muted">{task.echoMessage}</p>
              <div className="stack stack--compact">
                {task.steps.map((step) => (
                  <div key={step.id} className="step-row">
                    <span>{step.title}</span>
                    <StatusBadge status={step.status} compact />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
