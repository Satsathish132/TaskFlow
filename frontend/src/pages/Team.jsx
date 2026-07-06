import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import RoleBadge from "../components/RoleBadge";
import { Field, Input, Select, Button } from "../components/kit";
import { canActOnRole, getAssignableRoles, ROLE_LABEL } from "../utils/roles";

const Team = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", personal_email: "", role: "MEMBER" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  const assignableRoles = getAssignableRoles(user.role);

  const load = async () => {
    const { data } = await api.get("/users/");
    setUsers(data);
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/create-user", form);
      setCreated({ email: data.email, name: `${form.first_name} ${form.last_name}`, emailSent: data.emailSent });
      setForm({ first_name: "", last_name: "", personal_email: "", role: "MEMBER" });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create that user.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setCreated(null);
    setError("");
  };

  const onChangeRole = async (userId, role) => {
    await api.put("/users/role", { userId, role });
    load();
  };

  const onDelete = async (userId) => {
    if (!confirm("Remove this person from the organization? This can't be undone.")) return;
    await api.delete(`/users/${userId}`);
    load();
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-flow-deep">Organization</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Team</h1>
        </div>
        <Button variant="accent" onClick={() => setModalOpen(true)}>
          + New member
        </Button>
      </div>

      {users?.length === 0 && (
        <EmptyState title="Just you, for now" body="Add your first team member to get everyone into Taskflow." />
      )}

      {users?.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-paper-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                // Must outrank the target AND the actor has to be allowed to
                // assign at least one role (SUB_ADMIN/MEMBER can't promote anyone).
                const editable =
                  canActOnRole(user.role, u.role) && u.id !== user.id && assignableRoles.length > 0;
                return (
                  <tr key={u.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3 text-ink">
                      {u.first_name} {u.last_name} {u.id === user.id && <span className="text-ink-faint">(you)</span>}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{u.email}</td>
                    <td className="px-5 py-3">
                      {editable ? (
                        <Select
                          value={u.role}
                          onChange={(e) => onChangeRole(u.id, e.target.value)}
                          className="!w-auto py-1.5 text-xs"
                        >
                          {/* Always include the user's current role so the select
                              has a valid value, even if the actor couldn't have
                              assigned that role themselves. */}
                          {[...new Set([u.role, ...assignableRoles])].map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <RoleBadge role={u.role} />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {u.must_change_password ? (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-status-progress">
                          Pending setup
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-status-done">Active</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {editable && (
                        <button
                          onClick={() => onDelete(u.id)}
                          className="text-xs text-ink-faint transition hover:text-flow-deep"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={created ? "Member created" : "New team member"}>
        {created ? (
          <div>
            <p className="text-sm text-ink-soft">
              <span className="font-medium text-ink">{created.name}</span> can now log in with:
            </p>
            <div className="my-4 rounded-lg border border-line bg-paper px-4 py-3 font-mono text-sm text-ink">
              {created.email}
            </div>
            <p className="mb-6 text-sm text-ink-soft">
              {created.emailSent
                ? "We've emailed them this login at their personal address. You can also share it directly."
                : "Share this email with them — they'll log in with it and set their own password on first sign-in."}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreated(null)}>
                Add another
              </Button>
              <Button variant="accent" onClick={closeModal}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onCreate}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required autoFocus />
              </Field>
              <Field label="Last name">
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
              </Field>
            </div>
            <Field label="Personal email (optional)">
              <Input
                type="email"
                value={form.personal_email}
                onChange={(e) => setForm({ ...form, personal_email: e.target.value })}
                placeholder="For reference only — they'll log in with their org email"
              />
            </Field>
            <Field label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="MEMBER">Member</option>
                <option value="SUB_ADMIN">Sub Admin</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </Field>
            {error && <p className="mb-4 text-sm text-flow-deep">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={submitting}>
                {submitting ? "Creating…" : "Create member"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
};

export default Team;
