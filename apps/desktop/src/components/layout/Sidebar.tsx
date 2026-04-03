import {
  Bot,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Network,
  ShieldCheck,
  Sparkles,
  Workflow
} from "lucide-react";
import { navigationItems, type PageId } from "../../data/viewModels";

interface SidebarProps {
  currentPage: PageId;
  onSelect: (page: PageId) => void;
}

const iconMap = {
  dashboard: LayoutDashboard,
  "command-center": Bot,
  "running-tasks": Workflow,
  "activity-log": ClipboardList,
  approvals: ShieldCheck,
  skills: Sparkles,
  settings: ListChecks,
  pairing: Network
} satisfies Record<PageId, typeof LayoutDashboard>;

export function Sidebar({ currentPage, onSelect }: SidebarProps) {
  return (
    <aside className="sidebar panel">
      <div className="sidebar__brand">
        <div className="sidebar__logo">CP</div>
        <div>
          <p className="sidebar__title">CommandPilot</p>
          <p className="muted">Echo control system</p>
        </div>
      </div>

      <nav className="sidebar__nav">
        {navigationItems.map((item) => {
          const Icon = iconMap[item.id];
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar__item ${currentPage === item.id ? "is-active" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <Icon size={18} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <span className="status-pill status-pill--success">Private v1</span>
        <p className="muted">
          Personal-use assistant stack with local-first execution and explicit approvals.
        </p>
      </div>
    </aside>
  );
}
