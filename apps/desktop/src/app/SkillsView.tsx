import type { DemoSnapshot } from "@commandpilot/core";
import { SectionHeading, mapSafetyTone } from "./ui";

export function SkillsView({ snapshot }: { snapshot: DemoSnapshot }) {
  return (
    <section className="page">
      <div className="content-grid content-grid--two">
        <section className="panel">
          <SectionHeading title="Skills Registry" copy="Callable actions Echo can route right now." />
          <div className="stack">
            {snapshot.skills.map((skill) => (
              <article key={skill.key} className="skill-card">
                <div className="list-card__row">
                  <strong>{skill.name}</strong>
                  <span className={`status-pill status-pill--${mapSafetyTone(skill.safetyLevel)}`}>
                    {skill.safetyLevel}
                  </span>
                </div>
                <p className="muted">{skill.description}</p>
                <small>
                  {skill.executionTarget} · {skill.executionMode} · {skill.parameters.length} params
                </small>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionHeading title="Workflows" copy="Pre-wired bundles for repeatable personal automations." />
          <div className="stack">
            {snapshot.workflows.map((workflow) => (
              <article key={workflow.id} className="workflow-card">
                <div className="list-card__row">
                  <strong>{workflow.name}</strong>
                  <span className="status-pill status-pill--success">{workflow.status}</span>
                </div>
                <p className="muted">{workflow.description}</p>
                <div className="stack stack--compact">
                  {workflow.steps.map((step) => (
                    <div key={step.id} className="step-row">
                      <span>{step.title}</span>
                      <small>{step.skillKey}</small>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
