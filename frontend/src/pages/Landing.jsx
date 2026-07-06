import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import FlowRail from "../components/FlowRail";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  {
    title: "Workspaces",
    body: "One organization, many workspaces. Every team gets its own room without losing sight of the whole company.",
  },
  {
    title: "Tasks that move",
    body: "Drag a card from Todo to Done and the whole team feels it — status, priority, and assignee travel with it.",
  },
  {
    title: "Activity, in real time",
    body: "Every comment, assignment, and status change lands in the feed the instant it happens. No refresh required.",
  },
  {
    title: "Roles that hold",
    body: "Super Admin, Admin, Sub Admin, Member — permissions enforced in the UI, not just quietly checked on the server.",
  },
];

const Landing = () => {
  const [searchParams] = useSearchParams();
  const { setSessionFromOAuth } = useAuth();
  const navigate = useNavigate();

  // Google OAuth lands back here (app.js redirects to the frontend root)
  // with accessToken/refreshToken/user in the query string.
  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    const userRaw = searchParams.get("user");

    if (accessToken && refreshToken && userRaw) {
      try {
        const user = JSON.parse(decodeURIComponent(userRaw));
        setSessionFromOAuth(accessToken, refreshToken, user);
        navigate("/dashboard", { replace: true });
      } catch {
        // fall through to the marketing page if parsing fails
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const oauthFailed = searchParams.get("error") === "google_failed";

  return (
    <div className="grain relative min-h-screen overflow-hidden bg-paper">
      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-flow font-display text-sm font-semibold text-white">
            T
          </span>
          <span className="font-display text-lg tracking-tight text-ink">Taskflow</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-ink">
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-flow-deep"
          >
            Start your organization
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
        {oauthFailed && (
          <p className="mx-auto mb-5 max-w-md rounded-lg border border-flow/30 bg-flow-tint px-4 py-2 text-sm text-flow-deep">
            Google sign-in didn't go through. Please try again.
          </p>
        )}
        <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-flow-deep">
          Work, in motion
        </p>
        <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-ink sm:text-6xl">
          Every task has a <span className="italic text-flow-deep">direction.</span>
          <br />
          Taskflow keeps it moving.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft">
          A workspace and project tool for teams who'd rather watch work move than chase
          status updates. Organizations, roles, and real-time activity — built in from
          the ground up.
        </p>

        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            to="/register"
            className="rounded-lg bg-flow px-6 py-3 text-sm font-medium text-white shadow-card transition hover:bg-flow-deep"
          >
            Start your organization
          </Link>
          <a
            href={`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/auth/google`}
            className="rounded-lg border border-line bg-paper-soft px-6 py-3 text-sm font-medium text-ink transition hover:border-ink"
          >
            Continue with Google
          </a>
        </div>

        <div className="mt-16 flex justify-center">
          <FlowRail />
        </div>
      </section>

      {/* features */}
      <section className="relative z-10 mx-auto max-w-6xl border-t border-line px-6 py-16">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-paper-soft p-6">
              <div className="mb-4 h-px w-8 bg-flow" />
              <h3 className="font-display text-lg text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* role strip */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24">
        <div className="rounded-2xl border border-line bg-paper-soft p-8 text-center shadow-card">
          <h2 className="font-display text-2xl text-ink">Built for how teams actually rank</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            Super Admin, Admin, Sub Admin, Member — each sees exactly what they're meant to,
            and nothing they're not.
          </p>
          <div className="mx-auto mt-6 flex max-w-lg items-center justify-between font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            <span>Super Admin</span>
            <span className="text-line">→</span>
            <span>Admin</span>
            <span className="text-line">→</span>
            <span>Sub Admin</span>
            <span className="text-line">→</span>
            <span>Member</span>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-line px-6 py-8 text-center text-xs text-ink-faint">
        Taskflow — built for teams in motion.
      </footer>
    </div>
  );
};

export default Landing;
