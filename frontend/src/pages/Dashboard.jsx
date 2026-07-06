import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import RoleGate from "../components/RoleGate";
import { Field, Input, Textarea, Button } from "../components/kit";
import { can } from "../utils/roles";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const loadWorkspaces = async () => {
    const { data } = await api.get("/workspaces/my");
    setWorkspaces(data);
    return data;
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const { data } = await api.post("/workspaces/create", form);
      setModalOpen(false);
      setForm({ name: "", description: "" });
      await loadWorkspaces();
      navigate(`/workspaces/${data.workspaceId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create the workspace.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-flow-deep">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="mt-1 font-display text-3xl text-ink">
            Morning, {user?.first_name}.
          </h1>
        </div>
        <RoleGate allow={can.createWorkspace}>
          <Button variant="accent" onClick={() => setModalOpen(true)}>
            + New workspace
          </Button>
        </RoleGate>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Your workspaces</h2>

        {workspaces === null && <p className="text-sm text-ink-faint">Loading…</p>}

        {workspaces?.length === 0 && (
          <EmptyState
            title="No workspaces yet"
            body={
              can.createWorkspace(user?.role)
                ? "Create your first workspace to start organizing projects and tasks."
                : "You haven't been added to a workspace yet. Ask an admin to add you."
            }
            action={
              can.createWorkspace(user?.role) && (
                <Button variant="accent" onClick={() => setModalOpen(true)}>
                  + New workspace
                </Button>
              )
            }
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces?.map((w) => (
            <Link
              key={w.id}
              to={`/workspaces/${w.id}`}
              className="group rounded-2xl border border-line bg-paper-soft p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lifted"
            >
              <div className="mb-3 h-px w-8 bg-flow transition-all group-hover:w-14" />
              <h3 className="font-display text-lg text-ink">{w.name}</h3>
              {w.description && (
                <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{w.description}</p>
              )}
              <div className="mt-4 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                <span>{w.projectCount} project{w.projectCount === 1 ? "" : "s"}</span>
                <span>{w.role}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New workspace">
        <form onSubmit={onCreate}>
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          </Field>
          <Field label="Description (optional)">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          {error && <p className="mb-4 text-sm text-flow-deep">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={creating}>
              {creating ? "Creating…" : "Create workspace"}
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
};

export default Dashboard;
