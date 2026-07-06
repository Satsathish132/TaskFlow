import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { Field, Input, Button } from "../components/kit";

const SetPassword = () => {
  const { setPassword } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const userId = params.get("userId");
  const email = params.get("email");

  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");

    setSubmitting(true);
    try {
      await setPassword(userId, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't set your password. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome to Taskflow"
      title="Set up your account"
      subtitle={email ? `Choose a password for ${email}` : "Choose a password to finish setting up."}
    >
      <form onSubmit={onSubmit}>
        <Field label="New password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            required
            minLength={8}
          />
        </Field>
        <Field label="Confirm password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>

        {error && <p className="mb-4 text-sm text-flow-deep">{error}</p>}

        <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
          {submitting ? "Setting up…" : "Set password & continue"}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default SetPassword;
