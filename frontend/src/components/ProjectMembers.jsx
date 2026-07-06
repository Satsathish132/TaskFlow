import { useEffect, useMemo, useState } from "react";
import { memberApi, projectApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/roles";
import { Field, Select, Button } from "./kit";
import Modal from "./Modal";
import RoleBadge from "./RoleBadge";
import RoleGate from "./RoleGate";
import EmptyState from "./EmptyState";

/**
 * Renders a project's member list plus an "Assign to project" picker that
 * adds a workspace member onto the project (via POST /projects/assign) —
 * this is what backs the assignee dropdown on task creation.
 *
 * Usage: <ProjectMembers projectId={p.id} workspaceId={workspaceId} onChanged={reload} />
 */
export default function ProjectMembers({ projectId, workspaceId, onChanged }) {
  const { user } = useAuth();
  const [members, setMembers] = useState(null);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMembers = () => projectApi.members(projectId).then(setMembers);
  const loadWorkspaceMembers = () => memberApi.list(workspaceId).then(setWorkspaceMembers);

  useEffect(() => {
    loadMembers();
    loadWorkspaceMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, workspaceId]);

  // Only workspace members not already on this project can be assigned —
  // mirrors projectController.assignMember's own workspace_members check.
  const assignable = useMemo(() => {
    if (!members) return [];
    const memberIds = new Set(members.map((m) => m.id));
    return workspaceMembers.filter((u) => !memberIds.has(u.id));
  }, [members, workspaceMembers]);

  const notifyChanged = () => {
    loadMembers();
    onChanged?.();
  };

  const openAssign = () => {
    setError("");
    setPicked("");
    setAssignOpen(true);
  };

  const submitAssign = async (e) => {
    e.preventDefault();
    if (!picked) return;
    setSaving(true);
    setError("");
    try {
      await projectApi.assign(projectId, picked, workspaceId);
      setAssignOpen(false);
      notifyChanged();
    } catch (err) {
      setError(err.response?.data?.message || "Could not assign member.");
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (userId) => {
    if (!confirm("Remove this person from the project?")) return;
    try {
      await projectApi.remove(projectId, userId, workspaceId);
      notifyChanged();
    } catch (err) {
      alert(err.response?.data?.message || "Could not remove member.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Project team</h2>
        <RoleGate allow={can.manageProjectMembers}>
          <Button variant="accent" onClick={openAssign}>
            Assign to project
          </Button>
        </RoleGate>
      </div>

      {members === null && <p className="text-sm text-ink-soft">Loading…</p>}

      {members?.length === 0 && (
        <EmptyState
          title="No one assigned yet"
          body="Assign a workspace member to this project so tasks can be given to them."
          action={
            <RoleGate allow={can.manageProjectMembers}>
              <Button variant="accent" onClick={openAssign}>
                Assign to project
              </Button>
            </RoleGate>
          }
        />
      )}

      {members?.length > 0 && (
        <div className="divide-y divide-line rounded-2xl border border-line bg-paper-soft">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-ink">
                  {m.first_name} {m.last_name}
                  {m.id === user.id && <span className="font-normal text-ink-soft"> (you)</span>}
                </p>
                <p className="text-xs text-ink-soft">{m.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <RoleBadge role={m.role} />
                <RoleGate allow={can.manageProjectMembers}>
                  <button
                    className="text-xs text-flow-deep hover:underline"
                    onClick={() => removeMember(m.id)}
                  >
                    Remove
                  </button>
                </RoleGate>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign to project">
        <form onSubmit={submitAssign}>
          {error && (
            <p className="mb-4 rounded-lg bg-flow-tint px-3 py-2 text-sm text-flow-deep">{error}</p>
          )}
          <Field label="Workspace member">
            <Select value={picked} onChange={(e) => setPicked(e.target.value)} required>
              <option value="">Select someone…</option>
              {assignable.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} · {u.email}
                </option>
              ))}
            </Select>
          </Field>
          {assignable.length === 0 && workspaceMembers.length === 0 && (
            <p className="mb-4 text-xs text-ink-soft">
              No one is in this workspace yet — assign people to the workspace first.
            </p>
          )}
          {assignable.length === 0 && workspaceMembers.length > 0 && (
            <p className="mb-4 text-xs text-ink-soft">
              Everyone in this workspace is already on the project.
            </p>
          )}
          <Button type="submit" variant="accent" className="w-full" disabled={saving || !picked}>
            {saving ? "Assigning…" : "Assign to project"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
