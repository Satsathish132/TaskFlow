import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Archive, Clock, Trash2 } from "lucide-react";
import api from "../lib/api";
import EmptyState from "./EmptyState";
import { Button } from "./kit";

const WARNING_WINDOW_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const daysLeft = (expiresAt) => {
  const expires = new Date(expiresAt).getTime();
  return Math.ceil((expires - Date.now()) / MS_PER_DAY);
};

// Usage: <ProjectBackups workspaceId={id} onRestored={(newProjectId) => ...} />
const ProjectBackups = ({ workspaceId, onRestored } = {}) => {
  const [backups, setBackups] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [restoringId, setRestoringId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadBackups = async () => {
    try {
      const { data } = await api.get(`/projects/backups/${workspaceId}`);
      setBackups(data);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load backups.");
    }
  };

  useEffect(() => {
    if (open && backups === null) loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, backups]);

  const visibleBackups = useMemo(() => {
    if (!backups) return backups;
    return backups.filter((b) => daysLeft(b.expires_at) > 0);
  }, [backups]);

  const expiringSoonCount = useMemo(() => {
    if (!visibleBackups) return 0;
    return visibleBackups.filter((b) => daysLeft(b.expires_at) <= WARNING_WINDOW_DAYS).length;
  }, [visibleBackups]);

  const onRestore = async (backup) => {
    if (!window.confirm(`Restore "${backup.name}" as a new project?`)) return;
    setError("");
    setNotice("");
    setRestoringId(backup.id);
    try {
      const { data } = await api.post(`/projects/backups/${backup.id}/restore`, { workspaceId });
      setBackups((prev) => prev.filter((b) => b.id !== backup.id));
      setNotice(`Restored "${backup.name}".`);
      onRestored?.(data.projectId);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't restore project.");
    } finally {
      setRestoringId(null);
    }
  };

  const onDelete = async (backup) => {
    if (!window.confirm(`Permanently delete backup "${backup.name}"? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    setDeletingId(backup.id);
    try {
      await api.delete(`/projects/backups/${backup.id}`, { data: { workspaceId } });
      setBackups((prev) => prev.filter((b) => b.id !== backup.id));
      setNotice(`Deleted backup "${backup.name}" permanently.`);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't delete backup.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-line bg-paper-soft px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
      >
        <Archive className="h-3.5 w-3.5 text-ink-faint" />
        Deleted projects
        {expiringSoonCount > 0 && (
          <span className="rounded-full bg-flow-deep/10 px-1.5 py-0.5 text-[10px] font-medium text-flow-deep">
            {expiringSoonCount}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 max-h-80 w-80 overflow-y-auto rounded-2xl border border-line bg-paper-soft px-3 py-3 shadow-lifted">
          {error && <p className="mb-2 text-xs text-flow-deep">{error}</p>}
          {notice && <p className="mb-2 text-xs text-ink">{notice}</p>}

          {expiringSoonCount > 0 && (
            <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-flow-deep/5 px-2 py-1.5 text-[11px] text-flow-deep">
              <Clock className="h-3 w-3 shrink-0" />
              {expiringSoonCount} expiring within {WARNING_WINDOW_DAYS} days
            </div>
          )}

          {visibleBackups?.length === 0 && (
            <EmptyState title="No deleted projects" body="Backed-up projects will show up here." />
          )}

          {visibleBackups?.length > 0 && (
            <ul className="space-y-1.5">
              {visibleBackups.map((b) => {
                const remaining = daysLeft(b.expires_at);
                const isWarning = remaining <= WARNING_WINDOW_DAYS;
                const isBusy = restoringId === b.id || deletingId === b.id;
                return (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{b.name}</p>
                      <p className="text-[10px] text-ink-faint">
                        Deleted {new Date(b.created_at).toLocaleDateString()}
                      </p>
                      <p className={`text-[10px] ${isWarning ? "text-flow-deep" : "text-ink-faint"}`}>
                        {remaining <= 0 ? "Expiring now" : `${remaining}d left`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        disabled={isBusy}
                        onClick={() => onRestore(b)}
                      >
                        {restoringId === b.id ? "…" : "Restore"}
                      </Button>
                      <button
                        title="Delete permanently"
                        disabled={isBusy}
                        onClick={() => onDelete(b)}
                        className="rounded-md p-1.5 text-ink-faint hover:bg-flow-deep/10 hover:text-flow-deep disabled:opacity-50"
                      >
                        {deletingId === b.id ? (
                          <span className="text-[10px]">…</span>
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectBackups;
