export const Field = ({ label, error, children }) => (
  <label className="mb-4 block">
    <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-soft">
      {label}
    </span>
    {children}
    {error && <span className="mt-1 block text-xs text-flow-deep">{error}</span>}
  </label>
);

export const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint transition focus:border-flow focus:outline-none focus:ring-2 focus:ring-flow/15 ${props.className || ""}`}
  />
);

export const Textarea = (props) => (
  <textarea
    {...props}
    className={`w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint transition focus:border-flow focus:outline-none focus:ring-2 focus:ring-flow/15 ${props.className || ""}`}
  />
);

export const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink transition focus:border-flow focus:outline-none focus:ring-2 focus:ring-flow/15 ${props.className || ""}`}
  />
);

export const Button = ({ variant = "primary", className = "", ...props }) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

  const styles = {
    // Primary: the app's default action -- solid, grounded, a firm press.
    primary:
      "bg-ink text-paper shadow-card hover:bg-flow-deep hover:shadow-lifted active:scale-[0.97] active:shadow-card",

    // Accent: the "go" action -- the most alive of all of them, lifts and brightens.
    accent:
      "bg-flow text-white shadow-card hover:bg-flow-deep hover:-translate-y-0.5 hover:shadow-lifted active:translate-y-0 active:scale-[0.97] active:shadow-card",

    // Ghost: lowest commitment -- color fades in, no movement at all.
    ghost:
      "bg-transparent text-ink hover:bg-line/50 active:bg-line/70",

    // Outline: quiet secondary -- border sharpens, gentle press.
    outline:
      "border border-line bg-transparent text-ink hover:border-ink hover:bg-paper-soft active:scale-[0.98] active:bg-paper-deep",

    // Danger: deliberately the least "inviting" -- no lift, just a firmer
    // compression on press, so committing to it takes a visible beat.
    danger:
      "bg-transparent text-flow-deep hover:bg-flow-tint active:scale-[0.95] active:bg-flow-tint",
  };

  return <button {...props} className={`${base} ${styles[variant]} ${className}`} />;
};