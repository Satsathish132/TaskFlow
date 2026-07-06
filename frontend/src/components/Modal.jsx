import { useEffect } from "react";

const Modal = ({ open, onClose, title, children, width = "max-w-md" }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4">
      <div
        className={`w-full ${width} animate-rise-in rounded-2xl border border-line bg-paper-soft p-6 shadow-lifted`}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-ink-faint transition hover:bg-line/50 hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default Modal;
