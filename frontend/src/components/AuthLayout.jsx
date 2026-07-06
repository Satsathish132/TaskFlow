import { Link } from "react-router-dom";
import FlowRail from "./FlowRail";

const AuthLayout = ({ eyebrow, title, subtitle, children }) => (
  <div className="grain relative flex min-h-screen items-center justify-center bg-paper px-6 py-12">
    <div className="w-full max-w-sm">
      <Link to="/" className="mb-10 flex items-center justify-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-flow font-display text-sm font-semibold text-white">
          T
        </span>
        <span className="font-display text-lg tracking-tight text-ink">Taskflow</span>
      </Link>

      <div className="rounded-2xl border border-line bg-paper-soft p-8 shadow-lifted">
        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-flow-deep">
          {eyebrow}
        </p>
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>

      <div className="mt-8 flex justify-center">
        <FlowRail compact />
      </div>
    </div>
  </div>
);

export default AuthLayout;
