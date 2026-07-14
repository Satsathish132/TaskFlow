import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function Login() {
  const navigate = useNavigate();

  const [isOrg, setIsOrg] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, isOrg }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Couldn't sign you in. Check your details and try again.");
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Welcome back — enter your details to continue.
          </p>
        </div>

        {/* Account type toggle */}
        <div className="mb-6 flex rounded-lg border border-line p-1">
          <button
            type="button"
            onClick={() => setIsOrg(false)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
              !isOrg ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
            }`}
          >
            Individual
          </button>
          <button
            type="button"
            onClick={() => setIsOrg(true)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
              isOrg ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
            }`}
          >
            Company
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition focus:border-ink"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition focus:border-ink"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {isOrg && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                or
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <a
              href={`${API_URL}/auth/google`}
              className="flex w-full items-center justify-center rounded-lg border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink"
            >
              Continue with Google
            </a>
          </>
        )}

        <p className="mt-6 text-center text-sm text-ink-soft">
          Starting fresh?{" "}
          <Link to="/register" className="font-medium text-flow-deep hover:underline">
            Register Your Company
          </Link>
        </p>
      </div>
    </div>
  );
}
