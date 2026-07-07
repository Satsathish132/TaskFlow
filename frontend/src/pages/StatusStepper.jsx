import { useEffect, useState } from "react";

const STEPS = [
  { key: "todo", label: "Todo" },
  { key: "process", label: "Process" },
  { key: "done", label: "Done" },
];

const STEP_DELAY_MS = 1000; // wait a second on each stage before moving on

const StatusStepper = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % STEPS.length);
    }, STEP_DELAY_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center gap-1">
      {STEPS.map((step, i) => {
        const isActive = i === current;
        const isDone = i < current || (current === 0 && i === STEPS.length - 1 && false);
        // a step counts as "completed" if it's before the active one in this cycle
        const isPast = i < current;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-300 ${
                  isActive
                    ? "border-flow bg-flow-tint text-flow-deep"
                    : isPast
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-line bg-paper-soft text-ink-faint"
                }`}
              >
                {isPast ? "✓" : isActive && step.key === "process" ? "◐" : "○"}
              </div>
              <span
                className={`font-mono text-[11px] uppercase tracking-wider transition-colors duration-300 ${
                  isActive || isPast ? "text-ink" : "text-ink-faint"
                }`}
              >
                {step.label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div
                className={`mb-6 h-px w-14 transition-colors duration-300 ${
                  i < current ? "bg-flow" : "bg-line"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StatusStepper;
