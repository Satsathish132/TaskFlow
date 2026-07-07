// components/TaskflowLogo.jsx
const TaskflowLogo = ({ className = "h-7 w-7" }) => (
  <svg
    viewBox="60 0 300 300"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label="Taskflow"
  >
    {/* Top bar */}
    <rect x="120" y="20" width="200" height="36" rx="18" className="fill-flow" />

    {/* Middle bar */}
    <rect x="90" y="90" width="110" height="34" rx="17" className="fill-flow-deep" />

    {/* Bottom bar */}
    <rect x="140" y="150" width="90" height="34" rx="17" className="fill-flow" />

    {/* Flowing stem connecting them */}
    <path
      d="M270 56
         C310 56 330 76 330 112
         V208
         C330 228 315 242 295 242
         C275 242 260 228 260 208
         V112
         C260 88 275 72 300 72"
      className="fill-flow-deep"
      opacity="0.9"
    />
  </svg>
);

export default TaskflowLogo;