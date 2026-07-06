const STAGES = ["Todo", "In progress", "Done"];

const FlowRail = ({ compact = false }) => {
  return (
    <div className={compact ? "w-40" : "w-full max-w-md"}>
      <div className="flow-rail">
        <div className="flow-rail__dot animate-flow-dot" />
      </div>
      {!compact && (
        <div className="mt-2 flex justify-between font-mono text-[11px] uppercase tracking-wider text-ink-faint">
          {STAGES.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlowRail;
