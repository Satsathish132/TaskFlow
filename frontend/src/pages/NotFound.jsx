import { Link } from "react-router-dom";
import FlowRail from "../components/FlowRail";

const NotFound = () => (
  <div className="grain flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-flow-deep">404</p>
    <h1 className="mt-3 font-display text-4xl text-ink">This path doesn't lead anywhere.</h1>
    <p className="mt-3 max-w-sm text-sm text-ink-soft">
      The page you're looking for moved, or never existed. Let's get you back on track.
    </p>
    <Link
      to="/"
      className="mt-7 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-flow-deep"
    >
      Back to Taskflow
    </Link>
    <div className="mt-14">
      <FlowRail compact />
    </div>
  </div>
);

export default NotFound;
