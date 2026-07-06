import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import AuthLayout from "../components/AuthLayout";
import { Field, Input, Button } from "../components/kit";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("sending");
    try {
      await api.post("/auth/forgot-password", {
        email,
        personal_email: personalEmail || undefined,
      });
      setStatus("sent");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  if (status === "sent") {
    return (
      <AuthLayout eyebrow="Check your email" title="Reset link sent" subtitle="">
        <p className="mb-6 text-sm text-ink-soft">
          If an account exists for <strong>{email}</strong>, a password reset link has been sent. It'll expire in 30 minutes.
        </p>
        <Link to="/login" className="font-medium text-flow-deep hover:underline">
          Back to login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Forgot password" title="Reset your password" subtitle="Enter your login email. If you've added a personal email, enter it too to send the link there.">
      <form onSubmit={onSubmit}>
        <Field label="Login email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>

        <Field label="Personal email (optional)">
          <Input
            type="email"
            value={personalEmail}
            onChange={(e) => setPersonalEmail(e.target.value)}
            placeholder="Only if you've added one to your account"
          />
        </Field>

        {error && <p className="mb-4 text-sm text-flow-deep">{error}</p>}

        <Button type="submit" variant="accent" className="w-full" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send reset link"}
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

export default ForgotPassword;