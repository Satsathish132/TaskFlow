import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { memberApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import PriorityTag from "../components/PriorityTag";
import TaskFiles from "../components/TaskFiles";
import { Field, Input, Textarea, Select, Button } from "../components/kit";

// Full task management (edit/delete all fields), mirroring the workspace-level
// admin roles used elsewhere (see WorkspaceMembers.jsx).
const CAN_MANAGE_TASK = (role) => ["SUPER_ADMIN", "ADMIN", "SUB_ADMIN"].includes(role);

// Adjust to match your actual status enum if different.
const STATUS_OPTIONS = ["TODO", "IN_PROGRESS", "DONE"];

// due_date comes back from the API as a Date-parsable value (mysql2 DATETIME);
// <input type="date"> needs a plain "YYYY-MM-DD" string.
const toDateInputValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const TaskDetail = () => {
  const { id: taskId } = useParams();
  const [params] = useSearchParams();
  const workspaceId = params.get("workspaceId");
  const { user } = useAuth();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [comments, setComments] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTask = useCallback(async () => {
    const { data } = await api.get(`/tasks/${workspaceId}`);
    const found = data.find((t) => String(t.id) === String(taskId));
    setTask(found || null);
    if (found) {
      setForm({
        title: found.title,
        description: found.description || "",
        priority: found.priority,
        assignedTo: found.assigned_to || "",
        dueDate: toDateInputValue(found.due_date),
      });
    }
  }, [workspaceId, taskId]);

  // NOTE: keyed on task?.project_id (a stable primitive), not the whole
  // `task` object. `loadTask` sets a brand-new `task` object reference on
  // every fetch (it comes from `data.find(...)` on freshly-parsed JSON), so
  // depending on `task` itself here meant this callback got a new identity
  // every fetch too — which re-triggered the effect below — which called
  // loadTask() again — an infinite request loop. project_id doesn't change
  // between fetches of the same task, so this callback now stays stable.
  const loadMembers = useCallback(async () => {
    if (!task) return;
    try {
      if (task.project_id) {
        // Task belongs to a project — only that project's team can be assigned.
        const { data } = await api.get(`/projects/members/${task.project_id}`);
        setMembers(data);
      } else {
        // Workspace-only task (no project) — fall back to workspace members.
        const data = await memberApi.list(workspaceId);
        setMembers(data);
      }
    } catch {
      setMembers([]);
    }
  }, [task?.project_id, workspaceId]);

  const loadComments = useCallback(async () => {
    const { data } = await api.get(`/comments/${workspaceId}/${taskId}`);
    setComments(data);
  }, [workspaceId, taskId]);

  useEffect(() => {
    if (!workspaceId) return;
    loadTask();
    loadComments();
  }, [workspaceId, loadTask, loadComments]);

  // Runs once loadMembers becomes usable (task loaded) and again only if
  // the task's project actually changes — not on every task refetch.
  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  if (!workspaceId) {
    return (
      <AppShell>
        <p className="text-sm text-ink-soft">
          Missing workspace context.{" "}
          <button onClick={() => navigate(-1)} className="text-flow-deep hover:underline">
            Go back
          </button>
        </p>
      </AppShell>
    );
  }

  const onSave = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.put(`/tasks/${taskId}`, {
        ...form,
        assignedTo: form.assignedTo || undefined,
        dueDate: form.dueDate || null,
        workspaceId,
      });
      setEditing(false);
      loadTask();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save changes.");
    } finally {
      setSubmitting(false);
    }
  };

  const onStatusChange = async (newStatus) => {
    if (newStatus === task.status) return;
    const prevTask = task;
    setTask({ ...task, status: newStatus }); // optimistic
    try {
      // Dedicated status endpoint (same one the board's drag-and-drop uses),
      // not the full task-update endpoint — that one's admin-only.
      await api.put("/tasks/status", { taskId, status: newStatus, workspaceId });
      loadTask();
    } catch (err) {
      setTask(prevTask); // revert on failure
      alert(err.response?.data?.message || "Could not update status.");
    }
  };

  const onDelete = async () => {
    if (!confirm("Delete this task? This can't be undone.")) return;
    await api.delete(`/tasks/${taskId}`, { data: { workspaceId } });
    navigate(-1);
  };

  const onAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const text = commentText;
    setCommentText("");
    setComments((prev) => [
      {
        id: `temp-${Date.now()}`,
        comment: text,
        created_at: new Date().toISOString(),
        first_name: user.first_name,
        last_name: user.last_name,
      },
      ...(prev || []),
    ]);
    try {
      await api.post("/comments/add", { taskId, comment: text, workspaceId });
    } catch {
      loadComments();
    }
  };

  if (task === null && !error) {
    return (
      <AppShell>
        <p className="text-sm text-ink-faint">Loading…</p>
      </AppShell>
    );
  }

  if (!task) {
    return (
      <AppShell>
        <p className="text-sm text-ink-soft">Task not found.</p>
      </AppShell>
    );
  }

  const canManage = CAN_MANAGE_TASK(user.role);
  const isAssignee = String(task.assigned_to) === String(user.id);
  const isOverdue = task.due_date && task.status !== "DONE" && new Date(task.due_date) < new Date();

  return (
    <AppShell>
      <button onClick={() => navigate(-1)} className="mb-5 text-xs text-ink-faint hover:text-ink">
        ← Back to board
      </button>

      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-line bg-paper-soft p-7 shadow-lifted">
          {!editing ? (
            <>
              <div className="mb-1 flex items-start justify-between gap-3">
                <h1 className="font-display text-2xl text-ink">{task.title}</h1>
                <PriorityTag priority={task.priority} />
              </div>
              <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                Assigned to {task.assignedToName || "no one"}
              </p>
              {task.due_date && (
                <p
                  className={`mb-6 font-mono text-[11px] uppercase tracking-wider ${
                    isOverdue ? "text-flow-deep" : "text-ink-faint"
                  }`}
                >
                  {isOverdue ? "Overdue — was due " : "Due "}
                  {new Date(task.due_date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
              {!task.due_date && <div className="mb-6" />}
              {task.description ? (
                <p className="mb-6 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{task.description}</p>
              ) : (
                <p className="mb-6 text-sm italic text-ink-faint">No description.</p>
              )}

              {canManage ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={onDelete}>
                    Delete
                  </Button>
                  <Select
                    className="!w-auto py-1.5 text-xs ml-auto"
                    value={task.status}
                    onChange={(e) => onStatusChange(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : isAssignee ? (
                <Field label="Status">
                  <Select
                    className="!w-auto py-1.5 text-xs"
                    value={task.status}
                    onChange={(e) => onStatusChange(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                  Status: {task.status.replace("_", " ")}
                </p>
              )}
            </>
          ) : canManage ? (
            <form onSubmit={onSave}>
              <Field label="Title">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </Field>
              <Field label="Description">
                <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority">
                  <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </Select>
                </Field>
                <Field label="Assignee">
                  <Select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {members.length === 0 && (
                <p className="mb-4 -mt-2 text-xs text-ink-soft">
                  {task.project_id
                    ? "No one is assigned to this project yet — assign the project team first, then come back here."
                    : "No one is in this workspace yet."}
                </p>
              )}
              <Field label="Due date (optional)">
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </Field>
              {error && <p className="mb-4 text-sm text-flow-deep">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" disabled={submitting}>
                  {submitting ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          ) : null}
        </div>

          <div className="mt-6">
          <TaskFiles taskId={taskId} currentUserId={user.id} />
        </div>
        
        <div className="mt-6">
          <h2 className="mb-3 font-display text-lg text-ink">Comments</h2>
          <form onSubmit={onAddComment} className="mb-4 flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
            />
            <Button type="submit" variant="accent">
              Post
            </Button>
          </form>

          {comments?.length === 0 && <p className="text-sm text-ink-faint">No comments yet.</p>}

          <ul className="space-y-3">
            {comments?.map((c) => (
              <li key={c.id} className="animate-rise-in rounded-xl border border-line bg-paper-soft p-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                    {new Date(c.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="text-sm text-ink-soft">{c.comment}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
};

export default TaskDetail;
