import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import RoleBadge from "../components/RoleBadge";
import { Field, Input, Button } from "../components/kit";
import axios from "axios";
import api from "../lib/api";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const token = () => localStorage.getItem("accessToken");
const authHeaders = () => ({ headers: { Authorization: `Bearer ${token()}` } });

// ── Section wrapper ───────────────────────────────────────────────
const Section = ({ title, subtitle, children }) => (
  <div className="rounded-2xl border border-line bg-paper-soft p-6">
    <h2 className="mb-1 font-display text-lg text-ink">{title}</h2>
    {subtitle && <p className="mb-4 text-sm text-ink-soft">{subtitle}</p>}
    {children}
  </div>
);

// ── Toggle row ────────────────────────────────────────────────────
const Toggle = ({ label, description, checked, onChange, disabled }) => (
  <div className="flex items-center justify-between py-3 border-b border-line last:border-0">
    <div>
      <p className="text-sm font-medium text-ink">{label}</p>
      {description && <p className="text-xs text-ink-soft mt-0.5">{description}</p>}
    </div>
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-flow" : "bg-line"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
        checked ? "translate-x-4" : "translate-x-1"
      }`} />
    </button>
  </div>
);

// ── Tab button ────────────────────────────────────────────────────
const Tab = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
      active
        ? "bg-ink text-paper"
        : "text-ink-soft hover:bg-line/50 hover:text-ink"
    }`}
  >
    {label}
  </button>
);

// ─────────────────────────────────────────────────────────────────
const Settings = () => {
  const { user, changePassword } = useAuth();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user?.role);

  const tabs = [
    { id: "profile",       label: "Profile" },
    { id: "security",      label: "Security" },
    { id: "notifications", label: "Notifications" },
    { id: "activity",      label: "Activity" },
    ...(isAdmin ? [{ id: "analytics", label: "Analytics" }] : []),
  ];

  const [activeTab, setActiveTab] = useState("profile");

  return (
    <AppShell>
      <div className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-wider text-flow-deep">Account</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-line pb-3">
        {tabs.map(t => (
          <Tab key={t.id} label={t.label} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />
        ))}
      </div>

      <div className={activeTab === "activity" ? "max-w-3xl space-y-6" : "max-w-2xl space-y-6"}>
        {activeTab === "profile"       && <ProfileTab user={user} changePassword={changePassword} />}
        {activeTab === "security"      && <SecurityTab />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "activity"      && <ActivityTab />}
        {activeTab === "analytics" && isAdmin && <AnalyticsTab />}
      </div>
    </AppShell>
  );
};

