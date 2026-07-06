import { useAuth } from "../context/AuthContext";

/**
 * <RoleGate allow={(role) => can.createProject(role)}>
 *   <button>New project</button>
 * </RoleGate>
 *
 * If `showLocked` is true, renders a disabled, tooltip-explained stand-in
 * instead of hiding the control outright — used sparingly, only where the
 * absence of the control would otherwise be confusing.
 */
const RoleGate = ({ allow, children, showLocked = false, lockedLabel = "Restricted" }) => {
  const { user } = useAuth();
  const permitted = user && allow(user.role);

  if (permitted) return children;
  if (!showLocked) return null;

  return (
    <span className="group relative inline-flex">
      <span className="pointer-events-none opacity-40 grayscale-[0.3]">{children}</span>
      <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-xs font-body text-paper opacity-0 shadow-lifted transition-opacity duration-150 group-hover:opacity-100">
        {lockedLabel}
      </span>
    </span>
  );
};

export default RoleGate;
