import type { DemoSnapshot } from "@commandpilot/core";
import { formatTimestamp } from "../data/viewModels";
import { SectionHeading } from "./ui";

export function ActivityView({ snapshot }: { snapshot: DemoSnapshot }) {
  return (
    <section className="page">
      <section className="panel">
        <SectionHeading title="Activity Log" copy="A complete local-first timeline of Echo's work." />
        <div className="timeline">
          {snapshot.activity.map((item) => (
            <article key={item.id} className="timeline__item">
              <div className={`timeline__dot timeline__dot--${item.status}`} />
              <div>
                <div className="list-card__row">
                  <strong>{item.title}</strong>
                  <small>{formatTimestamp(item.createdAt)}</small>
                </div>
                <p className="muted">{item.details}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
