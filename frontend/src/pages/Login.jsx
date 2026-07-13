import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { Field, Input, Button } from "../components/kit";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("organization"); // "organization" | "user"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await login(email, password || undefined, mode);
      if (result.mustSetPassword) {
        navigate(`/set-password?userId=${result.userId}&email=${encodeURIComponent(result.email)}`);
        return;
      }
      if (result.mustChangePassword) {
        navigate("/settings");
        return;
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't log you in. Check your details.");
    } finally {
      setSubmitting(false);
    }
  };

  const isOrg = mode === "organization";

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Log in"
      subtitle="First time logging in? Leave the password blank and we'll help you set one."
    >
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-line bg-paper p-1">
        <button
          type="button"
          onClick={() => setMode("user")}
          className={`rounded-md py-2 text-sm font-medium transition ${
            !isOrg ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          User
        </button>
        <button
          type="button"
          onClick={() => setMode("organization")}
          className={`rounded-md py-2 text-sm font-medium transition ${
            isOrg ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          Organization
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank if this is your first login"
          />
        </Field>

        <p className="mb-4 text-right">
          <Link to="/forgot-password" className="text-xs font-medium text-flow-deep hover:underline">
            Forgot password?
          </Link>
        </p>

        {error && <p className="mb-4 text-sm text-flow-deep">{error}</p>}

        <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      {isOrg && (
        <>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">or</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          
            <a href={`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/auth/google`}
            className="flex w-full items-center justify-center rounded-lg border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink"
          >
            Continue with Google
          </a>

          <p className="mt-6 text-center text-sm text-ink-soft">
            Starting fresh?{" "}
            <Link to="/register" className="font-medium text-flow-deep hover:underline">
              Register Your Company
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
};

export default Login;