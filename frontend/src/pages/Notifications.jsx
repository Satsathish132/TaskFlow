import { useMemo } from "react";
import { useNotifications } from "../context/NotificationContext";
import AppShell from "../components/AppShell";
import EmptyState from "../components/EmptyState";

const TYPE_META = {
  TASK_ASSIGNED: { label: "Tasks assigned to you", icon: "◧" },
  TASK_DUE_SOON: { label: "Due date reminders", icon: "⏰" },
  WORKSPACE_ADDED: { label: "Workspace invites", icon: "◍" },
  PROJECT_ASSIGNED: { label: "Project assignments", icon: "◔" },
  INVITE: { label: "Invitations", icon: "✉" },
};

const Notifications = () => {
  const { notifications, markAsRead } = useNotifications();

  const groups = useMemo(() => {
    const byType = {};
    for (const n of notifications) {
      (byType[n.type] = byType[n.type] || []).push(n);
    }
    return byType;
  }, [notifications]);

  return (
    <AppShell>
      <div className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-flow-deep">Inbox</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Notifications</h1>
      </div>

      {notifications.length === 0 && (
        <EmptyState title="You're all caught up" body="New assignments, invites, and workspace activity will land here." />
      )}

      <div className="space-y-8">
        {Object.entries(groups).map(([type, items]) => (
          <section key={type}>
            <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              <span>{TYPE_META[type]?.icon || "•"}</span>
              {TYPE_META[type]?.label || type}
            </h2>
            <ul className="space-y-2">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start justify-between gap-4 rounded-xl border px-5 py-3.5 transition ${
                    n.is_read ? "border-line bg-paper-soft" : "border-flow/30 bg-flow-tint"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!n.is_read && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-flow" />}
                    <div>
                      <p className="text-sm text-ink">{n.message}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-flow-deep hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
};

export default Notifications;
