import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import RoleGate from "../components/RoleGate";
import RoleBadge from "../components/RoleBadge";
import WorkspaceMembers from "../components/WorkspaceMembers";
import { Field, Input, Textarea, Button } from "../components/kit";
import { can } from "../utils/roles";

const TABS = ["Projects", "Members", "Activity"];

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
          {meta?.role && <RoleBadge role={meta.role} />}
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
          <div className="mb-4 flex justify-end">
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
          {activity?.length === 0 && (
            <EmptyState title="No activity yet" body="Actions taken in this workspace will show up here." />
          )}
          {activity?.length > 0 && (
            <ul className="space-y-1">
              {activity.map((a, i) => (
                <li
                  key={a.id}
                  className="animate-rise-in flex items-center gap-4 rounded-xl border border-line bg-paper-soft px-5 py-3"
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
    </AppShell>
  );
};

export default Workspace;
