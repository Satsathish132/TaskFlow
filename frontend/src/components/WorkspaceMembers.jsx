import { useEffect, useMemo, useState } from "react";
import { memberApi, userApi } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { Field, Select, Button } from "./kit";
import Modal from "./Modal";
import RoleBadge from "./RoleBadge";
import RoleGate from "./RoleGate";
import EmptyState from "./EmptyState";

// Roles allowed to manage workspace membership, mirroring memberController.js exactly.
const CAN_ADD = (role) => ["SUPER_ADMIN", "ADMIN", "SUB_ADMIN"].includes(role);
const CAN_REMOVE = (role) => ["SUPER_ADMIN", "ADMIN"].includes(role);
const CAN_CHANGE_ROLE = (role) => role === "SUPER_ADMIN";

const ASSIGNABLE_ROLES = ["ADMIN", "SUB_ADMIN", "MEMBER"];

/**
 * Renders a workspace's member list plus an "Assign team member" picker
 * that adds an existing org user straight into the workspace (via
 * POST /members/add-existing) — no email/token invite involved.
 *
 * Usage: <WorkspaceMembers workspaceId={workspace.id} />
 */
export default function WorkspaceMembers({ workspaceId }) {
  const { user } = useAuth();
  const [members, setMembers] = useState(null);
  const [orgUsers, setOrgUsers] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadMembers = () => memberApi.list(workspaceId).then(setMembers);
  const loadOrgUsers = () => userApi.orgUsers().then(setOrgUsers);

  useEffect(() => {
    loadMembers();
    loadOrgUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // Only org members not already in this workspace can be assigned.
  const assignable = useMemo(() => {
    if (!members) return [];
    const memberIds = new Set(members.map((m) => m.id));
    return orgUsers.filter((u) => !memberIds.has(u.id));
  }, [members, orgUsers]);

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
      await memberApi.addExisting(workspaceId, picked);
      setAssignOpen(false);
      loadMembers();
    } catch (err) {
      setError(err.response?.data?.message || "Could not assign member.");
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (userId, role) => {
    try {
      await memberApi.changeRole(workspaceId, userId, role);
      loadMembers();
    } catch (err) {
      alert(err.response?.data?.message || "Could not change role.");
    }
  };

  const removeMember = async (userId) => {
    if (!confirm("Remove this member from the workspace?")) return;
    try {
      await memberApi.remove(workspaceId, userId);
      loadMembers();
    } catch (err) {
      alert(err.response?.data?.message || "Could not remove member.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Members</h2>
        <RoleGate allow={CAN_ADD}>
          <Button variant="accent" onClick={openAssign}>
            Assign team member
          </Button>
        </RoleGate>
      </div>

      {members === null && <p className="text-sm text-ink-soft">Loading…</p>}

      {members?.length === 0 && (
        <EmptyState
          title="No members yet"
          body="Assign someone from your organization to give them access to this workspace."
          action={
            <RoleGate allow={CAN_ADD}>
              <Button variant="accent" onClick={openAssign}>
                Assign team member
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
                {CAN_CHANGE_ROLE(user.role) && m.id !== user.id ? (
                  <Select
                    className="!w-auto py-1.5 text-xs"
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <RoleBadge role={m.role} />
                )}
                {CAN_REMOVE(user.role) && m.id !== user.id && m.role !== "SUPER_ADMIN" && (
                  <button
                    className="text-xs text-flow-deep hover:underline"
                    onClick={() => removeMember(m.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign team member">
        <form onSubmit={submitAssign}>
          {error && (
            <p className="mb-4 rounded-lg bg-flow-tint px-3 py-2 text-sm text-flow-deep">{error}</p>
          )}
          <Field label="Organization member">
            <Select value={picked} onChange={(e) => setPicked(e.target.value)} required>
              <option value="">Select someone…</option>
              {assignable.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} · {u.email}
                </option>
              ))}
            </Select>
          </Field>
          {assignable.length === 0 && (
            <p className="mb-4 text-xs text-ink-soft">
              Everyone in your organization is already a member of this workspace.
            </p>
          )}
          <Button type="submit" variant="accent" className="w-full" disabled={saving || !picked}>
            {saving ? "Assigning…" : "Assign to workspace"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
