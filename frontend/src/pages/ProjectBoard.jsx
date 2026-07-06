import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { projectApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import Modal from "../components/Modal";
import RoleGate from "../components/RoleGate";
import PriorityTag from "../components/PriorityTag";
import ProjectMembers from "../components/ProjectMembers";
import { Field, Input, Textarea, Select, Button } from "../components/kit";
import { can } from "../utils/roles";

// Who can change ANY task's status, regardless of assignment.
const CAN_MANAGE_TASK = (role) => ["SUPER_ADMIN", "ADMIN", "SUB_ADMIN"].includes(role);

const COLUMNS = [
  { key: "TODO", label: "Todo", accent: "bg-status-todo" },
  { key: "IN_PROGRESS", label: "In progress", accent: "bg-status-progress" },
  { key: "DONE", label: "Done", accent: "bg-status-done" },
];

const formatDueDate = (value) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const TaskCard = ({ task, canDrag, onDragStart, onClick }) => {
  const isOverdue = task.due_date && task.status !== "DONE" && new Date(task.due_date) < new Date();

  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => canDrag && onDragStart(e, task.id)}
      onClick={onClick}
      title={canDrag ? undefined : "Only the assignee or an admin can change this task's status"}
      className={`animate-rise-in mb-3 rounded-xl border border-line bg-paper-soft p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-lifted ${
        canDrag ? "cursor-pointer active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-ink">{task.title}</p>
        <PriorityTag priority={task.priority} />
      </div>
      {task.description && <p className="mb-2 line-clamp-2 text-xs text-ink-soft">{task.description}</p>}
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        <span>{task.assignedToName || "Unassigned"}</span>
        <span className="flex items-center gap-2">
          {task.due_date && (
            <span className={isOverdue ? "text-flow-deep" : ""}>
              {isOverdue ? "Overdue " : "Due "}
              {formatDueDate(task.due_date)}
            </span>
          )}
          {task.commentCount > 0 && <span>{task.commentCount} comment{task.commentCount === 1 ? "" : "s"}</span>}
        </span>
      </div>
    </div>
  );
};

const ProjectBoard = () => {
  const { id: projectId } = useParams();
  const [params] = useSearchParams();
  const workspaceId = params.get("workspaceId");
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [members, setMembers] = useState([]);
  const [showTeam, setShowTeam] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM", assignedTo: "", dueDate: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragOverCol, setDragOverCol] = useState(null);

  const canManage = CAN_MANAGE_TASK(user.role);

  const loadTasks = useCallback(async () => {
    if (!workspaceId) return;
    const { data } = await api.get(`/tasks/${workspaceId}`);
    setTasks(data.filter((t) => String(t.project_id) === String(projectId)));
  }, [workspaceId, projectId]);

  const loadProjectMeta = useCallback(async () => {
    if (!workspaceId) return;
    const { data } = await api.get(`/projects/${workspaceId}`);
    setProject(data.find((p) => String(p.id) === String(projectId)) || null);
  }, [workspaceId, projectId]);

  const loadMembers = useCallback(() => {
    projectApi.members(projectId).then(setMembers).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    loadProjectMeta();
    loadTasks();
    loadMembers();
  }, [loadProjectMeta, loadTasks, loadMembers]);

  if (!workspaceId) {
    return (
      <AppShell>
        <p className="text-sm text-ink-soft">
          Missing workspace context.{" "}
          <button onClick={() => navigate("/dashboard")} className="text-flow-deep hover:underline">
            Back to dashboard
          </button>
        </p>
      </AppShell>
    );
  }

  // A given task's status can be changed by an admin/sub admin, or by
  // whoever it's assigned to — nobody else.
  const canChangeStatus = (task) => canManage || String(task.assigned_to) === String(user.id);

  const onDragStart = (e, taskId) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const onDrop = async (e, status) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("taskId");
    const task = tasks.find((t) => String(t.id) === String(taskId));
    if (!task || task.status === status) return;
    if (!canChangeStatus(task)) return; // guard even if drag somehow started

    setTasks((prev) => prev.map((t) => (String(t.id) === String(taskId) ? { ...t, status } : t)));
    try {
      await api.put("/tasks/status", { taskId, status, workspaceId });
    } catch {
      loadTasks();
    }
  };

  const onCreateTask = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/tasks/create", {
        workspaceId,
        projectId,
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        assignedTo: form.assignedTo || undefined,
        dueDate: form.dueDate || undefined,
      });
      setModalOpen(false);
      setForm({ title: "", description: "", priority: "MEDIUM", assignedTo: "", dueDate: "" });
      loadTasks();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create the task.");
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateTask = () => {
    setError("");
    if (members.length === 0) {
      setError("No one is assigned to this project yet — assign the team first, then create tasks.");
    }
    setModalOpen(true);
  };

  return (
    <AppShell>
      <div className="mb-6">
        <Link to={`/workspaces/${workspaceId}`} className="mb-3 block text-xs text-ink-faint hover:text-ink">
          ← Back to workspace
        </Link>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl text-ink">{project?.name || "Project"}</h1>
            {project?.description && <p className="mt-1 text-sm text-ink-soft">{project.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowTeam((s) => !s)}>
              {showTeam ? "Hide team" : `Team (${members.length})`}
            </Button>
            <RoleGate allow={can.createTask} showLocked lockedLabel="Sub Admins can't create tasks">
              <Button variant="accent" onClick={openCreateTask}>
                + New task
              </Button>
            </RoleGate>
          </div>
        </div>
      </div>

      {showTeam && (
        <div className="mb-6 rounded-2xl border border-line bg-paper-soft p-5">
          <ProjectMembers projectId={projectId} workspaceId={workspaceId} onChanged={loadMembers} />
        </div>
      )}

      <div className="kanban-scroll flex gap-5 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks?.filter((t) => t.status === col.key) || [];
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col.key);
              }}
              onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => onDrop(e, col.key)}
              className={`w-80 flex-shrink-0 rounded-2xl border p-3 transition ${
                dragOverCol === col.key ? "border-flow bg-flow-tint" : "border-line bg-paper-deep/40"
              }`}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">{col.label}</h3>
                <span className="ml-auto font-mono text-[11px] text-ink-faint">{colTasks.length}</span>
              </div>

              {tasks === null && <p className="px-1 text-xs text-ink-faint">Loading…</p>}

              {tasks !== null && colTasks.length === 0 && (
                <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-ink-faint">
                  Nothing here yet
                </div>
              )}

              {colTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  canDrag={canChangeStatus(t)}
                  onDragStart={onDragStart}
                  onClick={() => navigate(`/tasks/${t.id}?workspaceId=${workspaceId}`)}
                />
              ))}
            </div>
          );
        })}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New task">
        <form onSubmit={onCreateTask}>
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required autoFocus />
          </Field>
          <Field label="Description (optional)">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
          <Field label="Due date (optional)">
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>
          {members.length === 0 && (
            <p className="mb-4 text-xs text-ink-soft">
              No one is assigned to this project yet. Close this, click{" "}
              <span className="font-medium text-ink">Team</span>, and assign someone first — or create the
              task unassigned and assign it later.
            </p>
          )}
          {error && <p className="mb-4 text-sm text-flow-deep">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={submitting}>
              {submitting ? "Creating…" : "Create task"}
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
};

export default ProjectBoard;
