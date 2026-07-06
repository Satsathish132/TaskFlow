import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import AuthLayout from "../components/AuthLayout";
import { Field, Input, Button } from "../components/kit";

// Landing page for the link emailed to personal_email (Path A of the
// hybrid reset flow). Users without a personal_email never see this --
// they go through the admin-mediated queue instead.
const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "This reset link is invalid or has expired.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthLayout eyebrow="Password reset" title="You're all set" subtitle="">
        <p className="mb-6 text-sm text-ink-soft">Your password has been reset successfully.</p>
        <Button variant="accent" className="w-full" onClick={() => navigate("/login")}>
          Go to login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Reset password" title="Choose a new password" subtitle="">
      <form onSubmit={onSubmit}>
        <Field label="New password">
          <Input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>

        {error && <p className="mb-4 text-sm text-flow-deep">{error}</p>}

        <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
          {submitting ? "Saving…" : "Reset password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        <Link to="/login" className="font-medium text-flow-deep hover:underline">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
};

export default ResetPassword;

