import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import { Field, Input, Button } from "../components/kit";

const Register = () => {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    organization_name: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(form);
      const result = await login(form.email, form.password);
      if (!result.mustSetPassword) navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="New organization"
      title="Start your organization"
      subtitle="You'll be the Super Admin — invite your team once you're in."
    >
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input name="first_name" value={form.first_name} onChange={onChange} required />
          </Field>
          <Field label="Last name">
            <Input name="last_name" value={form.last_name} onChange={onChange} required />
          </Field>
        </div>
        <Field label="Organization name">
          <Input
            name="organization_name"
            placeholder="Acme Inc."
            value={form.organization_name}
            onChange={onChange}
            required
          />
        </Field>
        <Field label="Work email">
          <Input type="email" name="email" value={form.email} onChange={onChange} required />
        </Field>
        <Field label="Password">
          <Input type="password" name="password" value={form.password} onChange={onChange} required />
        </Field>

        {error && <p className="mb-4 text-sm text-flow-deep">{error}</p>}

        <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
          {submitting ? "Creating organization…" : "Create organization"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-flow-deep hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
