import { useEffect, useState } from "react";

const STAGES = [
  { key: "todo", label: "Todo", position: 0 },
  { key: "progress", label: "In progress", position: 50 },
  { key: "done", label: "Done", position: 100 },
];

const STEP_DELAY_MS = 1500; // pause 2 seconds at each stage before moving on

const FlowRail = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % STAGES.length);
    }, STEP_DELAY_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-xl">
      <div className="relative h-px w-full bg-line">
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-flow shadow-card transition-all duration-[900ms] ease-out"
          style={{ left: `${STAGES[current].position}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider">
        {STAGES.map((stage, i) => (
          <span
            key={stage.key}
            className={`transition-colors duration-300 ${
              i === current ? "text-flow-deep" : "text-ink-faint"
            }`}
          >
            {stage.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default FlowRail;
