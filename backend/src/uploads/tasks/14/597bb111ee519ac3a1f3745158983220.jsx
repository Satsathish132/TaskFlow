import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Filter, Calendar, Users, X, ChevronDown } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import RoleGate from "../components/RoleGate";
import RoleBadge from "../components/RoleBadge";
import WorkspaceMembers from "../components/WorkspaceMembers";
import ProjectBackups from "../components/ProjectBackups";
import { Field, Input, Textarea, Button } from "../components/kit";
import { can } from "../utils/roles";

// Who can restore/permanently delete backed-up projects (mirrors the
// project board's own gate — kept local since it's UI-only).
const CAN_MANAGE_PROJECT = (role) => ["SUPER_ADMIN", "ADMIN"].includes(role);

const TABS = ["Projects", "Members", "Activity"];
const ACTIVITY_PAGE_SIZE = 5;
const ACTIVITY_PRESETS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

// Format a Date as "YYYY-MM-DDTHH:mm" in local time, the shape <input type="datetime-local"> expects.
const toLocalInputValue = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const Workspace = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("Projects");
  const [meta, setMeta] = useState(null);
  const [projects, setProjects] = useState(null);
  const [activity, setActivity] = useState(null);

  const [projectModal, setProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
const [editModal, setEditModal] = useState(false);
const [editForm, setEditForm] = useState({ name: "", description: "" });
const [editError, setEditError] = useState("");
const [editSubmitting, setEditSubmitting] = useState(false);

const [deleteModal, setDeleteModal] = useState(false);
const [deleteBackup, setDeleteBackup] = useState(true);
const [deleteConfirmText, setDeleteConfirmText] = useState("");
const [deleteError, setDeleteError] = useState("");
const [deleting, setDeleting] = useState(false);

  const [activityFilter, setActivityFilter] = useState("");
  const [activityPreset, setActivityPreset] = useState("all");
  const [activityDateFrom, setActivityDateFrom] = useState("");
  const [activityDateTo, setActivityDateTo] = useState("");
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [activityVisibleCount, setActivityVisibleCount] = useState(ACTIVITY_PAGE_SIZE);

  const loadMeta = useCallback(async () => {
    const { data } = await api.get("/workspaces/my");
    setMeta(data.find((w) => String(w.id) === String(id)) || null);
  }, [id]);

  const loadProjects = useCallback(async () => {
    const { data } = await api.get(`/projects/${id}`);
    setProjects(data);
  }, [id]);

  const loadActivity = useCallback(async () => {
    const { data } = await api.get(`/activity/${id}`);
    setActivity(data);
  }, [id]);

  useEffect(() => {
    loadMeta();
    loadProjects();
  }, [loadMeta, loadProjects]);

  useEffect(() => {
    if (tab === "Activity" && activity === null) loadActivity();
  }, [tab, activity, loadActivity]);

  // Reset pagination whenever a filter changes, or a fresh activity list loads.
  useEffect(() => {
    setActivityVisibleCount(ACTIVITY_PAGE_SIZE);
  }, [activityFilter, activityPreset, activityDateFrom, activityDateTo, activity]);

  const activityUsers = useMemo(() => {
    if (!activity?.length) return [];
    return Array.from(new Set(activity.map((a) => a.user_name))).sort();
  }, [activity]);

  const applyPreset = (presetKey) => {
    setActivityPreset(presetKey);

    if (presetKey === "custom") {
      setShowCustomRange(true);
      return;
    }

    setShowCustomRange(false);

    if (presetKey === "all") {
      setActivityDateFrom("");
      setActivityDateTo("");
      return;
    }

    const now = new Date();
    const from = new Date(now);

    if (presetKey === "today") {
      from.setHours(0, 0, 0, 0);
    } else if (presetKey === "7d") {
      from.setDate(from.getDate() - 7);
    } else if (presetKey === "30d") {
      from.setDate(from.getDate() - 30);
    }

    setActivityDateFrom(toLocalInputValue(from));
    setActivityDateTo(toLocalInputValue(now));
  };

  const clearActivityFilters = () => {
    setActivityFilter("");
    setActivityPreset("all");
    setActivityDateFrom("");
    setActivityDateTo("");
    setShowCustomRange(false);
  };

  const filteredActivity = useMemo(() => {
    if (!activity?.length) return activity;

    const fromTime = activityDateFrom ? new Date(activityDateFrom).getTime() : null;
    const toTime = activityDateTo ? new Date(activityDateTo).getTime() : null;

    return activity.filter((a) => {
      if (activityFilter && a.user_name !== activityFilter) return false;

      const eventTime = new Date(a.created_at).getTime();
      if (fromTime !== null && eventTime < fromTime) return false;
      if (toTime !== null && eventTime > toTime) return false;

      return true;
    });
  }, [activity, activityFilter, activityDateFrom, activityDateTo]);

  const visibleActivity = filteredActivity?.slice(0, activityVisibleCount) ?? null;
  const hasMoreActivity = (filteredActivity?.length ?? 0) > activityVisibleCount;

  const onCreateProject = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/projects/create", { workspaceId: id, ...projectForm });
      setProjectModal(false);
      setProjectForm({ name: "", description: "" });
      await loadProjects();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create the project.");
    } finally {
      setSubmitting(false);
    }
  };
  useEffect(() => {
  if (meta) setEditForm({ name: meta.name || "", description: meta.description || "" });
}, [meta]);

