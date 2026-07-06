import { useNotifications } from "../context/NotificationContext";

const TYPE_LABEL = {
  TASK_ASSIGNED: "New task",
  WORKSPACE_ADDED: "Workspace",
  PROJECT_ASSIGNED: "Project",
  INVITE: "Invite",
};

const ToastStack = () => {
  const { toasts, dismissToast } = useNotifications();

  if (!toasts.length) return null;

  return (
    <div className="fixed right-6 top-6 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.toastId}
          className="animate-toast-in flex items-start gap-3 rounded-xl border border-line bg-paper-soft p-4 shadow-lifted"
        >
          <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-flow" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              {TYPE_LABEL[t.type] || t.type}
            </p>
            <p className="mt-0.5 text-sm text-ink">{t.message}</p>
          </div>
          <button
            onClick={() => dismissToast(t.toastId)}
            className="text-ink-faint hover:text-ink"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastStack;
