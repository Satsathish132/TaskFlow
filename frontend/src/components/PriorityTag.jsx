const STYLES = {
  LOW: "bg-ink-faint/10 text-ink-soft",
  MEDIUM: "bg-status-progress/15 text-status-progress",
  HIGH: "bg-flow/15 text-flow-deep",
};

const PriorityTag = ({ priority }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${STYLES[priority] || STYLES.MEDIUM}`}
  >
    {priority}
  </span>
);

export default PriorityTag;
