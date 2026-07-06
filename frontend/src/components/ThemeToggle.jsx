import { useState } from "react";

// Sun/moon toggle. Intentionally has no localStorage/persistence --
// every fresh page load starts in light mode, per requirements.
const ThemeToggle = () => {
  // Reads the real current state instead of assuming light -- AppShell
  // remounts on every route change (client-side routing), but the
  // .dark class on <html> persists across those remounts. Without this,
  // state and DOM fall out of sync and the first click after navigating
  // just "corrects" the mismatch instead of actually toggling.
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  const toggle = async (e) => {
    const next = !isDark;
    const x = e.clientX;
    const y = e.clientY;

    const applyTheme = () => {
      setIsDark(next);
      document.documentElement.classList.toggle("dark", next);
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!document.startViewTransition || reducedMotion) {
      applyTheme();
      return;
    }

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
      applyTheme();
    });

    await transition.ready;

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 650,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:bg-paper-soft hover:text-ink"
    >
      {isDark ? (
        // Sun icon (click to go light)
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Moon icon (click to go dark)
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;