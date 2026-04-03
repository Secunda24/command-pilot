import type { ReactNode } from "react";

interface MetricCardProps {
  eyebrow: string;
  value: string;
  detail: string;
  accent?: "blue" | "violet" | "teal";
  icon?: ReactNode;
}

export function MetricCard({
  eyebrow,
  value,
  detail,
  accent = "blue",
  icon
}: MetricCardProps) {
  return (
    <article className={`panel metric-card metric-card--${accent}`}>
      <div className="metric-card__header">
        <span className="eyebrow">{eyebrow}</span>
        {icon}
      </div>
      <strong className="metric-card__value">{value}</strong>
      <p className="muted">{detail}</p>
    </article>
  );
}
