import { findLinkedAppByText, type LinkedAppDefinition } from "./registry";

export interface LinkedAppRouteDefinition {
  appKey: string;
  key: string;
  name: string;
  path: string;
  aliases: string[];
  description: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasAlias(text: string, alias: string): boolean {
  return new RegExp(`(^|\\b)${escapeRegExp(alias)}(\\b|$)`, "i").test(text);
}

export const linkedAppRoutes: LinkedAppRouteDefinition[] = [
  {
    appKey: "clientflow",
    key: "admin-dashboard",
    name: "Admin Dashboard",
    path: "/portal/admin",
    aliases: ["dashboard", "admin dashboard", "portal"],
    description: "Clientflow admin home."
  },
  {
    appKey: "clientflow",
    key: "approvals",
    name: "Approvals",
    path: "/portal/admin/requests",
    aliases: ["approvals", "requests", "request queue"],
    description: "Clientflow request and approvals queue."
  },
  {
    appKey: "clientflow",
    key: "clients",
    name: "Clients",
    path: "/portal/admin/clients",
    aliases: ["clients", "client list"],
    description: "Clientflow client list."
  },
  {
    appKey: "clientflow",
    key: "invoices",
    name: "Invoices",
    path: "/portal/admin/invoices",
    aliases: ["invoices", "billing"],
    description: "Clientflow invoice management."
  },
  {
    appKey: "clientflow",
    key: "documents",
    name: "Documents",
    path: "/portal/admin/documents",
    aliases: ["documents", "files"],
    description: "Clientflow documents hub."
  },
  {
    appKey: "clientflow",
    key: "projects",
    name: "Projects",
    path: "/portal/admin/projects",
    aliases: ["projects"],
    description: "Clientflow projects board."
  },
  {
    appKey: "clientflow",
    key: "activity",
    name: "Activity",
    path: "/portal/admin/activity",
    aliases: ["activity", "activity log"],
    description: "Clientflow activity feed."
  },
  {
    appKey: "flowpilot",
    key: "workspace",
    name: "Workspace",
    path: "/workspace",
    aliases: ["workspace", "dashboard", "home"],
    description: "FlowPilot workspace home."
  },
  {
    appKey: "flowpilot",
    key: "jobs",
    name: "Jobs",
    path: "/workspace/jobs",
    aliases: ["jobs", "jobs board", "job board"],
    description: "FlowPilot jobs board."
  },
  {
    appKey: "flowpilot",
    key: "dispatch",
    name: "Dispatch",
    path: "/workspace/dispatch",
    aliases: ["dispatch"],
    description: "FlowPilot dispatch board."
  },
  {
    appKey: "flowpilot",
    key: "customers",
    name: "Customers",
    path: "/workspace/customers",
    aliases: ["customers", "customer list"],
    description: "FlowPilot customer workspace."
  },
  {
    appKey: "flowpilot",
    key: "invoices",
    name: "Invoices",
    path: "/workspace/invoices",
    aliases: ["invoices", "billing"],
    description: "FlowPilot invoices."
  },
  {
    appKey: "flowpilot",
    key: "quotes",
    name: "Quotes",
    path: "/workspace/quotes",
    aliases: ["quotes"],
    description: "FlowPilot quotes."
  },
  {
    appKey: "flowpilot",
    key: "automations",
    name: "Automations",
    path: "/workspace/automations",
    aliases: ["automations", "automation"],
    description: "FlowPilot automations."
  },
  {
    appKey: "flowpilot",
    key: "reporting",
    name: "Reporting",
    path: "/workspace/reporting",
    aliases: ["reporting", "reports"],
    description: "FlowPilot reporting."
  },
  {
    appKey: "flowpilot",
    key: "social",
    name: "Social",
    path: "/workspace/social",
    aliases: ["social", "social planner"],
    description: "FlowPilot social workspace."
  },
  {
    appKey: "fieldops",
    key: "workspace",
    name: "Workspace",
    path: "/workspace",
    aliases: ["workspace", "dashboard", "home"],
    description: "FieldOps workspace home."
  },
  {
    appKey: "fieldops",
    key: "jobs",
    name: "Jobs",
    path: "/workspace/jobs",
    aliases: ["jobs", "jobs board", "job board"],
    description: "FieldOps jobs board."
  },
  {
    appKey: "fieldops",
    key: "dispatch",
    name: "Dispatch",
    path: "/workspace/dispatch",
    aliases: ["dispatch"],
    description: "FieldOps dispatch board."
  },
  {
    appKey: "fieldops",
    key: "technicians",
    name: "Technicians",
    path: "/workspace/technicians",
    aliases: ["technicians", "techs"],
    description: "FieldOps technicians board."
  },
  {
    appKey: "fieldops",
    key: "tasks",
    name: "Tasks",
    path: "/workspace/tasks",
    aliases: ["tasks"],
    description: "FieldOps task queue."
  },
  {
    appKey: "fieldops",
    key: "customers",
    name: "Customers",
    path: "/workspace/customers",
    aliases: ["customers", "customer list"],
    description: "FieldOps customers."
  },
  {
    appKey: "fieldops",
    key: "notifications",
    name: "Notifications",
    path: "/workspace/notifications",
    aliases: ["notifications", "alerts"],
    description: "FieldOps notifications."
  }
];

export function getLinkedRoutesForApp(appKey: string): LinkedAppRouteDefinition[] {
  return linkedAppRoutes.filter((route) => route.appKey === appKey);
}

export function findLinkedAppRouteMatch(
  text: string
): { app: LinkedAppDefinition; route: LinkedAppRouteDefinition } | null {
  if (!/^(open|launch|start|bring up)\b/i.test(text.trim())) {
    return null;
  }

  const app = findLinkedAppByText(text);
  if (!app) {
    return null;
  }

  const route =
    getLinkedRoutesForApp(app.key).find((candidate) =>
      candidate.aliases.some((alias) => hasAlias(text.toLowerCase(), alias))
    ) ?? null;

  if (!route) {
    return null;
  }

  return { app, route };
}
