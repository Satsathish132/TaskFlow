const EmptyState = ({ title, body, action }) => (
  <div className="grain relative flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper-soft px-8 py-16 text-center">
    <div className="mb-4 h-px w-10 bg-flow" />
    <h3 className="font-display text-xl text-ink">{title}</h3>
    <p className="mt-2 max-w-sm text-sm text-ink-soft">{body}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export default EmptyState;