const onUpdateWorkspace = async (e) => {
  e.preventDefault();
  setEditError("");
  setEditSubmitting(true);
  try {
    await api.put(`/workspaces/${id}`, editForm);
    setEditModal(false);
    await loadMeta();
  } catch (err) {
    setEditError(err.response?.data?.message || "Couldn't update workspace.");
  } finally {
    setEditSubmitting(false);
  }
};

const onDeleteWorkspace = async () => {
  setDeleteError("");
  setDeleting(true);
  try {
    await api.delete(`/workspaces/${id}`, { params: { backup: deleteBackup } });
    navigate("/dashboard");
  } catch (err) {
    setDeleteError(err.response?.data?.message || "Couldn't delete workspace.");
    setDeleting(false);
  }
};

  return (
    <AppShell>
      <div className="mb-6">
  <button onClick={() => navigate("/dashboard")} className="mb-3 text-xs text-ink-faint hover:text-ink">
    ← Dashboard
  </button>
  <div className="flex items-end justify-between">
    <div>
      <h1 className="font-display text-3xl text-ink">{meta?.name || "Workspace"}</h1>
      {meta?.description && <p className="mt-1 text-sm text-ink-soft">{meta.description}</p>}
    </div>
    <div className="flex items-center gap-3">
      {meta?.role && <RoleBadge role={meta.role} />}
      <RoleGate allow={can.editWorkspace}>
        <div className="relative">
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            className="rounded-full border border-line bg-paper-soft px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
          >
            Settings
          </button>
          {settingsOpen && (
            <div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-line bg-paper-soft py-1 shadow-lifted">
              <button
                onClick={() => {
                  setSettingsOpen(false);
                  setEditModal(true);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-line/40"
              >
                Edit details
              </button>
              <RoleGate allow={can.deleteWorkspace}>
                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    setDeleteModal(true);
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-flow-deep hover:bg-line/40"
                >
                  Delete workspace
                </button>
              </RoleGate>
            </div>
          )}
        </div>
      </RoleGate>
    </div>
  </div>
</div>

      <div className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2.5 text-sm font-medium transition ${
              tab === t ? "text-ink" : "text-ink-faint hover:text-ink-soft"
            }`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-flow" />}
          </button>
        ))}
      </div>

      {tab === "Projects" && (
        <section>
          <div className="mb-4 flex items-center justify-end gap-2">
            <RoleGate allow={CAN_MANAGE_PROJECT}>
              <ProjectBackups
                workspaceId={id}
                onRestored={(newProjectId) => navigate(`/projects/${newProjectId}?workspaceId=${id}`)}
              />
            </RoleGate>
            <RoleGate allow={can.createProject} showLocked lockedLabel="Only Admins can create projects">
              <Button variant="accent" onClick={() => setProjectModal(true)}>
                + New project
              </Button>
            </RoleGate>
          </div>

          {projects?.length === 0 && (
            <EmptyState
              title="No projects yet"
              body="Create a project to start grouping tasks for this workspace."
              action={
                can.createProject(user?.role) && (
                  <Button variant="accent" onClick={() => setProjectModal(true)}>
                    + New project
                  </Button>
                )
              }
            />
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects?.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}?workspaceId=${id}`}
                className="group rounded-2xl border border-line bg-paper-soft p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lifted"
              >
                <div className="mb-3 h-px w-8 bg-flow transition-all group-hover:w-14" />
                <h3 className="font-display text-lg text-ink">{p.name}</h3>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{p.description}</p>}
                <p className="mt-3 text-xs text-ink-faint">by {p.createdBy}</p>
                <div className="mt-4 flex gap-3 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                  <span>{p.taskCount} total</span>
                  <span className="text-status-progress">{p.activeCount} active</span>
                  <span>{p.todoCount} todo</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tab === "Members" && <WorkspaceMembers workspaceId={id} />}

      {tab === "Activity" && (
        <section>
          {activity?.length > 0 && (
            <div className="mb-5 rounded-2xl border border-line bg-paper-soft p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-faint">
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                </div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                  {filteredActivity.length} {filteredActivity.length === 1 ? "event" : "events"}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {ACTIVITY_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => applyPreset(p.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      activityPreset === p.key
                        ? "bg-flow text-white shadow-sm"
                        : "bg-paper text-ink-soft hover:bg-line hover:text-ink"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}

                <div className="mx-1 h-4 w-px bg-line" />

                <div className="relative">
                  <select
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value)}
                    className="appearance-none rounded-full border border-line bg-paper py-1.5 pl-8 pr-8 text-xs font-medium text-ink-soft transition hover:text-ink"
                  >
                    <option value="">All members</option>
                    {activityUsers.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <Users className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                </div>
              </div>

              <div
                className={`grid overflow-hidden transition-all duration-300 ease-out ${
                  showCustomRange ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="flex flex-wrap items-end gap-3 overflow-hidden">
                  <Field label="From">
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                      <input
                        type="datetime-local"
                        value={activityDateFrom}
                        onChange={(e) => {
                          setActivityDateFrom(e.target.value);
                          setActivityPreset("custom");
                        }}
                        className="rounded-lg border border-line bg-paper py-1.5 pl-8 pr-3 text-sm text-ink"
                      />
                    </div>
                  </Field>

                  <Field label="To">
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                      <input
                        type="datetime-local"
                        value={activityDateTo}
                        onChange={(e) => {
                          setActivityDateTo(e.target.value);
                          setActivityPreset("custom");
                        }}
                        className="rounded-lg border border-line bg-paper py-1.5 pl-8 pr-3 text-sm text-ink"
                      />
                    </div>
                  </Field>
                </div>
              </div>

              {(activityFilter || activityPreset !== "all") && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {activityFilter && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-flow/10 px-2.5 py-1 text-xs font-medium text-flow-deep">
                      <Users className="h-3 w-3" />
                      {activityFilter}
                      <button onClick={() => setActivityFilter("")} className="rounded-full hover:bg-flow/20">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {activityPreset !== "all" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-flow/10 px-2.5 py-1 text-xs font-medium text-flow-deep">
                      <Calendar className="h-3 w-3" />
                      {ACTIVITY_PRESETS.find((p) => p.key === activityPreset)?.label}
                      <button
                        onClick={() => applyPreset("all")}
                        className="rounded-full hover:bg-flow/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  <button
                    onClick={clearActivityFilters}
                    className="text-xs font-medium text-ink-faint underline-offset-2 hover:text-ink hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}

          {activity?.length === 0 && (
            <EmptyState title="No activity yet" body="Actions taken in this workspace will show up here." />
          )}

          {filteredActivity?.length === 0 && activity?.length > 0 && (
            <EmptyState title="No matching activity" body="Try a different member or date range." />
          )}

          {visibleActivity?.length > 0 && (
            <>
              <ul className="space-y-1.5">
                {visibleActivity.map((a, i) => (
                  <li
                    key={a.id}
                    className="animate-rise-in flex items-center gap-4 rounded-xl border border-line bg-paper-soft px-5 py-3 transition-all hover:-translate-y-0.5 hover:border-flow/30 hover:shadow-card"
                    style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                  >
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-flow" />
                    <p className="flex-1 text-sm text-ink">
                      <span className="font-medium">{a.user_name}</span> {a.action}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>

              {hasMoreActivity && (
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={() => setActivityVisibleCount((c) => c + ACTIVITY_PAGE_SIZE)}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-soft px-4 py-2 text-xs font-medium text-ink-soft transition-all hover:border-flow/40 hover:text-ink hover:shadow-card"
                  >
                    Show more
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <Modal open={projectModal} onClose={() => setProjectModal(false)} title="New project">
        <form onSubmit={onCreateProject}>
          <Field label="Name">
            <Input
              value={projectForm.name}
              onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              required
              autoFocus
            />
          </Field>
          <Field label="Description (optional)">
            <Textarea
              rows={3}
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
            />
          </Field>
          {error && <p className="mb-4 text-sm text-flow-deep">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setProjectModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={submitting}>
              {submitting ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit workspace">
  <form onSubmit={onUpdateWorkspace}>
    <Field label="Name">
      <Input
        value={editForm.name}
        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
        required
        autoFocus
      />
    </Field>
    <Field label="Description (optional)">
      <Textarea
        rows={3}
        value={editForm.description}
        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
      />
    </Field>
    {editError && <p className="mb-4 text-sm text-flow-deep">{editError}</p>}
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" onClick={() => setEditModal(false)}>
        Cancel
      </Button>
      <Button type="submit" variant="accent" disabled={editSubmitting}>
        {editSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </div>
  </form>
</Modal>

<Modal
  open={deleteModal}
  onClose={() => {
    setDeleteModal(false);
    setDeleteConfirmText("");
    setDeleteError("");
  }}
  title="Delete workspace"
>
  <p className="mb-4 text-sm text-ink-soft">
    This permanently deletes <span className="font-medium text-ink">{meta?.name}</span>, including all its
    projects, tasks, comments, and members. This can't be undone from here.
  </p>

  <label className="mb-4 flex items-start gap-2 text-sm text-ink">
    <input
      type="checkbox"
      checked={deleteBackup}
      onChange={(e) => setDeleteBackup(e.target.checked)}
      className="mt-0.5"
    />
    <span>
      Back up the workspace's data before deleting
      <span className="block text-xs text-ink-faint">
        Saves a snapshot (projects, tasks, comments, members) that an Admin can retrieve later.
      </span>
    </span>
  </label>

  <Field label={`Type the workspace name to confirm ("${meta?.name}")`}>
    <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} />
  </Field>

  {deleteError && <p className="mb-4 text-sm text-flow-deep">{deleteError}</p>}

  <div className="flex justify-end gap-2">
    <Button type="button" variant="ghost" onClick={() => setDeleteModal(false)}>
      Cancel
    </Button>
    <Button
      type="button"
      variant="accent"
      disabled={deleting || deleteConfirmText !== meta?.name}
      onClick={onDeleteWorkspace}
    >
      {deleting ? "Deleting…" : "Delete workspace"}
    </Button>
  </div>
</Modal>
    </AppShell>
  );
};

export default Workspace;
