import { ROLE_LABEL } from "../utils/roles";

const STYLES = {
  SUPER_ADMIN: "bg-ink text-paper",
  ADMIN: "bg-flow text-white",
  SUB_ADMIN: "bg-status-progress/15 text-status-progress",
  MEMBER: "bg-line/60 text-ink-soft",
};

const RoleBadge = ({ role }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${STYLES[role] || STYLES.MEMBER}`}
  >
    {ROLE_LABEL[role] || role}
  </span>
);

export default RoleBadge;