// ─────────────────────────────────────────────────────────────────
// PROFILE TAB
// ─────────────────────────────────────────────────────────────────
const ProfileTab = ({ user, changePassword }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState(null);

  useEffect(() => {
    axios.get(`${API}/settings/security/accounts`, authHeaders())
      .then(r => setAccounts(r.data))
      .catch(() => {});
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!currentPassword) return setError("Enter your current password.");
    if (password.length < 6) return setError("New password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setSubmitting(true);
    try {
      await changePassword(currentPassword, password);
      setSuccess("Password changed successfully.");
      setCurrentPassword(""); setPassword(""); setConfirm("");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't change your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Profile info */}
      <Section title="Profile">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink font-mono text-sm text-paper">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div>
            <p className="text-sm font-medium text-ink">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-ink-soft">{user?.email}</p>
          </div>
          <div className="ml-auto">
            <RoleBadge role={user?.role} />
          </div>
        </div>
      </Section>

      {/* Change password */}
      <Section title="Change password" subtitle="Confirm your current password, then set a new one (at least 6 characters).">
        <form onSubmit={onSubmit}>
          <Field label="Current password">
            <Input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="New password">
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          {error   && <p className="mb-4 text-sm text-flow-deep">{error}</p>}
          {success && <p className="mb-4 text-sm text-status-done">{success}</p>}
          <div className="flex items-center gap-4">
            <Button type="submit" variant="accent" disabled={submitting}>
              {submitting ? "Saving…" : "Change password"}
            </Button>
            <Link to="/forgot-password" className="text-sm font-medium text-flow-deep hover:underline">
              Forgot your password?
            </Link>
          </div>
        </form>
      </Section>

      {/* Connected accounts */}
      <Section title="Connected Accounts" subtitle="Accounts linked to your profile.">
        {accounts ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-line">
              <div>
                <p className="text-sm font-medium text-ink">Email</p>
                <p className="text-xs text-ink-soft">{accounts.email?.value}</p>
              </div>
              <span className="text-xs font-medium text-status-done">Connected</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-line">
              <div>
                <p className="text-sm font-medium text-ink">Google OAuth</p>
                <p className="text-xs text-ink-soft">
                  {accounts.google?.connected ? "Connected" : "Not connected"}
                </p>
              </div>
              <span className={`text-xs font-medium ${accounts.google?.connected ? "text-status-done" : "text-ink-faint"}`}>
                {accounts.google?.connected ? "Connected" : "—"}
              </span>
            </div>
            {accounts.personal_email?.connected && (
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-ink">Personal Email</p>
                  <p className="text-xs text-ink-soft">{accounts.personal_email?.value}</p>
                </div>
                <span className="text-xs font-medium text-status-done">Connected</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-faint">Loading…</p>
        )}
      </Section>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
// SECURITY TAB
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// SECURITY TAB
// ─────────────────────────────────────────────────────────────────
const SecurityTab = () => {
  const [sessions,     setSessions]     = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(5); // how many login history rows to show

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [twoFAError, setTwoFAError] = useState("");
  const [twoFASuccess, setTwoFASuccess] = useState("");
  const [twoFABusy, setTwoFABusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, h, a] = await Promise.all([
        axios.get(`${API}/settings/security/sessions`,      authHeaders()),
        axios.get(`${API}/settings/security/login-history`, authHeaders()),
        axios.get(`${API}/settings/security/accounts`,      authHeaders()),
      ]);
      setSessions(s.data);
      setLoginHistory(h.data);
      setVisibleHistoryCount(5); // reset pagination on reload
      setTwoFactorEnabled(!!a.data.two_factor_enabled);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const logoutCurrent = async () => {
    try {
      await axios.delete(`${API}/settings/security/session`, authHeaders());
      load();
    } catch {}
  };

  const logoutAll = async () => {
    if (!confirm("Log out all sessions? You'll need to log in again.")) return;
    try {
      await axios.delete(`${API}/settings/security/sessions`, authHeaders());
      localStorage.clear();
      window.location.href = "/login";
    } catch {}
  };

  const startTwoFactorSetup = async () => {
    setTwoFAError(""); setTwoFASuccess("");
    setTwoFABusy(true);
    try {
      const { data } = await axios.post(`${API}/settings/security/2fa/setup`, {}, authHeaders());
      setQrDataUrl(data.qrDataUrl);
    } catch (err) {
      setTwoFAError(err.response?.data?.message || "Couldn't start 2FA setup.");
    } finally {
      setTwoFABusy(false);
    }
  };

  const confirmTwoFactor = async (e) => {
    e.preventDefault();
    setTwoFAError(""); setTwoFASuccess("");
    setTwoFABusy(true);
    try {
      await axios.post(`${API}/settings/security/2fa/confirm`, { token: confirmCode }, authHeaders());
      setTwoFactorEnabled(true);
      setQrDataUrl(null);
      setConfirmCode("");
      setTwoFASuccess("Two-factor authentication enabled.");
    } catch (err) {
      setTwoFAError(err.response?.data?.message || "Invalid code.");
    } finally {
      setTwoFABusy(false);
    }
  };

  const disableTwoFactor = async (e) => {
    e.preventDefault();
    setTwoFAError(""); setTwoFASuccess("");
    setTwoFABusy(true);
    try {
      await axios.post(`${API}/settings/security/2fa/disable`, { password: disablePassword }, authHeaders());
      setTwoFactorEnabled(false);
      setShowDisableForm(false);
      setDisablePassword("");
      setTwoFASuccess("Two-factor authentication disabled.");
    } catch (err) {
      setTwoFAError(err.response?.data?.message || "Incorrect password.");
    } finally {
      setTwoFABusy(false);
    }
  };

  const visibleLoginHistory = loginHistory.slice(0, visibleHistoryCount);
  const hasMoreHistory = loginHistory.length > visibleHistoryCount;

  return (
    <>
      {/* Two-factor authentication */}
      <Section
        title="Two-Factor Authentication"
        subtitle="Require a code from an authenticator app when logging in."
      >
        {twoFactorEnabled ? (
          <>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-status-done">Enabled</span>
              {!showDisableForm && (
                <Button variant="ghost" onClick={() => setShowDisableForm(true)}>
                  Disable
                </Button>
              )}
            </div>
            {showDisableForm && (
              <form onSubmit={disableTwoFactor} className="mt-3">
                <Field label="Confirm your password to disable">
                  <Input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                  />
                </Field>
                {twoFAError && <p className="mb-3 text-sm text-flow-deep">{twoFAError}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setShowDisableForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="accent" disabled={twoFABusy}>
                    {twoFABusy ? "Disabling…" : "Disable 2FA"}
                  </Button>
                </div>
              </form>
            )}
          </>
        ) : qrDataUrl ? (
          <form onSubmit={confirmTwoFactor}>
            <p className="mb-3 text-sm text-ink-soft">
              Scan this with Google Authenticator, Authy, or similar, then enter the 6-digit code.
            </p>
            <img src={qrDataUrl} alt="2FA QR code" className="mb-4 h-40 w-40 rounded-lg border border-line" />
            <Field label="6-digit code">
              <Input
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                maxLength={6}
                required
              />
            </Field>
            {twoFAError && <p className="mb-3 text-sm text-flow-deep">{twoFAError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setQrDataUrl(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={twoFABusy}>
                {twoFABusy ? "Confirming…" : "Confirm & enable"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-ink-faint">Not enabled</span>
            <Button variant="accent" onClick={startTwoFactorSetup} disabled={twoFABusy}>
              {twoFABusy ? "Starting…" : "Enable 2FA"}
            </Button>
          </div>
        )}
        {twoFASuccess && <p className="mt-3 text-sm text-status-done">{twoFASuccess}</p>}
      </Section>

      {/* Active sessions */}
      <Section title="Active Sessions" subtitle="Devices currently logged into your account.">
        {loading ? (
          <p className="text-sm text-ink-faint">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-ink-faint">No active sessions found.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-line p-3">
                <div>
                  <p className="text-sm font-medium text-ink truncate max-w-xs">{s.device || "Unknown device"}</p>
                  <p className="text-xs text-ink-soft">{s.ip_address} · Last active {new Date(s.last_active).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3 mt-2">
          <Button variant="ghost" onClick={logoutCurrent}>Logout Current Session</Button>
          <Button variant="accent" onClick={logoutAll}>Logout All Sessions</Button>
        </div>
      </Section>

      {/* Login history */}
      <Section title="Login History" subtitle="Your recent login activity.">
        {loading ? (
          <p className="text-sm text-ink-faint">Loading…</p>
        ) : loginHistory.length === 0 ? (
          <p className="text-sm text-ink-faint">No login history found.</p>
        ) : (
          <>
            <div className="space-y-2">
              {visibleLoginHistory.map(h => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border border-line p-3">
                  <div>
                    <p className="text-sm font-medium text-ink truncate max-w-xs">{h.device || "Unknown device"}</p>
                    <p className="text-xs text-ink-soft">{h.ip_address} · {new Date(h.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    h.status === "SUCCESS"
                      ? "bg-status-done/10 text-status-done"
                      : "bg-flow-deep/10 text-flow-deep"
                  }`}>
                    {h.status}
                  </span>
                </div>
              ))}
            </div>

            {hasMoreHistory && (
              <div className="mt-3 flex justify-center">
                <Button variant="ghost" onClick={() => setVisibleHistoryCount(c => c + 5)}>
                  Show more
                </Button>
              </div>
            )}
          </>
        )}
      </Section>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
// NOTIFICATIONS TAB
// ─────────────────────────────────────────────────────────────────
const NotificationsTab = () => {
  const [prefs,   setPrefs]   = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    axios.get(`${API}/settings/notifications/prefs`, authHeaders())
      .then(r => setPrefs(r.data))
      .catch(() => {});
  }, []);

  const update = (key, val) => setPrefs(p => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    setSuccess("");
    try {
      await axios.put(`${API}/settings/notifications/prefs`, prefs, authHeaders());
      setSuccess("Preferences saved.");
    } catch {}
    setSaving(false);
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API}/settings/notifications/mark-all`, {}, authHeaders());
      setSuccess("All notifications marked as read.");
    } catch {}
  };

  if (!prefs) return <p className="text-sm text-ink-faint">Loading…</p>;

  return (
    <>
      <Section title="Notification Preferences" subtitle="Choose what you want to be notified about.">
        <Toggle
          label="Email Notifications"
          description="Receive notifications via email"
          checked={!!prefs.email_notifications}
          onChange={v => update("email_notifications", v)}
        />
        <Toggle
          label="In-App Notifications"
          description="Show notifications inside Taskflow"
          checked={!!prefs.inapp_notifications}
          onChange={v => update("inapp_notifications", v)}
        />
        <Toggle
          label="Task Assignment Alerts"
          description="Notify when a task is assigned to you"
          checked={!!prefs.task_assignment}
          onChange={v => update("task_assignment", v)}
        />
        <Toggle
          label="Task Comment Alerts"
          description="Notify when someone comments on your task"
          checked={!!prefs.task_comment}
          onChange={v => update("task_comment", v)}
        />
        <Toggle
          label="Due Date Reminder Alerts"
          description="Remind you before a task is due"
          checked={!!prefs.due_date_reminder}
          onChange={v => update("due_date_reminder", v)}
        />
        <Toggle
          label="Workspace Invite Alerts"
          description="Notify when you're invited to a workspace"
          checked={!!prefs.workspace_invite}
          onChange={v => update("workspace_invite", v)}
        />
        <Toggle
          label="Chat Mention Notifications"
          description="Notify when someone mentions you"
          checked={!!prefs.chat_mention}
          onChange={v => update("chat_mention", v)}
        />

        <div className="flex items-center gap-3 mt-4">
          <Button variant="accent" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
          <Button variant="ghost" onClick={markAllRead}>
            Mark all read
          </Button>
        </div>
        {success && <p className="mt-3 text-sm text-status-done">{success}</p>}
      </Section>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
// ACTIVITY TAB
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// ACTIVITY TAB
// ─────────────────────────────────────────────────────────────────
const ActivityTab = () => {
  const [workspaces, setWorkspaces] = useState(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [activity, setActivity] = useState(null);
  const [visibleCount, setVisibleCount] = useState(5); // how many items to show

  useEffect(() => {
    api
      .get("/workspaces/my")
      .then(({ data }) => {
        setWorkspaces(data);
        if (data.length) setWorkspaceId(String(data[0].id));
      })
      .catch(() => setWorkspaces([]));
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    setActivity(null);
    setVisibleCount(5); // reset pagination when switching workspaces
    api
      .get(`/activity/${workspaceId}`)
      .then(({ data }) => setActivity(data))
      .catch(() => setActivity([]));
  }, [workspaceId]);

  if (workspaces === null) {
    return <p className="text-sm text-ink-faint">Loading…</p>;
  }

  if (workspaces.length === 0) {
    return (
      <Section title="Activity" subtitle="Actions taken across your workspaces.">
        <p className="text-sm text-ink-faint">
          You're not in a workspace yet — activity will show up here once you are.
        </p>
      </Section>
    );
  }

  const visibleActivity = activity?.slice(0, visibleCount) ?? [];
  const hasMore = (activity?.length ?? 0) > visibleCount;

  return (
    <Section title="Activity" subtitle="Actions taken in a workspace, most recent first.">
      {workspaces.length > 1 && (
        <div className="mb-4">
          <Field label="Workspace">
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink focus:border-flow focus:outline-none focus:ring-2 focus:ring-flow/15"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {activity === null && <p className="text-sm text-ink-faint">Loading…</p>}

      {activity?.length === 0 && (
        <p className="text-sm text-ink-faint">
          Nothing's happened here yet. Once your team starts working, it'll show up here.
        </p>
      )}

      {activity?.length > 0 && (
        <>
          <ul className="space-y-1">
            {visibleActivity.map((a) => (
              <li key={a.id} className="border-b border-line/60 py-3 text-sm last:border-0">
                <p className="text-ink">
                  <span className="font-medium">{a.user_name}</span> {a.action}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="mt-3 flex justify-center">
              <Button variant="ghost" onClick={() => setVisibleCount((c) => c + 5)}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </Section>
  );
};

// ─────────────────────────────────────────────────────────────────
// ANALYTICS TAB (Admin/Super Admin only)
// ─────────────────────────────────────────────────────────────────
const AnalyticsTab = () => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/settings/analytics`, authHeaders())
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-ink-faint">Loading analytics…</p>;
  if (!data)   return <p className="text-sm text-flow-deep">Failed to load analytics.</p>;

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Tasks",     value: data.totalTasks,     color: "text-ink" },
          { label: "Completed Tasks", value: data.completedTasks, color: "text-status-done" },
          { label: "Overdue Tasks",   value: data.overdueTasks,   color: "text-flow-deep" },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-line bg-paper-soft p-5 text-center">
            <p className={`text-3xl font-display font-bold ${card.color}`}>{card.value}</p>
            <p className="mt-1 text-xs text-ink-soft">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tasks per member */}
      <Section title="Tasks Per Member">
        {data.tasksPerMember.length === 0 ? (
          <p className="text-sm text-ink-faint">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {data.tasksPerMember.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <p className="text-sm text-ink w-36 truncate">{m.name}</p>
                <div className="flex-1 h-2 rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full rounded-full bg-flow"
                    style={{ width: `${Math.min((m.task_count / (data.totalTasks || 1)) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-sm text-ink-soft w-6 text-right">{m.task_count}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Project activity */}
      <Section title="Project Activity" subtitle="Tasks created in the last 30 days.">
        {data.projectActivity.length === 0 ? (
          <p className="text-sm text-ink-faint">No project activity yet.</p>
        ) : (
          <div className="space-y-2">
            {data.projectActivity.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-line px-4 py-2.5">
                <p className="text-sm font-medium text-ink">{p.name}</p>
                <span className="text-xs font-mono text-ink-soft">{p.task_count} tasks</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Workspace activity */}
      <Section title="Workspace Activity Summary" subtitle="Actions in the last 30 days.">
        {data.workspaceActivity.length === 0 ? (
          <p className="text-sm text-ink-faint">No workspace activity yet.</p>
        ) : (
          <div className="space-y-2">
            {data.workspaceActivity.map((w, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-line px-4 py-2.5">
                <p className="text-sm font-medium text-ink">{w.name}</p>
                <span className="text-xs font-mono text-ink-soft">{w.activity_count} actions</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
};

export default Settings;
